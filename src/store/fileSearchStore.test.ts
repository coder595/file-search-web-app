import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { IndexEntry, QueryFilters } from '../lib/types'
import { makeFakeDeps as makeDeps } from '../test/fakeFileSearchDeps'
import { createFileSearchStore } from './fileSearchStore'

describe('createFileSearchStore', () => {
  beforeEach(() => {
    vi.useFakeTimers()
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
    expect(worker.posted).toContainEqual({ type: 'scan', root: handle })
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

    worker.emit({ type: 'scan-complete', scanned: 1, skipped: 2, entries })

    expect(store.getState().status).toBe('ready')
    expect(store.getState().skippedFolders).toBe(2)
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
    const { worker, deps } = makeDeps({ loadRootHandle: vi.fn().mockResolvedValue(handle) })
    const store = createFileSearchStore(deps)
    await store.getState().init()
    worker.posted.length = 0

    await store.getState().refresh()

    expect(worker.posted).toContainEqual({ type: 'scan', root: handle })
    expect(store.getState().status).toBe('scanning')
  })
})
