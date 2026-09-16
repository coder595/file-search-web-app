import { render, screen, waitFor } from '@testing-library/react'
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

    await waitFor(() => expect(worker.posted).toContainEqual({ type: 'scan', root: handle }))
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
    const { deps, worker } = makeFakeDeps({ loadRootHandle: async () => handle })
    render(
      <FileSearchStoreProvider deps={deps}>
        <FolderPicker />
      </FileSearchStoreProvider>,
    )
    const refreshButton = await screen.findByRole('button', { name: /refresh/i })
    worker.posted.length = 0
    await userEvent.click(refreshButton)

    await waitFor(() => expect(worker.posted).toContainEqual({ type: 'scan', root: handle }))
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
    worker.emit({ type: 'scan-complete', scanned: 5, skipped: 2, entries: [] })

    expect(await screen.findByText(/2 folders skipped/i)).toBeInTheDocument()
  })
})
