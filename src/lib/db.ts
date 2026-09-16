import { del, get, set } from 'idb-keyval'
import type { IndexEntry } from './types'

const ROOT_HANDLE_KEY = 'file-search:root-handle'
const ENTRIES_KEY = 'file-search:entries'

export function saveRootHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  return set(ROOT_HANDLE_KEY, handle)
}

export function loadRootHandle(): Promise<FileSystemDirectoryHandle | undefined> {
  return get(ROOT_HANDLE_KEY)
}

export function saveEntries(entries: IndexEntry[]): Promise<void> {
  return set(ENTRIES_KEY, entries)
}

export function loadEntries(): Promise<IndexEntry[] | undefined> {
  return get(ENTRIES_KEY)
}

/** Clears the persisted folder + cache, e.g. when the user picks a new folder. */
export async function clearCache(): Promise<void> {
  await Promise.all([del(ROOT_HANDLE_KEY), del(ENTRIES_KEY)])
}
