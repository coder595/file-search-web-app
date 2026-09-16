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
})
