import { createStore } from 'zustand/vanilla'
import { checkPermission as defaultCheckPermission, requestPermission as defaultRequestPermission } from '../lib/permission'
import { clearCache as defaultClearCache, loadEntries as defaultLoadEntries, loadRootHandle as defaultLoadRootHandle, saveEntries as defaultSaveEntries, saveRootHandle as defaultSaveRootHandle } from '../lib/db'
import { isFileSystemAccessSupported } from '../lib/browserSupport'
import type { IndexEntry, QueryFilters } from '../lib/types'
import type { WorkerOutMessage } from '../workers/scanController'

type Status = 'empty' | 'fallback' | 'needs-permission' | 'scanning' | 'ready'

const DEFAULT_FILTERS: QueryFilters = { query: '', sort: 'name' }
const DEBOUNCE_MS = 130

export interface FileSearchDeps {
  createWorker: () => Worker
  isSupported: () => boolean
  showDirectoryPicker: () => Promise<FileSystemDirectoryHandle>
  checkPermission: (handle: FileSystemDirectoryHandle) => Promise<'granted' | 'prompt' | 'denied'>
  requestPermission: (handle: FileSystemDirectoryHandle) => Promise<'granted' | 'prompt' | 'denied'>
  loadRootHandle: () => Promise<FileSystemDirectoryHandle | undefined>
  saveRootHandle: (handle: FileSystemDirectoryHandle) => Promise<void>
  loadEntries: () => Promise<IndexEntry[] | undefined>
  saveEntries: (entries: IndexEntry[]) => Promise<void>
  clearCache: () => Promise<void>
}

export const defaultFileSearchDeps: FileSearchDeps = {
  createWorker: () => new Worker(new URL('../workers/scan.worker.ts', import.meta.url), { type: 'module' }),
  isSupported: isFileSystemAccessSupported,
  showDirectoryPicker: () => window.showDirectoryPicker(),
  checkPermission: defaultCheckPermission,
  requestPermission: defaultRequestPermission,
  loadRootHandle: defaultLoadRootHandle,
  saveRootHandle: defaultSaveRootHandle,
  loadEntries: defaultLoadEntries,
  saveEntries: defaultSaveEntries,
  clearCache: defaultClearCache,
}

export interface FileSearchState {
  status: Status
  rootHandle?: FileSystemDirectoryHandle
  progress: { scanned: number; skipped: number }
  skippedFolders: number
  results: IndexEntry[]
  filters: QueryFilters
  init: () => Promise<void>
  selectFolder: () => Promise<void>
  resumeAccess: () => Promise<void>
  refresh: () => Promise<void>
  setFilters: (partial: Partial<QueryFilters>) => void
}

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError'
}

export function createFileSearchStore(deps: FileSearchDeps = defaultFileSearchDeps) {
  const worker = deps.createWorker()
  let debounceTimer: ReturnType<typeof setTimeout> | undefined

  const store = createStore<FileSearchState>((set, get) => {
    function postQuery(filters: QueryFilters) {
      worker.postMessage({ type: 'query', filters })
    }

    worker.onmessage = (event: MessageEvent<WorkerOutMessage>) => {
      const msg = event.data
      if (msg.type === 'progress') {
        set({ progress: { scanned: msg.scanned, skipped: msg.skipped } })
        postQuery(get().filters)
      } else if (msg.type === 'scan-complete') {
        set({
          status: 'ready',
          progress: { scanned: msg.scanned, skipped: msg.skipped },
          skippedFolders: msg.skipped,
        })
        void deps.saveEntries(msg.entries)
        postQuery(get().filters)
      } else if (msg.type === 'query-result') {
        set({ results: msg.entries })
      }
    }

    async function restoreFromCache(handle: FileSystemDirectoryHandle) {
      const cached = (await deps.loadEntries()) ?? []
      worker.postMessage({ type: 'restore', entries: cached })
      set({ status: 'ready', rootHandle: handle, skippedFolders: 0 })
      postQuery(get().filters)
    }

    async function startScan(handle: FileSystemDirectoryHandle) {
      set({ status: 'scanning', rootHandle: handle, progress: { scanned: 0, skipped: 0 } })
      worker.postMessage({ type: 'scan', root: handle })
    }

    return {
      status: 'empty',
      rootHandle: undefined,
      progress: { scanned: 0, skipped: 0 },
      skippedFolders: 0,
      results: [],
      filters: DEFAULT_FILTERS,

      async init() {
        if (!deps.isSupported()) {
          set({ status: 'fallback' })
          return
        }
        const handle = await deps.loadRootHandle()
        if (!handle) {
          set({ status: 'empty' })
          return
        }
        const permission = await deps.checkPermission(handle)
        if (permission === 'granted') {
          await restoreFromCache(handle)
        } else {
          set({ status: 'needs-permission', rootHandle: handle })
        }
      },

      async resumeAccess() {
        const handle = get().rootHandle
        if (!handle) return
        const permission = await deps.requestPermission(handle)
        if (permission === 'granted') {
          await restoreFromCache(handle)
        } else {
          set({ status: 'needs-permission' })
        }
      },

      async selectFolder() {
        let handle: FileSystemDirectoryHandle
        try {
          handle = await deps.showDirectoryPicker()
        } catch (err) {
          if (isAbortError(err)) return
          throw err
        }
        await deps.clearCache()
        await deps.saveRootHandle(handle)
        await startScan(handle)
      },

      async refresh() {
        const handle = get().rootHandle
        if (!handle) return
        await startScan(handle)
      },

      setFilters(partial) {
        const filters = { ...get().filters, ...partial }
        set({ filters })
        if (debounceTimer) clearTimeout(debounceTimer)
        debounceTimer = setTimeout(() => postQuery(filters), DEBOUNCE_MS)
      },
    }
  })

  return store
}
