import { isFileSystemAccessSupported } from './lib/browserSupport'
import { FallbackFileList } from './components/FallbackFileList'
import { FiltersPanel } from './components/FiltersPanel'
import { FolderPicker } from './components/FolderPicker'
import { ResultsList } from './components/ResultsList'
import { SearchBar } from './components/SearchBar'
import { UnsupportedBanner } from './components/UnsupportedBanner'
import { FileSearchStoreProvider } from './store/FileSearchStoreProvider'
import type { FileSearchDeps } from './store/fileSearchStore'

function App({ deps }: { deps?: FileSearchDeps } = {}) {
  const supported = isFileSystemAccessSupported()

  return (
    <div className="flex h-full min-h-full flex-col">
      {!supported && <UnsupportedBanner />}
      <header className="border-b border-gray-200 px-6 py-4">
        <h1 className="text-xl font-semibold text-gray-900">File Search</h1>
      </header>
      <main className="flex min-h-0 flex-1 flex-col gap-4 px-6 py-4">
        {supported ? (
          <FileSearchStoreProvider deps={deps}>
            <FolderPicker />
            <SearchBar />
            <FiltersPanel />
            <div className="min-h-0 flex-1">
              <ResultsList />
            </div>
          </FileSearchStoreProvider>
        ) : (
          <FallbackFileList />
        )}
      </main>
    </div>
  )
}

export default App
