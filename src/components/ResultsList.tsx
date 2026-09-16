import { useFileSearchStore } from '../store/FileSearchStoreProvider'
import { VirtualizedEntryTable } from './VirtualizedEntryTable'

export function ResultsList() {
  const results = useFileSearchStore((s) => s.results)
  return <VirtualizedEntryTable entries={results} />
}
