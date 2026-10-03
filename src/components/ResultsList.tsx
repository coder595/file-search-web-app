import { useFileSearchStore } from '../store/useFileSearchStore'
import { VirtualizedEntryTable } from './VirtualizedEntryTable'

export function ResultsList() {
  const results = useFileSearchStore((s) => s.results)
  return <VirtualizedEntryTable entries={results} />
}
