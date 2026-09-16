export interface IndexEntry {
  /** stable id (path hash) */
  id: string
  name: string
  path: string
  extension: string
  kind: 'file' | 'directory'
  /** bytes; 0 for directories */
  size: number
  /** epoch ms */
  lastModified: number
  /**
   * Phase 1: always undefined. Chrome/Edge entries never populate it (no
   * feature reads it back after the walk); the fallback path (Firefox/Safari)
   * has no FileSystemHandle at all. Reserved for Phase 2 preview.
   */
  handle?: FileSystemFileHandle | FileSystemDirectoryHandle
}

export type SortKey = 'name' | 'size' | 'lastModified' | 'relevance'

export interface QueryFilters {
  query: string
  extension?: string
  minSize?: number
  maxSize?: number
  modifiedAfter?: number
  modifiedBefore?: number
  kind?: 'file' | 'directory'
  fuzzy?: boolean
  sort: SortKey
}
