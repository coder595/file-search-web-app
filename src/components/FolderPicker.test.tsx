import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { FileSearchStoreProvider } from '../store/FileSearchStoreProvider'
import { makeFakeDeps } from '../test/fakeFileSearchDeps'
import { FolderPicker } from './FolderPicker'

describe('FolderPicker', () => {
  it('shows a Select Folder button in the empty state', async () => {
    const { deps } = makeFakeDeps()
    render(
      <FileSearchStoreProvider deps={deps}>
        <FolderPicker />
      </FileSearchStoreProvider>,
    )
    expect(await screen.findByRole('button', { name: /select folder/i })).toBeInTheDocument()
  })

  it('clicking Select Folder opens the native picker and starts scanning', async () => {
    const handle = {} as FileSystemDirectoryHandle
    const { deps, worker } = makeFakeDeps({ showDirectoryPicker: async () => handle })
    render(
      <FileSearchStoreProvider deps={deps}>
        <FolderPicker />
      </FileSearchStoreProvider>,
    )
    await userEvent.click(await screen.findByRole('button', { name: /select folder/i }))

    await waitFor(() =>
      expect(worker.posted).toContainEqual(expect.objectContaining({ type: 'scan', root: handle })),
    )
    expect(await screen.findByText(/scanned/i)).toBeInTheDocument()
  })

  it('shows a Resume access button when a cached folder needs permission re-grant', async () => {
    const { deps } = makeFakeDeps({
      loadRootHandle: async () => ({}) as FileSystemDirectoryHandle,
      checkPermission: async () => 'prompt',
    })
    render(
      <FileSearchStoreProvider deps={deps}>
        <FolderPicker />
      </FileSearchStoreProvider>,
    )
    expect(await screen.findByRole('button', { name: /resume access/i })).toBeInTheDocument()
  })

  it('shows a Refresh button once ready, and clicking it forces a re-scan', async () => {
    const handle = {} as FileSystemDirectoryHandle
    const { deps, worker } = makeFakeDeps({ loadRootHandle: async () => handle, loadEntries: async () => [] })
    render(
      <FileSearchStoreProvider deps={deps}>
        <FolderPicker />
      </FileSearchStoreProvider>,
    )
    await screen.findByText(/restoring/i)
    act(() => worker.emit({ type: 'restore-complete', count: 0 }))
    const refreshButton = await screen.findByRole('button', { name: /refresh/i })
    worker.posted.length = 0
    await userEvent.click(refreshButton)

    await waitFor(() =>
      expect(worker.posted).toContainEqual(expect.objectContaining({ type: 'scan', root: handle })),
    )
  })

  it('shows a skipped-folders note when some subfolders were inaccessible', async () => {
    const handle = {} as FileSystemDirectoryHandle
    const { deps, worker } = makeFakeDeps({ showDirectoryPicker: async () => handle })
    render(
      <FileSearchStoreProvider deps={deps}>
        <FolderPicker />
      </FileSearchStoreProvider>,
    )
    await userEvent.click(await screen.findByRole('button', { name: /select folder/i }))
    worker.emit({ type: 'scan-complete', scanned: 5, skipped: 2, ignored: 0, entries: [] })

    expect(await screen.findByText(/2 folders skipped/i)).toBeInTheDocument()
  })

  it('shows an ignored-folders note, distinct from the skipped-folders note', async () => {
    const handle = {} as FileSystemDirectoryHandle
    const { deps, worker } = makeFakeDeps({ showDirectoryPicker: async () => handle })
    render(
      <FileSearchStoreProvider deps={deps}>
        <FolderPicker />
      </FileSearchStoreProvider>,
    )
    await userEvent.click(await screen.findByRole('button', { name: /select folder/i }))
    worker.emit({ type: 'scan-complete', scanned: 5, skipped: 0, ignored: 3, entries: [] })

    expect(await screen.findByText(/3 folders ignored/i)).toBeInTheDocument()
    expect(screen.queryByText(/folders skipped/i)).not.toBeInTheDocument()
  })

  it('shows the storage notice as a status message when set', async () => {
    const handle = {} as FileSystemDirectoryHandle
    const { deps } = makeFakeDeps({
      showDirectoryPicker: async () => handle,
      saveRootHandle: async () => {
        throw Object.assign(new Error('full'), { name: 'QuotaExceededError' })
      },
    })
    render(
      <FileSearchStoreProvider deps={deps}>
        <FolderPicker />
      </FileSearchStoreProvider>,
    )
    await userEvent.click(await screen.findByRole('button', { name: /select folder/i }))

    expect(await screen.findByText(/browser storage is full/i)).toBe(screen.getByRole('status'))
    expect(screen.getAllByRole('status')).toHaveLength(1)
  })

  it('shows the error as an alert with a Retry button that calls retry()', async () => {
    const handle = {} as FileSystemDirectoryHandle
    const { deps, worker, latestWorker } = makeFakeDeps({
      loadRootHandle: async () => handle,
      loadEntries: async () => [],
    })
    render(
      <FileSearchStoreProvider deps={deps}>
        <FolderPicker />
      </FileSearchStoreProvider>,
    )
    await screen.findByText(/restoring/i)
    act(() => worker.emit({ type: 'restore-complete', count: 0 }))
    await screen.findByRole('button', { name: /refresh/i })
    act(() => worker.emit({ type: 'error', message: 'Folder vanished' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Folder vanished')
    await userEvent.click(screen.getByRole('button', { name: /retry/i }))
    expect(document.activeElement).not.toBe(document.body)
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())

    await waitFor(() =>
      expect(latestWorker().posted).toContainEqual(expect.objectContaining({ type: 'scan', root: handle })),
    )
  })

  it('shows restoring progress text with the cached entry count', async () => {
    const entries = Array.from({ length: 1234 }, (_, n) => ({
      id: String(n), name: `f${n}`, path: `f${n}`, extension: '', kind: 'file' as const, size: 1, lastModified: 1,
    }))
    const { deps } = makeFakeDeps({
      loadRootHandle: async () => ({}) as FileSystemDirectoryHandle,
      loadEntries: async () => entries,
    })
    render(
      <FileSearchStoreProvider deps={deps}>
        <FolderPicker />
      </FileSearchStoreProvider>,
    )
    expect(await screen.findByText(/Restoring 1,234 cached entries…/)).toBeInTheDocument()
  })

  it('announces progress through one persistent status region, not a mounted-late one', async () => {
    const { deps } = makeFakeDeps()
    render(
      <FileSearchStoreProvider deps={deps}>
        <FolderPicker />
      </FileSearchStoreProvider>,
    )
    const region = await screen.findByRole('status')
    await userEvent.click(await screen.findByRole('button', { name: /select folder/i }))
    expect(await screen.findByText(/scanned/i)).toBe(region)
    expect(region).toHaveAttribute('aria-atomic', 'true')
    expect(screen.getAllByRole('status')).toHaveLength(1)
  })

  it('keeps focus inside the picker after Select Folder unmounts', async () => {
    const { deps } = makeFakeDeps({ showDirectoryPicker: async () => ({}) as FileSystemDirectoryHandle })
    render(
      <FileSearchStoreProvider deps={deps}>
        <FolderPicker />
      </FileSearchStoreProvider>,
    )
    await userEvent.click(await screen.findByRole('button', { name: /select folder/i }))
    await screen.findByText(/scanned/i)
    expect(document.activeElement).not.toBe(document.body)
  })
})
