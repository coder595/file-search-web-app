import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { IndexEntry } from './types'

const store = new Map<string, unknown>()

vi.mock('idb-keyval', () => ({
  get: vi.fn((key: string) => Promise.resolve(store.get(key))),
  set: vi.fn((key: string, value: unknown) => {
    store.set(key, value)
    return Promise.resolve()
  }),
  del: vi.fn((key: string) => {
    store.delete(key)
    return Promise.resolve()
  }),
}))

import { clearCache, loadEntries, loadRootHandle, saveEntries, saveRootHandle } from './db'

describe('db (IndexedDB persistence layer)', () => {
  beforeEach(() => {
    store.clear()
  })

  it('round-trips the root directory handle', async () => {
    const handle = { kind: 'directory', name: 'root' } as unknown as FileSystemDirectoryHandle
    await saveRootHandle(handle)
    await expect(loadRootHandle()).resolves.toBe(handle)
  })

  it('returns undefined for the root handle when nothing was saved', async () => {
    await expect(loadRootHandle()).resolves.toBeUndefined()
  })

  it('round-trips the cached entry list', async () => {
    const entries: IndexEntry[] = [
      { id: '1', name: 'a.txt', path: 'a.txt', extension: 'txt', kind: 'file', size: 10, lastModified: 1 },
    ]
    await saveEntries(entries)
    await expect(loadEntries()).resolves.toEqual(entries)
  })

  it('returns undefined for entries when nothing was cached', async () => {
    await expect(loadEntries()).resolves.toBeUndefined()
  })

  it('clearCache removes both the root handle and the cached entries', async () => {
    const handle = { kind: 'directory', name: 'root' } as unknown as FileSystemDirectoryHandle
    await saveRootHandle(handle)
    await saveEntries([])
    await clearCache()
    await expect(loadRootHandle()).resolves.toBeUndefined()
    await expect(loadEntries()).resolves.toBeUndefined()
  })
})
