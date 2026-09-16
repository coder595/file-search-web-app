import { describe, expect, it } from 'vitest'
import { matchesFilters } from './filters'
import type { IndexEntry, QueryFilters } from '../lib/types'

const base: IndexEntry = {
  id: '1',
  name: 'invoice_2026_03.pdf',
  path: 'Documents/Invoices/2026/invoice_2026_03.pdf',
  extension: 'pdf',
  kind: 'file',
  size: 5000,
  lastModified: 1_700_000_000_000,
}

const noFilters: QueryFilters = { query: '', sort: 'name' }

describe('matchesFilters', () => {
  it('matches everything when no filters are set', () => {
    expect(matchesFilters(base, noFilters)).toBe(true)
  })

  it('filters by extension', () => {
    expect(matchesFilters(base, { ...noFilters, extension: 'pdf' })).toBe(true)
    expect(matchesFilters(base, { ...noFilters, extension: 'txt' })).toBe(false)
  })

  it('filters by minSize/maxSize range', () => {
    expect(matchesFilters(base, { ...noFilters, minSize: 1000, maxSize: 10000 })).toBe(true)
    expect(matchesFilters(base, { ...noFilters, minSize: 6000 })).toBe(false)
    expect(matchesFilters(base, { ...noFilters, maxSize: 4000 })).toBe(false)
  })

  it('filters by modifiedAfter/modifiedBefore range', () => {
    expect(matchesFilters(base, { ...noFilters, modifiedAfter: 1_600_000_000_000 })).toBe(true)
    expect(matchesFilters(base, { ...noFilters, modifiedAfter: 1_800_000_000_000 })).toBe(false)
    expect(matchesFilters(base, { ...noFilters, modifiedBefore: 1_600_000_000_000 })).toBe(false)
  })

  it('filters by kind (files-only/folders-only)', () => {
    expect(matchesFilters(base, { ...noFilters, kind: 'file' })).toBe(true)
    expect(matchesFilters(base, { ...noFilters, kind: 'directory' })).toBe(false)
  })

  it('combines all filters with AND', () => {
    expect(
      matchesFilters(base, { ...noFilters, extension: 'pdf', minSize: 1000, kind: 'file' }),
    ).toBe(true)
    expect(
      matchesFilters(base, { ...noFilters, extension: 'txt', minSize: 1000, kind: 'file' }),
    ).toBe(false)
  })
})
