import { useFileSearchStore } from '../store/useFileSearchStore'
import { VirtualizedEntryTable } from './VirtualizedEntryTable'

export function ResultsList() {
  const results = useFileSearchStore((s) => s.results)
  const status = useFileSearchStore((s) => s.status)

  if (status === 'empty' && results.length === 0) {
    return (
      <p className="p-4 text-sm text-gray-600 dark:text-gray-300">
        Select a folder to search its files. Nothing leaves your computer.
      </p>
    )
  }
  return <VirtualizedEntryTable entries={results} />
}
