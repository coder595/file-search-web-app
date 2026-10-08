import { useEffect, useMemo, type ReactNode } from 'react'
import { createFileSearchStore, defaultFileSearchDeps, type FileSearchDeps } from './fileSearchStore'
import { FileSearchStoreContext } from './useFileSearchStore'

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
