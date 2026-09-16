import { useFileSearchStore } from '../store/FileSearchStoreProvider'

export function FolderPicker() {
  const status = useFileSearchStore((s) => s.status)
  const progress = useFileSearchStore((s) => s.progress)
  const skippedFolders = useFileSearchStore((s) => s.skippedFolders)
  const ignoredFolders = useFileSearchStore((s) => s.ignoredFolders)
  const selectFolder = useFileSearchStore((s) => s.selectFolder)
  const resumeAccess = useFileSearchStore((s) => s.resumeAccess)
  const refresh = useFileSearchStore((s) => s.refresh)

  const skippedNote = skippedFolders > 0 ? ` — ${skippedFolders} folders skipped (no permission)` : ''
  const ignoredNote = ignoredFolders > 0 ? ` — ${ignoredFolders} folders ignored` : ''

  return (
    <div className="flex items-center gap-3">
      {status === 'empty' && (
        <button
          type="button"
          onClick={() => void selectFolder()}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
        >
          Select Folder
        </button>
      )}

      {status === 'needs-permission' && (
        <button
          type="button"
          onClick={() => void resumeAccess()}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
        >
          Resume access to folder
        </button>
      )}

      {status === 'scanning' && (
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Scanned {progress.scanned.toLocaleString()} files…
        </p>
      )}

      {status === 'ready' && (
        <>
          <button
            type="button"
            onClick={() => void refresh()}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            Refresh
          </button>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {progress.scanned.toLocaleString()} files{skippedNote}{ignoredNote}
          </p>
        </>
      )}
    </div>
  )
}
