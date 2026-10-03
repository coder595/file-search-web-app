import { useRef } from 'react'
import { useFocusShortcut } from '../lib/useFocusShortcut'
import { useFileSearchStore } from '../store/useFileSearchStore'

export function SearchBar() {
  const query = useFileSearchStore((s) => s.filters.query)
  const setFilters = useFileSearchStore((s) => s.setFilters)
  const inputRef = useRef<HTMLInputElement>(null)
  useFocusShortcut('/', inputRef)

  return (
    <input
      ref={inputRef}
      aria-label="Search files by name"
      type="search"
      value={query}
      placeholder="Search by name (try ext:pdf)"
      onChange={(e) => setFilters({ query: e.target.value })}
      className="w-full rounded border border-gray-500 px-3 py-2 text-sm dark:border-gray-500 dark:bg-gray-800 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
    />
  )
}
