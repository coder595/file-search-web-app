import { createStore } from 'zustand/vanilla'
import { checkPermission as defaultCheckPermission, requestPermission as defaultRequestPermission } from '../lib/permission'
import { clearCache as defaultClearCache, clearEntries as defaultClearEntries, loadEntries as defaultLoadEntries, loadRootHandle as defaultLoadRootHandle, saveEntries as defaultSaveEntries, saveRootHandle as defaultSaveRootHandle } from '../lib/db'
import { isFileSystemAccessSupported } from '../lib/browserSupport'
import { readStoredIgnorePatterns, saveIgnorePatterns } from '../lib/ignorePatterns'
import type { IndexEntry, QueryFilters } from '../lib/types'
import type { WorkerOutMessage } from '../workers/scanController'

type Status = 'empty' | 'fallback' | 'needs-permission' | 'scanning' | 'ready' | 'error'

const DEFAULT_FILTERS: QueryFilters = { query: '', sort: 'name' }
const DEBOUNCE_MS = 130
const STORAGE_FULL_NOTICE = "Browser storage is full — this folder's index won't be saved for next time."

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
  clearEntries: () => Promise<void>
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
  clearEntries: defaultClearEntries,
}

export interface FileSearchState {
  status: Status
  rootHandle?: FileSystemDirectoryHandle
  progress: { scanned: number; skipped: number }
  skippedFolders: number
  ignoredFolders: number
  notice?: string
  error?: string
  results: IndexEntry[]
  filters: QueryFilters
  ignorePatterns: string[]
  init: () => Promise<void>
  selectFolder: () => Promise<void>
  resumeAccess: () => Promise<void>
  refresh: () => Promise<void>
  retry: () => Promise<void>
  setFilters: (partial: Partial<QueryFilters>) => void
  setIgnorePatterns: (patterns: string[]) => void
}

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError'
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message || err.name : String(err)
}

export function createFileSearchStore(deps: FileSearchDeps = defaultFileSearchDeps) {
  let worker = deps.createWorker()
  let debounceTimer: ReturnType<typeof setTimeout> | undefined

  const store = createStore<FileSearchState>((set, get) => {
    function postQuery(filters: QueryFilters) {
      worker.postMessage({ type: 'query', filters })
    }

    function attachHandlers(w: Worker) {
      w.onmessage = handleMessage
      // Backstop for script-load failures / crashes (e.g. a CSP block); NOT the scan-error path.
      w.onerror = () => set({ status: 'error', error: 'The search worker stopped unexpectedly.' })
    }

    function handleMessage(event: MessageEvent<WorkerOutMessage>) {
      const msg = event.data
      if (msg.type === 'progress') {
        set({ progress: { scanned: msg.scanned, skipped: msg.skipped } })
        postQuery(get().filters)
      } else if (msg.type === 'scan-complete') {
        set({
          status: 'ready',
          progress: { scanned: msg.scanned, skipped: msg.skipped },
          skippedFolders: msg.skipped,
          ignoredFolders: msg.ignored,
        })
        deps.saveEntries(msg.entries).catch(async () => {
          await deps.clearEntries().catch(() => {})
          set({ notice: STORAGE_FULL_NOTICE })
        })
        postQuery(get().filters)
      } else if (msg.type === 'query-result') {
        set({ results: msg.entries })
      } else if (msg.type === 'error') {
        set({ status: 'error', error: msg.message })
      }
    }
    attachHandlers(worker)

    async function restoreFromCache(handle: FileSystemDirectoryHandle) {
      const cached = await deps.loadEntries()
      if (!cached) {
        await startScan(handle) // root handle saved but entries missing (e.g. failed save): re-scan
        return
      }
      worker.postMessage({ type: 'restore', entries: cached })
      set({ status: 'ready', rootHandle: handle, skippedFolders: 0 })
      postQuery(get().filters)
    }

    async function startScan(handle: FileSystemDirectoryHandle) {
      set({ status: 'scanning', rootHandle: handle, progress: { scanned: 0, skipped: 0 } })
      worker.postMessage({ type: 'scan', root: handle, ignorePatterns: get().ignorePatterns })
    }

    return {
      status: 'empty',
      rootHandle: undefined,
      progress: { scanned: 0, skipped: 0 },
      skippedFolders: 0,
      ignoredFolders: 0,
      results: [],
      filters: DEFAULT_FILTERS,
      ignorePatterns: readStoredIgnorePatterns(),

      async init() {
        if (!deps.isSupported()) {
          set({ status: 'fallback' })
          return
        }
        try {
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
        } catch (err) {
          set({ status: 'error', error: errorText(err) })
        }
      },

      async resumeAccess() {
        const handle = get().rootHandle
        if (!handle) return
        try {
          const permission = await deps.requestPermission(handle)
          if (permission === 'granted') {
            await restoreFromCache(handle)
          } else {
            set({ status: 'needs-permission' })
          }
        } catch {
          set({ status: 'needs-permission' })
        }
      },

      async selectFolder() {
        let handle: FileSystemDirectoryHandle
        try {
          handle = await deps.showDirectoryPicker()
        } catch (err) {
          if (!isAbortError(err)) set({ status: 'error', error: errorText(err) })
          return
        }
        set({ notice: undefined })
        try {
          await deps.clearCache()
          await deps.saveRootHandle(handle)
        } catch {
          set({ notice: STORAGE_FULL_NOTICE })
        }
        await startScan(handle)
      },

      async refresh() {
        const handle = get().rootHandle
        if (!handle) return
        await startScan(handle)
      },

      async retry() {
        worker.terminate()
        worker = deps.createWorker()
        attachHandlers(worker)
        set({ error: undefined })
        const handle = get().rootHandle
        if (!handle) {
          set({ status: 'empty' })
          return
        }
        try {
          if ((await deps.checkPermission(handle)) === 'granted') await startScan(handle)
          else set({ status: 'needs-permission' })
        } catch (err) {
          set({ status: 'error', error: errorText(err) })
        }
      },

      setFilters(partial) {
        const filters = { ...get().filters, ...partial }
        set({ filters })
        if (debounceTimer) clearTimeout(debounceTimer)
        debounceTimer = setTimeout(() => postQuery(filters), DEBOUNCE_MS)
      },

      setIgnorePatterns(patterns) {
        saveIgnorePatterns(patterns)
        set({ ignorePatterns: patterns })
      },
    }
  })

  return store
}
