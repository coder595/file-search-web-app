import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { FileSearchStoreProvider } from '../store/FileSearchStoreProvider'
import { makeFakeDeps } from '../test/fakeFileSearchDeps'
import { FiltersPanel } from './FiltersPanel'

function renderPanel() {
  const { deps, worker } = makeFakeDeps()
  render(
    <FileSearchStoreProvider deps={deps}>
      <FiltersPanel />
    </FileSearchStoreProvider>,
  )
  return { worker }
}

describe('FiltersPanel', () => {
  it('updates the extension filter', async () => {
    const { worker } = renderPanel()
    await userEvent.type(screen.getByLabelText(/extension/i), 'pdf')
    await waitFor(() =>
      expect(worker.posted.at(-1)).toEqual({
        type: 'query',
        filters: expect.objectContaining({ extension: 'pdf' }),
      }),
    )
  })

  it('updates min and max size filters as numbers', async () => {
    const { worker } = renderPanel()
    await userEvent.type(screen.getByLabelText(/min size/i), '100')
    await userEvent.type(screen.getByLabelText(/max size/i), '9000')
    await waitFor(() =>
      expect(worker.posted.at(-1)).toEqual({
        type: 'query',
        filters: expect.objectContaining({ minSize: 100, maxSize: 9000 }),
      }),
    )
  })

  it('updates the files-only/folders-only kind filter', async () => {
    const { worker } = renderPanel()
    await userEvent.selectOptions(screen.getByLabelText(/type/i), 'file')
    await waitFor(() =>
      expect(worker.posted.at(-1)).toEqual({
        type: 'query',
        filters: expect.objectContaining({ kind: 'file' }),
      }),
    )
  })

  it('updates the sort key', async () => {
    const { worker } = renderPanel()
    await userEvent.selectOptions(screen.getByLabelText(/sort/i), 'size')
    await waitFor(() =>
      expect(worker.posted.at(-1)).toEqual({
        type: 'query',
        filters: expect.objectContaining({ sort: 'size' }),
      }),
    )
  })

  it('uses native date inputs for the modified-date range', () => {
    renderPanel()
    expect(screen.getByLabelText(/modified after/i)).toHaveAttribute('type', 'date')
    expect(screen.getByLabelText(/modified before/i)).toHaveAttribute('type', 'date')
  })

  it('shows the default ignore patterns and a hint that changes need Refresh', () => {
    renderPanel()
    expect(screen.getByText('node_modules')).toBeInTheDocument()
    expect(screen.getByText('.git')).toBeInTheDocument()
    expect(screen.getByText(/click refresh to apply/i)).toBeInTheDocument()
  })

  it('adding a pattern updates the list and does not post a scan message', async () => {
    const { worker } = renderPanel()
    await userEvent.type(screen.getByLabelText(/add ignore pattern/i), 'my-cache{enter}')

    expect(screen.getByText('my-cache')).toBeInTheDocument()
    expect(worker.posted.some((m) => m.type === 'scan')).toBe(false)
  })

  it('removing a pattern takes it off the list', async () => {
    renderPanel()
    await userEvent.click(screen.getByRole('button', { name: /remove node_modules/i }))

    expect(screen.queryByText('node_modules')).not.toBeInTheDocument()
  })
})
