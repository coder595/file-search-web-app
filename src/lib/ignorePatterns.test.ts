import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_IGNORE_PATTERNS, readStoredIgnorePatterns, saveIgnorePatterns } from './ignorePatterns'

describe('ignorePatterns persistence', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('falls back to the default list when nothing is stored', () => {
    expect(readStoredIgnorePatterns()).toEqual(DEFAULT_IGNORE_PATTERNS)
  })

  it('saveIgnorePatterns persists a custom list, read back verbatim', () => {
    saveIgnorePatterns(['node_modules', 'my-cache'])
    expect(readStoredIgnorePatterns()).toEqual(['node_modules', 'my-cache'])
  })

  it('an empty saved list round-trips as empty, not falling back to the default', () => {
    saveIgnorePatterns([])
    expect(readStoredIgnorePatterns()).toEqual([])
  })

  it('falls back to the default list instead of throwing when the stored value is corrupted', () => {
    localStorage.setItem('file-search:ignore-patterns', 'not valid json{{{')
    expect(readStoredIgnorePatterns()).toEqual(DEFAULT_IGNORE_PATTERNS)
  })

  it('falls back to the default list when the stored value parses but is not an array', () => {
    localStorage.setItem('file-search:ignore-patterns', JSON.stringify({ oops: true }))
    expect(readStoredIgnorePatterns()).toEqual(DEFAULT_IGNORE_PATTERNS)
  })
})
