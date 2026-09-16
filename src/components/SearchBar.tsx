import { useFileSearchStore } from '../store/FileSearchStoreProvider'

export function SearchBar() {
  const query = useFileSearchStore((s) => s.filters.query)
  const setFilters = useFileSearchStore((s) => s.setFilters)

  return (
    <input
      role="searchbox"
      type="search"
      value={query}
      placeholder="Search files by name (ext:pdf or .pdf to filter by extension)"
      onChange={(e) => setFilters({ query: e.target.value })}
      className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
    />
  )
}
