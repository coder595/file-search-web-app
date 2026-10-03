import { useContext, useRef, useState } from 'react'
import { FileSearchStoreContext, useFileSearchStore } from '../store/useFileSearchStore'

export function FolderPicker() {
  const status = useFileSearchStore((s) => s.status)
  const progress = useFileSearchStore((s) => s.progress)
  const skippedFolders = useFileSearchStore((s) => s.skippedFolders)
  const ignoredFolders = useFileSearchStore((s) => s.ignoredFolders)
  const selectFolder = useFileSearchStore((s) => s.selectFolder)
  const resumeAccess = useFileSearchStore((s) => s.resumeAccess)
  const restoringCount = useFileSearchStore((s) => s.restoringCount)
  const error = useFileSearchStore((s) => s.error)
  const retry = useFileSearchStore((s) => s.retry)
  const notice = useFileSearchStore((s) => s.notice)
  const refresh = useFileSearchStore((s) => s.refresh)

  // The clicked button unmounts when status changes; park focus on the wrapper
  // (before awaiting) so it doesn't fall back to <body> (WCAG 2.4.3).
  const wrapperRef = useRef<HTMLDivElement>(null)
  const selectRef = useRef<HTMLButtonElement>(null)
  const store = useContext(FileSearchStoreContext)
  const keepFocus = (action: () => Promise<void>) => () => {
    wrapperRef.current?.focus()
    void action().then(() => {
      // Picker cancelled: status unchanged, so give focus back to the button.
      if (store?.getState().status === 'empty') selectRef.current?.focus()
    })
  }

  // Screen readers hear transitions only ("Scanning…", "Scan complete: N files."),
  // never per-batch progress ticks.
  const [announce, setAnnounce] = useState('')
  const [prevStatus, setPrevStatus] = useState(status)
  if (prevStatus !== status) {
    setPrevStatus(status)
    setAnnounce(
      status === 'scanning'
        ? 'Scanning…'
        : status === 'restoring'
          ? 'Restoring…'
          : status === 'ready' && prevStatus === 'scanning'
            ? `Scan complete: ${progress.scanned.toLocaleString()} files.`
            : '',
    )
  }

  const progressText =
    status === 'scanning'
      ? `Scanned ${progress.scanned.toLocaleString()} files…`
      : status === 'restoring'
        ? `Restoring ${restoringCount.toLocaleString()} cached entries…`
        : ''

  const skippedNote = skippedFolders > 0 ? ` — ${skippedFolders} folders skipped (no permission)` : ''
  const ignoredNote = ignoredFolders > 0 ? ` — ${ignoredFolders} folders ignored` : ''

  return (
    <div ref={wrapperRef} tabIndex={-1} className="flex items-center gap-3 outline-none">
      {status === 'empty' && (
        <button
          ref={selectRef}
          type="button"
          onClick={keepFocus(selectFolder)}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700"
        >
          Select Folder
        </button>
      )}

      {status === 'needs-permission' && (
        <button
          type="button"
          onClick={keepFocus(resumeAccess)}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700"
        >
          Resume access to folder
        </button>
      )}

      {status === 'ready' && (
        <>
          <button
            type="button"
            onClick={keepFocus(refresh)}
            className="rounded border border-gray-500 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-500 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            Refresh
          </button>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {progress.scanned.toLocaleString()} files{skippedNote}{ignoredNote}
          </p>
        </>
      )}
      {status === 'error' && (
        <>
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>
          <button
            type="button"
            onClick={keepFocus(retry)}
            className="rounded border border-gray-500 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-500 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            Retry
          </button>
        </>
      )}

      {progressText && <p className="text-sm text-gray-600 dark:text-gray-300">{progressText}</p>}
      <p role="status" aria-atomic="true" className="sr-only">
        {announce}
      </p>
      <p role="status" className="text-sm text-amber-700 dark:text-amber-400">
        {notice}
      </p>
    </div>
  )
}
