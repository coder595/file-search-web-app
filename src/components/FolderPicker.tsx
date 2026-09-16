import { useFileSearchStore } from '../store/FileSearchStoreProvider'

export function FolderPicker() {
  const status = useFileSearchStore((s) => s.status)
  const progress = useFileSearchStore((s) => s.progress)
  const skippedFolders = useFileSearchStore((s) => s.skippedFolders)
  const selectFolder = useFileSearchStore((s) => s.selectFolder)
  const resumeAccess = useFileSearchStore((s) => s.resumeAccess)
  const refresh = useFileSearchStore((s) => s.refresh)

  const skippedNote = skippedFolders > 0 ? ` — ${skippedFolders} folders skipped (no permission)` : ''

  return (
    <div className="flex items-center gap-3">
      {status === 'empty' && (
        <button
          type="button"
          onClick={() => void selectFolder()}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Select Folder
        </button>
      )}

      {status === 'needs-permission' && (
        <button
          type="button"
          onClick={() => void resumeAccess()}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Resume access to folder
        </button>
      )}

      {status === 'scanning' && (
        <p className="text-sm text-gray-600">
          Scanned {progress.scanned.toLocaleString()} files…
        </p>
      )}

      {status === 'ready' && (
        <>
          <button
            type="button"
            onClick={() => void refresh()}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Refresh
          </button>
          <p className="text-sm text-gray-500">
            {progress.scanned.toLocaleString()} files{skippedNote}
          </p>
        </>
      )}
    </div>
  )
}
