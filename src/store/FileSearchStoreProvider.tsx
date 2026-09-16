import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react'
import { useStore } from 'zustand'
import type { StoreApi } from 'zustand/vanilla'
import { createFileSearchStore, defaultFileSearchDeps, type FileSearchDeps, type FileSearchState } from './fileSearchStore'

const FileSearchStoreContext = createContext<StoreApi<FileSearchState> | null>(null)

/**
 * Provides one shared store instance to the component tree. Defaults to the
 * real browser dependencies; tests inject fakes via `deps` so components can
 * be tested without a real Worker/IndexedDB/File System Access API.
 */
export function FileSearchStoreProvider({
  children,
  deps = defaultFileSearchDeps,
}: {
  children: ReactNode
  deps?: FileSearchDeps
}) {
  const store = useMemo(() => createFileSearchStore(deps), [deps])
  useEffect(() => {
    void store.getState().init()
  }, [store])
  return <FileSearchStoreContext.Provider value={store}>{children}</FileSearchStoreContext.Provider>
}

export function useFileSearchStore<T>(selector: (state: FileSearchState) => T): T {
  const store = useContext(FileSearchStoreContext)
  if (!store) {
    throw new Error('useFileSearchStore must be used within a FileSearchStoreProvider')
  }
  return useStore(store, selector)
}
