import { describe, expect, it } from 'vitest'
import { parseQuery } from './queryParse'

describe('parseQuery', () => {
  it('returns the query unchanged when there is no extension shorthand', () => {
    expect(parseQuery('invoice 2026')).toEqual({ text: 'invoice 2026', extension: undefined })
  })

  it('parses ext:pdf shorthand and strips it from the text', () => {
    expect(parseQuery('ext:pdf invoice')).toEqual({ text: 'invoice', extension: 'pdf' })
  })

  it('parses .pdf shorthand and strips it from the text', () => {
    expect(parseQuery('.pdf invoice')).toEqual({ text: 'invoice', extension: 'pdf' })
  })

  it('is case-insensitive for the ext: shorthand keyword', () => {
    expect(parseQuery('EXT:PDF invoice')).toEqual({ text: 'invoice', extension: 'pdf' })
  })

  it('handles the shorthand alone with no other text', () => {
    expect(parseQuery('ext:pdf')).toEqual({ text: '', extension: 'pdf' })
  })

  it('trims extra whitespace left after stripping the shorthand', () => {
    expect(parseQuery('  ext:pdf   invoice   2026  ')).toEqual({ text: 'invoice 2026', extension: 'pdf' })
  })
})
