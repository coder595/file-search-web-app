import { createContext, useContext } from 'react'
import { useStore } from 'zustand'
import type { StoreApi } from 'zustand/vanilla'
import type { FileSearchState } from './fileSearchStore'

export const FileSearchStoreContext = createContext<StoreApi<FileSearchState> | null>(null)

export function useFileSearchStore<T>(selector: (state: FileSearchState) => T): T {
  const store = useContext(FileSearchStoreContext)
  if (!store) {
    throw new Error('useFileSearchStore must be used within a FileSearchStoreProvider')
  }
  return useStore(store, selector)
}
