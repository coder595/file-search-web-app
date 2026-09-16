import type { IndexEntry, QueryFilters } from '../lib/types'
import { matchesFilters } from './filters'
import { parseQuery } from './queryParse'
import { SearchIndex } from './searchIndex'
import { sortEntries } from './sort'
import { walkDirectory } from './walk'

export type WorkerOutMessage =
  | { type: 'progress'; scanned: number; skipped: number }
  | { type: 'scan-complete'; scanned: number; skipped: number; ignored: number; entries: IndexEntry[] }
  | { type: 'query-result'; entries: IndexEntry[] }

const PROGRESS_BATCH_SIZE = 200

/**
 * Owns the in-worker FlexSearch index and the directory walk. A single
 * instance serves both scanning and querying (Section 5's worker concurrency
 * design): the walk yields in batches so query messages are always handled
 * between batches, and a generation counter lets a new scan() call cleanly
 * supersede an in-flight one without corrupting the shared index.
 */
export class ScanController {
  private searchIndex = new SearchIndex()
  private generation = 0
  private post: (msg: WorkerOutMessage) => void

  constructor(post: (msg: WorkerOutMessage) => void) {
    this.post = post
  }

  async scan(root: FileSystemDirectoryHandle, ignoreNames?: Set<string>): Promise<void> {
    const myGeneration = ++this.generation
    this.searchIndex.clear()

    let scanned = 0
    let skipped = 0
    let ignored = 0
    let sinceYield = 0

    for await (const event of walkDirectory(root, '', ignoreNames)) {
      if (myGeneration !== this.generation) return // superseded by a newer scan

      if (event.type === 'entry') {
        this.searchIndex.add(event.entry)
        scanned++
      } else if (event.type === 'skipped') {
        skipped++
      } else {
        ignored++
      }

      if (++sinceYield >= PROGRESS_BATCH_SIZE) {
        sinceYield = 0
        this.post({ type: 'progress', scanned, skipped })
        await Promise.resolve()
      }
    }

    if (myGeneration !== this.generation) return
    this.post({ type: 'scan-complete', scanned, skipped, ignored, entries: this.searchIndex.values() })
  }

  /**
   * Loads previously-cached entries straight into the search index, with no
   * directory walk — used to make a persisted session "instant" on reload
   * (Section 5/8): rebuild in memory instead of re-scanning disk.
   */
  restore(entries: IndexEntry[]): void {
    this.generation++
    this.searchIndex.clear()
    for (const entry of entries) this.searchIndex.add(entry)
  }

  /** Search + filter + sort, all here so the UI never duplicates match logic. */
  query(filters: QueryFilters): void {
    const parsed = parseQuery(filters.query)
    const effective: QueryFilters = { ...filters, extension: filters.extension ?? parsed.extension }
    const matched = this.searchIndex
      .search(parsed.text, { fuzzy: filters.fuzzy })
      .filter((entry) => matchesFilters(entry, effective))
    this.post({ type: 'query-result', entries: sortEntries(matched, filters.sort) })
  }
}
