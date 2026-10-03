import { createStore } from 'zustand/vanilla'
import { checkPermission as defaultCheckPermission, requestPermission as defaultRequestPermission } from '../lib/permission'
import { clearCache as defaultClearCache, clearEntries as defaultClearEntries, loadEntries as defaultLoadEntries, loadRootHandle as defaultLoadRootHandle, saveEntries as defaultSaveEntries, saveRootHandle as defaultSaveRootHandle } from '../lib/db'
import { isFileSystemAccessSupported } from '../lib/browserSupport'
import { readStoredIgnorePatterns, saveIgnorePatterns } from '../lib/ignorePatterns'
import type { IndexEntry, QueryFilters } from '../lib/types'
import type { WorkerOutMessage } from '../workers/scanController'

type Status = 'empty' | 'fallback' | 'needs-permission' | 'scanning' | 'restoring' | 'ready' | 'error'

const DEFAULT_FILTERS: QueryFilters = { query: '', sort: 'name' }
const DEBOUNCE_MS = 130
const STORAGE_FULL_NOTICE = "Browser storage is full — this folder's index won't be saved for next time."
const SAVE_FAILED_NOTICE = "Couldn't save this folder's index for next time."

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
  restoringCount: number
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

function saveFailureNotice(err: unknown): string {
  console.error('Failed to persist folder index', err)
  return err instanceof Error && err.name === 'QuotaExceededError' ? STORAGE_FULL_NOTICE : SAVE_FAILED_NOTICE
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message || err.name : String(err)
}

export function createFileSearchStore(deps: FileSearchDeps = defaultFileSearchDeps) {
  let worker = deps.createWorker()
  let debounceTimer: ReturnType<typeof setTimeout> | undefined
  let scanId = 0 // bumped per scan; scan replies carrying an older id are stale and dropped

  const store = createStore<FileSearchState>((set, get) => {
    // Back-pressure: one query in flight; extra requests collapse into one follow-up with the latest filters.
    let queryInFlight = false
    let queryDirty = false
    function postQuery() {
      if (queryInFlight) {
        queryDirty = true
        return
      }
      try {
        worker.postMessage({ type: 'query', filters: get().filters })
        queryInFlight = true
      } catch (err) {
        set({ status: 'error', error: errorText(err) })
      }
    }
    // A late reply from the old query can briefly allow two in flight; benign (replies are ordered, filters read at send time).
    function resetQueries() {
      queryInFlight = false
      queryDirty = false
    }

    function attachHandlers(w: Worker) {
      w.onmessage = handleMessage
      // Backstop for script-load failures / crashes (e.g. a CSP block); NOT the scan-error path.
      w.onerror = () => {
        resetQueries()
        set({ status: 'error', error: 'The search worker stopped unexpectedly.' })
      }
    }

    function handleMessage(event: MessageEvent<WorkerOutMessage>) {
      const msg = event.data
      const status = get().status
      if ((msg.type === 'progress' || msg.type === 'scan-complete' || msg.type === 'error') && msg.scanId !== undefined && msg.scanId !== scanId) return
      if (msg.type === 'progress') {
        if (status !== 'scanning') return
        set({ progress: { scanned: msg.scanned, skipped: msg.skipped } })
        postQuery()
      } else if (msg.type === 'scan-complete') {
        if (status !== 'scanning') return
        set({
          status: 'ready',
          progress: { scanned: msg.scanned, skipped: msg.skipped },
          skippedFolders: msg.skipped,
          ignoredFolders: msg.ignored,
        })
        const savedScanId = scanId
        deps.saveEntries(msg.entries).catch(async (err: unknown) => {
          if (savedScanId !== scanId) return // a newer scan owns the cache now; don't clobber it
          await deps.clearEntries().catch((clearErr: unknown) => console.error('Failed to clear cached entries', clearErr))
          set({ notice: saveFailureNotice(err) })
        })
        postQuery()
      } else if (msg.type === 'query-result') {
        set({ results: msg.entries })
        queryInFlight = false
        if (queryDirty) {
          queryDirty = false
          postQuery()
        }
      } else if (msg.type === 'restore-complete') {
        if (status !== 'restoring') return
        set({ status: 'ready', progress: { scanned: msg.count, skipped: 0 } })
        postQuery()
      } else if (msg.type === 'query-error') {
        // A failed query is not fatal: keep status and results; free the slot so the next query can go out.
        console.error('Search query failed', msg.message)
        resetQueries()
      } else if (msg.type === 'error') {
        resetQueries()
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
      set({ status: 'restoring', rootHandle: handle, skippedFolders: 0, restoringCount: cached.length })
      try {
        worker.postMessage({ type: 'restore', entries: cached })
      } catch (err) {
        set({ status: 'error', error: errorText(err) })
      }
    }

    async function startScan(handle: FileSystemDirectoryHandle) {
      set({ status: 'scanning', rootHandle: handle, progress: { scanned: 0, skipped: 0 }, error: undefined })
      try {
        worker.postMessage({ type: 'scan', scanId: ++scanId, root: handle, ignorePatterns: get().ignorePatterns })
      } catch (err) {
        set({ status: 'error', error: errorText(err) })
      }
    }

    return {
      status: 'empty',
      restoringCount: 0,
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
        let permission: Awaited<ReturnType<FileSearchDeps['requestPermission']>>
        try {
          permission = await deps.requestPermission(handle)
        } catch {
          set({ status: 'needs-permission' })
          return
        }
        if (permission !== 'granted') {
          set({ status: 'needs-permission' })
          return
        }
        try {
          await restoreFromCache(handle)
        } catch (err) {
          set({ status: 'error', error: errorText(err) })
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
        } catch (err) {
          set({ notice: saveFailureNotice(err) })
        }
        await startScan(handle)
      },

      async refresh() {
        const handle = get().rootHandle
        if (!handle) return
        await startScan(handle)
      },

      async retry() {
        worker.onmessage = null
        worker.onerror = null
        if (debounceTimer) clearTimeout(debounceTimer)
        worker.terminate()
        resetQueries()
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
        debounceTimer = setTimeout(() => postQuery(), DEBOUNCE_MS)
      },

      setIgnorePatterns(patterns) {
        set({ ignorePatterns: patterns })
        try {
          saveIgnorePatterns(patterns)
        } catch (err) {
          console.error('Failed to persist ignore patterns', err)
        }
      },
    }
  })

  return store
}
