import type { IndexEntry, SortKey } from '../lib/types'

/**
 * Sorts a copy of `entries` by `sort`. "relevance" preserves the input order
 * since FlexSearch has already ranked it by match quality.
 */
export function sortEntries(entries: IndexEntry[], sort: SortKey): IndexEntry[] {
  if (sort === 'relevance') return [...entries]

  const copy = [...entries]
  switch (sort) {
    case 'name':
      return copy.sort((a, b) => a.name.localeCompare(b.name))
    case 'size':
      return copy.sort((a, b) => a.size - b.size)
    case 'lastModified':
      return copy.sort((a, b) => b.lastModified - a.lastModified)
  }
}
