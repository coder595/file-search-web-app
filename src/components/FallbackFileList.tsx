import { directoryOpen } from 'browser-fs-access'
import { useMemo, useRef, useState } from 'react'
import { useFocusShortcut } from '../lib/useFocusShortcut'
import { filesToEntries } from '../lib/fallbackIngest'
import type { IndexEntry } from '../lib/types'
import { matchesFilters } from '../workers/filters'
import { parseQuery } from '../workers/queryParse'
import { SearchIndex } from '../workers/searchIndex'
import { sortEntries } from '../workers/sort'
import { VirtualizedEntryTable } from './VirtualizedEntryTable'

/**
 * Read-only, session-only listing for Firefox/Safari (plan.md Section 4):
 * no persistent handle, no IndexedDB caching, no worker — everything here
 * lives in component state for this browser tab session only.
 */
function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError'
}

export function FallbackFileList() {
  const [entries, setEntries] = useState<IndexEntry[]>([])
  const [query, setQuery] = useState('')
  const [scanning, setScanning] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  useFocusShortcut('/', inputRef)

  const searchIndex = useMemo(() => {
    const index = new SearchIndex()
    for (const entry of entries) index.add(entry)
    return index
  }, [entries])

  const results = useMemo(() => {
    const parsed = parseQuery(query)
    const matched = searchIndex
      .search(parsed.text)
      .filter((entry) => matchesFilters(entry, { query, extension: parsed.extension, sort: 'name' }))
    return sortEntries(matched, 'name')
  }, [searchIndex, query])

  async function pickFolder() {
    setScanning(true)
    try {
      const files = await directoryOpen({ recursive: true })
      setEntries(filesToEntries(files as File[]))
    } catch (err) {
      if (!isAbortError(err)) throw err
    } finally {
      setScanning(false)
    }
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void pickFolder()}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
        >
          Select Folder (read-only)
        </button>
        {scanning && <p className="text-sm text-gray-600 dark:text-gray-300">Scanning…</p>}
        {!scanning && entries.length > 0 && (
          <input
            ref={inputRef}
            role="searchbox"
            type="search"
            value={query}
            placeholder="Search files by name"
            onChange={(e) => setQuery(e.target.value)}
            className="w-full max-w-sm rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-400"
          />
        )}
      </div>
      <div className="min-h-0 flex-1">
        {entries.length > 0 && <VirtualizedEntryTable entries={results} />}
      </div>
    </div>
  )
}
