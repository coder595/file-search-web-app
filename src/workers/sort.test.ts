import { describe, expect, it } from 'vitest'
import { sortEntries } from './sort'
import type { IndexEntry } from '../lib/types'

function entry(overrides: Partial<IndexEntry>): IndexEntry {
  return {
    id: overrides.name ?? 'x',
    name: 'x',
    path: 'x',
    extension: '',
    kind: 'file',
    size: 0,
    lastModified: 0,
    ...overrides,
  }
}

const entries: IndexEntry[] = [
  entry({ name: 'banana.txt', size: 300, lastModified: 200 }),
  entry({ name: 'apple.txt', size: 100, lastModified: 300 }),
  entry({ name: 'cherry.txt', size: 200, lastModified: 100 }),
]

describe('sortEntries', () => {
  it('sorts by name ascending, case-insensitive', () => {
    expect(sortEntries(entries, 'name').map((e) => e.name)).toEqual([
      'apple.txt',
      'banana.txt',
      'cherry.txt',
    ])
  })

  it('sorts by size ascending', () => {
    expect(sortEntries(entries, 'size').map((e) => e.name)).toEqual([
      'apple.txt',
      'cherry.txt',
      'banana.txt',
    ])
  })

  it('sorts by lastModified descending (most recent first)', () => {
    expect(sortEntries(entries, 'lastModified').map((e) => e.name)).toEqual([
      'apple.txt',
      'banana.txt',
      'cherry.txt',
    ])
  })

  it('relevance sort preserves input order (FlexSearch already ranked it)', () => {
    expect(sortEntries(entries, 'relevance').map((e) => e.name)).toEqual([
      'banana.txt',
      'apple.txt',
      'cherry.txt',
    ])
  })

  it('does not mutate the input array', () => {
    const copy = [...entries]
    sortEntries(entries, 'name')
    expect(entries).toEqual(copy)
  })
})
