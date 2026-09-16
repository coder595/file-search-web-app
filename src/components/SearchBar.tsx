import { useRef } from 'react'
import { useFocusShortcut } from '../lib/useFocusShortcut'
import { useFileSearchStore } from '../store/FileSearchStoreProvider'

export function SearchBar() {
  const query = useFileSearchStore((s) => s.filters.query)
  const setFilters = useFileSearchStore((s) => s.setFilters)
  const inputRef = useRef<HTMLInputElement>(null)
  useFocusShortcut('/', inputRef)

  return (
    <input
      ref={inputRef}
      role="searchbox"
      type="search"
      value={query}
      placeholder="Search files by name (ext:pdf or .pdf to filter by extension)"
      onChange={(e) => setFilters({ query: e.target.value })}
      className="w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-400"
    />
  )
}
