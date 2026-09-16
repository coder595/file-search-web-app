import type { IndexEntry, QueryFilters } from '../lib/types'

export function matchesFilters(entry: IndexEntry, filters: QueryFilters): boolean {
  if (filters.extension && entry.extension !== filters.extension) return false
  if (filters.minSize !== undefined && entry.size < filters.minSize) return false
  if (filters.maxSize !== undefined && entry.size > filters.maxSize) return false
  if (filters.modifiedAfter !== undefined && entry.lastModified < filters.modifiedAfter) return false
  if (filters.modifiedBefore !== undefined && entry.lastModified > filters.modifiedBefore) return false
  if (filters.kind && entry.kind !== filters.kind) return false
  return true
}
