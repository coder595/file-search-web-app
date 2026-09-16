import { beforeEach, describe, expect, it } from 'vitest'
import { SearchIndex } from './searchIndex'
import type { IndexEntry } from '../lib/types'

function entry(name: string, id = name): IndexEntry {
  return { id, name, path: name, extension: '', kind: 'file', size: 0, lastModified: 0 }
}

describe('SearchIndex', () => {
  let index: SearchIndex

  beforeEach(() => {
    index = new SearchIndex()
  })

  it('returns all added entries for an empty query', () => {
    index.add(entry('invoice_2026_03.pdf'))
    index.add(entry('report.docx'))
    expect(index.search('').map((e) => e.name).sort()).toEqual([
      'invoice_2026_03.pdf',
      'report.docx',
    ])
  })

  it('matches by case-insensitive substring', () => {
    index.add(entry('Invoice_2026_03.pdf'))
    index.add(entry('report.docx'))
    expect(index.search('invoice').map((e) => e.name)).toEqual(['Invoice_2026_03.pdf'])
  })

  it('matches multiple terms with AND semantics', () => {
    index.add(entry('invoice_2026_march.pdf'))
    index.add(entry('invoice_2025_march.pdf'))
    index.add(entry('report_2026.docx'))
    expect(index.search('invoice 2026').map((e) => e.name)).toEqual(['invoice_2026_march.pdf'])
  })

  it('returns nothing for a query that matches no entry', () => {
    index.add(entry('invoice.pdf'))
    expect(index.search('zzz-no-match')).toEqual([])
  })

  it('removes an entry so it no longer matches', () => {
    index.add(entry('invoice.pdf'))
    index.remove('invoice.pdf')
    expect(index.search('invoice')).toEqual([])
    expect(index.search('')).toEqual([])
  })

  it('clear() empties the index', () => {
    index.add(entry('invoice.pdf'))
    index.clear()
    expect(index.search('')).toEqual([])
    expect(index.size).toBe(0)
  })
})
