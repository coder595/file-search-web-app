import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_IGNORE_PATTERNS } from '../lib/ignorePatterns'
import type { IndexEntry, QueryFilters } from '../lib/types'
import { makeFakeDeps as makeDeps } from '../test/fakeFileSearchDeps'
import { createFileSearchStore } from './fileSearchStore'

describe('createFileSearchStore', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
  })

  it('starts in the empty state when there is no cached root handle', async () => {
    const { deps } = makeDeps()
    const store = createFileSearchStore(deps)
    await store.getState().init()
    expect(store.getState().status).toBe('empty')
  })

  it('shows the unsupported banner state when the File System Access API is unavailable', async () => {
    const { deps } = makeDeps({ isSupported: () => false })
    const store = createFileSearchStore(deps)
    await store.getState().init()
    expect(store.getState().status).toBe('fallback')
  })

  it('on init, a granted cached permission restores entries instantly with no re-scan', async () => {
    const handle = {} as FileSystemDirectoryHandle
    const cached: IndexEntry[] = [
      { id: '1', name: 'a.pdf', path: 'a.pdf', extension: 'pdf', kind: 'file', size: 1, lastModified: 1 },
    ]
    const { worker, deps } = makeDeps({
      loadRootHandle: vi.fn().mockResolvedValue(handle),
      loadEntries: vi.fn().mockResolvedValue(cached),
      checkPermission: vi.fn().mockResolvedValue('granted'),
    })
    const store = createFileSearchStore(deps)
    await store.getState().init()

    expect(store.getState().status).toBe('ready')
    expect(worker.posted).toContainEqual({ type: 'restore', entries: cached })
    expect(worker.posted.find((m) => m.type === 'scan')).toBeUndefined()
  })

  it('on init, a not-yet-granted cached permission shows a resume-access state instead of restoring', async () => {
    const handle = {} as FileSystemDirectoryHandle
    const { deps } = makeDeps({
      loadRootHandle: vi.fn().mockResolvedValue(handle),
      checkPermission: vi.fn().mockResolvedValue('prompt'),
    })
    const store = createFileSearchStore(deps)
    await store.getState().init()

    expect(store.getState().status).toBe('needs-permission')
  })

  it('resumeAccess() requests permission via a real user gesture and then restores', async () => {
    const handle = {} as FileSystemDirectoryHandle
    const cached: IndexEntry[] = []
    const requestPermission = vi.fn().mockResolvedValue('granted')
    const { worker, deps } = makeDeps({
      loadRootHandle: vi.fn().mockResolvedValue(handle),
      checkPermission: vi.fn().mockResolvedValue('prompt'),
      requestPermission,
      loadEntries: vi.fn().mockResolvedValue(cached),
    })
    const store = createFileSearchStore(deps)
    await store.getState().init()
    await store.getState().resumeAccess()

    expect(requestPermission).toHaveBeenCalledWith(handle)
    expect(store.getState().status).toBe('ready')
    expect(worker.posted).toContainEqual({ type: 'restore', entries: cached })
  })

  it('resumeAccess() denied keeps the needs-permission state, not a broken restore', async () => {
    const handle = {} as FileSystemDirectoryHandle
    const { deps } = makeDeps({
      loadRootHandle: vi.fn().mockResolvedValue(handle),
      checkPermission: vi.fn().mockResolvedValue('prompt'),
      requestPermission: vi.fn().mockResolvedValue('denied'),
    })
    const store = createFileSearchStore(deps)
    await store.getState().init()
    await store.getState().resumeAccess()

    expect(store.getState().status).toBe('needs-permission')
  })

  it('selectFolder() opens the native picker, scans, and persists the root handle', async () => {
    const handle = {} as FileSystemDirectoryHandle
    const { worker, deps } = makeDeps({ showDirectoryPicker: vi.fn().mockResolvedValue(handle) })
    const store = createFileSearchStore(deps)
    await store.getState().init()
    await store.getState().selectFolder()

    expect(deps.saveRootHandle).toHaveBeenCalledWith(handle)
    expect(store.getState().status).toBe('scanning')
    expect(worker.posted).toContainEqual({ type: 'scan', root: handle, ignorePatterns: DEFAULT_IGNORE_PATTERNS })
  })

  it('dismissing the native picker is a no-op, staying on the empty state', async () => {
    const abortError = Object.assign(new Error('cancelled'), { name: 'AbortError' })
    const { deps } = makeDeps({ showDirectoryPicker: vi.fn().mockRejectedValue(abortError) })
    const store = createFileSearchStore(deps)
    await store.getState().init()
    await store.getState().selectFolder()

    expect(store.getState().status).toBe('empty')
  })

  it('progress messages update scanned/skipped counts and refresh live results', async () => {
    const handle = {} as FileSystemDirectoryHandle
    const { worker, deps } = makeDeps({ showDirectoryPicker: vi.fn().mockResolvedValue(handle) })
    const store = createFileSearchStore(deps)
    await store.getState().init()
    await store.getState().selectFolder()

    worker.emit({ type: 'progress', scanned: 42, skipped: 1 })

    expect(store.getState().progress).toEqual({ scanned: 42, skipped: 1 })
    expect(worker.posted.some((m) => m.type === 'query')).toBe(true)
  })

  it('scan-complete sets status ready, caches entries, and shows skipped-folder count', async () => {
    const handle = {} as FileSystemDirectoryHandle
    const entries: IndexEntry[] = [
      { id: '1', name: 'a.pdf', path: 'a.pdf', extension: 'pdf', kind: 'file', size: 1, lastModified: 1 },
    ]
    const { worker, deps } = makeDeps({ showDirectoryPicker: vi.fn().mockResolvedValue(handle) })
    const store = createFileSearchStore(deps)
    await store.getState().init()
    await store.getState().selectFolder()

    worker.emit({ type: 'scan-complete', scanned: 1, skipped: 2, ignored: 3, entries })

    expect(store.getState().status).toBe('ready')
    expect(store.getState().skippedFolders).toBe(2)
    expect(store.getState().ignoredFolders).toBe(3)
    expect(deps.saveEntries).toHaveBeenCalledWith(entries)
  })

  it('query-result messages populate the results list', async () => {
    const { worker, deps } = makeDeps()
    const store = createFileSearchStore(deps)
    await store.getState().init()

    const entries: IndexEntry[] = [
      { id: '1', name: 'a.pdf', path: 'a.pdf', extension: 'pdf', kind: 'file', size: 1, lastModified: 1 },
    ]
    worker.emit({ type: 'query-result', entries })

    expect(store.getState().results).toEqual(entries)
  })

  it('setFilters debounces the query message by ~130ms', async () => {
    const { worker, deps } = makeDeps()
    const store = createFileSearchStore(deps)
    await store.getState().init()
    const before = worker.posted.length

    store.getState().setFilters({ query: 'inv' })
    expect(worker.posted.length).toBe(before) // not sent yet

    await vi.advanceTimersByTimeAsync(130)
    expect(worker.posted.at(-1)).toEqual({
      type: 'query',
      filters: expect.objectContaining({ query: 'inv' }) as QueryFilters,
    })
  })

  it('refresh() forces a full re-scan and is the only action that does so', async () => {
    const handle = {} as FileSystemDirectoryHandle
    const { worker, deps } = makeDeps({ loadRootHandle: vi.fn().mockResolvedValue(handle), loadEntries: vi.fn().mockResolvedValue([]) })
    const store = createFileSearchStore(deps)
    await store.getState().init()
    worker.posted.length = 0

    await store.getState().refresh()

    expect(worker.posted).toContainEqual({ type: 'scan', root: handle, ignorePatterns: DEFAULT_IGNORE_PATTERNS })
    expect(store.getState().status).toBe('scanning')
  })

  it('starts with ignorePatterns from localStorage, falling back to the default list', async () => {
    const { deps } = makeDeps()
    const store = createFileSearchStore(deps)
    await store.getState().init()
    expect(store.getState().ignorePatterns).toEqual(DEFAULT_IGNORE_PATTERNS)
  })

  it('setIgnorePatterns() updates state and persists to localStorage, without triggering a re-scan', async () => {
    const handle = {} as FileSystemDirectoryHandle
    const { worker, deps } = makeDeps({ loadRootHandle: vi.fn().mockResolvedValue(handle), loadEntries: vi.fn().mockResolvedValue([]) })
    const store = createFileSearchStore(deps)
    await store.getState().init()
    worker.posted.length = 0

    store.getState().setIgnorePatterns(['node_modules'])

    expect(store.getState().ignorePatterns).toEqual(['node_modules'])
    expect(localStorage.getItem('file-search:ignore-patterns')).toBe(JSON.stringify(['node_modules']))
    expect(worker.posted.some((m) => m.type === 'scan')).toBe(false)
  })

  it('refresh() after setIgnorePatterns() sends the newly-set list, not the stale default', async () => {
    const handle = {} as FileSystemDirectoryHandle
    const { worker, deps } = makeDeps({ loadRootHandle: vi.fn().mockResolvedValue(handle), loadEntries: vi.fn().mockResolvedValue([]) })
    const store = createFileSearchStore(deps)
    await store.getState().init()
    store.getState().setIgnorePatterns(['dist'])
    worker.posted.length = 0

    await store.getState().refresh()

    expect(worker.posted).toContainEqual({ type: 'scan', root: handle, ignorePatterns: ['dist'] })
  })

  describe('storage failures [B1]', () => {
    const NOTICE = "Browser storage is full — this folder's index won't be saved for next time."

    it('a failed saveEntries clears cached entries and sets the notice, with no unhandled rejection', async () => {
      const handle = {} as FileSystemDirectoryHandle
      const { worker, deps } = makeDeps({
        showDirectoryPicker: vi.fn().mockResolvedValue(handle),
        saveEntries: vi.fn().mockRejectedValue(new Error('QuotaExceededError')),
      })
      const store = createFileSearchStore(deps)
      await store.getState().init()
      await store.getState().selectFolder()
      worker.emit({ type: 'scan-complete', scanned: 0, skipped: 0, ignored: 0, entries: [] })
      await vi.advanceTimersByTimeAsync(0)

      expect(deps.clearEntries).toHaveBeenCalled()
      expect(store.getState().notice).toBe(NOTICE)
      expect(store.getState().status).toBe('ready')
    })

    it('a failing clearEntries after a failed save is also swallowed', async () => {
      const { worker, deps } = makeDeps({
        saveEntries: vi.fn().mockRejectedValue(new Error('quota')),
        clearEntries: vi.fn().mockRejectedValue(new Error('nope')),
      })
      const store = createFileSearchStore(deps)
      await store.getState().init()
      worker.emit({ type: 'scan-complete', scanned: 0, skipped: 0, ignored: 0, entries: [] })
      await vi.advanceTimersByTimeAsync(0)

      expect(store.getState().notice).toBe(NOTICE)
    })

    it('a failed saveRootHandle sets the notice but the scan still starts', async () => {
      const handle = {} as FileSystemDirectoryHandle
      const { worker, deps } = makeDeps({
        showDirectoryPicker: vi.fn().mockResolvedValue(handle),
        saveRootHandle: vi.fn().mockRejectedValue(new Error('quota')),
      })
      const store = createFileSearchStore(deps)
      await store.getState().init()
      await store.getState().selectFolder()

      expect(store.getState().notice).toBe(NOTICE)
      expect(worker.posted).toContainEqual(expect.objectContaining({ type: 'scan', root: handle }))
    })

    it('selecting a folder clears a previous notice', async () => {
      const handle = {} as FileSystemDirectoryHandle
      const { worker, deps } = makeDeps({
        showDirectoryPicker: vi.fn().mockResolvedValue(handle),
        saveEntries: vi.fn().mockRejectedValueOnce(new Error('quota')),
      })
      const store = createFileSearchStore(deps)
      await store.getState().init()
      await store.getState().selectFolder()
      worker.emit({ type: 'scan-complete', scanned: 0, skipped: 0, ignored: 0, entries: [] })
      await vi.advanceTimersByTimeAsync(0)
      expect(store.getState().notice).toBe(NOTICE)

      await store.getState().selectFolder()
      expect(store.getState().notice).toBeUndefined()
    })

    it('init with a granted handle but no saved entries re-scans instead of restoring', async () => {
      const handle = {} as FileSystemDirectoryHandle
      const { worker, deps } = makeDeps({
        loadRootHandle: vi.fn().mockResolvedValue(handle),
        loadEntries: vi.fn().mockResolvedValue(undefined),
      })
      const store = createFileSearchStore(deps)
      await store.getState().init()

      expect(worker.posted.some((m) => m.type === 'scan')).toBe(true)
      expect(worker.posted.some((m) => m.type === 'restore')).toBe(false)
      expect(store.getState().status).toBe('scanning')
    })

    it('init with a genuinely saved empty array still restores', async () => {
      const handle = {} as FileSystemDirectoryHandle
      const { worker, deps } = makeDeps({
        loadRootHandle: vi.fn().mockResolvedValue(handle),
        loadEntries: vi.fn().mockResolvedValue([]),
      })
      const store = createFileSearchStore(deps)
      await store.getState().init()

      expect(worker.posted).toContainEqual({ type: 'restore', entries: [] })
      expect(worker.posted.some((m) => m.type === 'scan')).toBe(false)
    })
  })

  describe('errors and retry [B3]', () => {
    const handle = {} as FileSystemDirectoryHandle

    it('an error message from the worker moves the store to the error status', async () => {
      const { worker, deps } = makeDeps()
      const store = createFileSearchStore(deps)
      await store.getState().init()
      worker.emit({ type: 'error', message: 'boom' })
      expect(store.getState()).toMatchObject({ status: 'error', error: 'boom' })
    })

    it('worker.onerror (crash / blocked script) moves the store to the error status', async () => {
      const { worker, deps } = makeDeps()
      const store = createFileSearchStore(deps)
      await store.getState().init()
      worker.crash()
      expect(store.getState()).toMatchObject({
        status: 'error',
        error: 'The search worker stopped unexpectedly.',
      })
    })

    it('retry() replaces the worker, terminates the old one, and re-scans on the new one', async () => {
      const { worker, latestWorker, deps } = makeDeps({ loadRootHandle: vi.fn().mockResolvedValue(handle) })
      const store = createFileSearchStore(deps)
      await store.getState().init()
      store.getState().setFilters({ query: 'keep' })
      worker.emit({ type: 'error', message: 'boom' })

      await store.getState().retry()

      const fresh = latestWorker()
      expect(fresh).not.toBe(worker)
      expect(worker.terminated).toBe(true)
      expect(fresh.posted).toContainEqual(expect.objectContaining({ type: 'scan', root: handle }))
      expect(store.getState()).toMatchObject({ status: 'scanning', error: undefined })
      expect(store.getState().filters.query).toBe('keep')
      // handlers are re-attached on the new worker
      fresh.emit({ type: 'error', message: 'again' })
      expect(store.getState().status).toBe('error')
    })

    it('retry() with permission needing a prompt goes to needs-permission', async () => {
      const { worker, deps } = makeDeps({
        loadRootHandle: vi.fn().mockResolvedValue(handle),
        loadEntries: vi.fn().mockResolvedValue([]),
      })
      const store = createFileSearchStore(deps)
      await store.getState().init()
      worker.emit({ type: 'error', message: 'boom' })
      vi.mocked(deps.checkPermission).mockResolvedValue('prompt')

      await store.getState().retry()
      expect(store.getState().status).toBe('needs-permission')
    })

    it('retry() with no root handle goes back to empty', async () => {
      const { worker, deps } = makeDeps()
      const store = createFileSearchStore(deps)
      await store.getState().init()
      worker.emit({ type: 'error', message: 'boom' })

      await store.getState().retry()
      expect(store.getState()).toMatchObject({ status: 'empty', error: undefined })
    })

    it('init() failing (storage or permission throws) lands in the error state', async () => {
      const { deps } = makeDeps({ loadRootHandle: vi.fn().mockRejectedValue(new Error('idb down')) })
      const store = createFileSearchStore(deps)
      await store.getState().init()
      expect(store.getState()).toMatchObject({ status: 'error', error: 'idb down' })
    })

    it('a non-abort showDirectoryPicker failure becomes an error state, not a rejection', async () => {
      const { deps } = makeDeps({ showDirectoryPicker: vi.fn().mockRejectedValue(new Error('picker broke')) })
      const store = createFileSearchStore(deps)
      await store.getState().init()
      await expect(store.getState().selectFolder()).resolves.toBeUndefined()
      expect(store.getState()).toMatchObject({ status: 'error', error: 'picker broke' })
    })

    it('resumeAccess() with requestPermission throwing stays needs-permission', async () => {
      const { deps } = makeDeps({
        loadRootHandle: vi.fn().mockResolvedValue(handle),
        checkPermission: vi.fn().mockResolvedValue('prompt'),
        requestPermission: vi.fn().mockRejectedValue(new Error('no gesture')),
      })
      const store = createFileSearchStore(deps)
      await store.getState().init()
      await expect(store.getState().resumeAccess()).resolves.toBeUndefined()
      expect(store.getState().status).toBe('needs-permission')
    })
  })
})
