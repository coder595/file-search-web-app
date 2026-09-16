import { Index } from 'flexsearch'
import type { IndexEntry } from '../lib/types'

/** Wraps a FlexSearch Index over entry names, keyed by IndexEntry.id. */
export class SearchIndex {
  private index = new Index({ tokenize: 'forward' })
  private entries = new Map<string, IndexEntry>()

  add(entry: IndexEntry): void {
    this.entries.set(entry.id, entry)
    this.index.add(entry.id, entry.name)
  }

  remove(id: string): void {
    this.entries.delete(id)
    this.index.remove(id)
  }

  clear(): void {
    this.entries.clear()
    this.index = new Index({ tokenize: 'forward' })
  }

  get size(): number {
    return this.entries.size
  }

  values(): IndexEntry[] {
    return [...this.entries.values()]
  }

  /** Case-insensitive substring match; multi-word queries use AND semantics. */
  search(text: string, options?: { fuzzy?: boolean }): IndexEntry[] {
    if (!text.trim()) return [...this.entries.values()]

    const terms = text.trim().split(/\s+/)
    const resultSets = terms.map((term) => {
      const ids = this.index.search(term, { suggest: options?.fuzzy ?? false }) as string[]
      return new Set(ids)
    })
    const [first, ...rest] = resultSets
    const intersection = rest.reduce((acc, set) => new Set([...acc].filter((id) => set.has(id))), first)

    return [...intersection]
      .map((id) => this.entries.get(id))
      .filter((e): e is IndexEntry => e !== undefined)
  }
}
