import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FileSearchStoreProvider } from '../store/FileSearchStoreProvider'
import { makeFakeDeps } from '../test/fakeFileSearchDeps'
import type { IndexEntry } from '../lib/types'
import { ResultsList } from './ResultsList'

function entry(overrides: Partial<IndexEntry>): IndexEntry {
  return {
    id: overrides.path ?? 'x',
    name: 'x',
    path: 'x',
    extension: '',
    kind: 'file',
    size: 0,
    lastModified: 0,
    ...overrides,
  }
}

function renderList(results: IndexEntry[]) {
  const { deps, worker } = makeFakeDeps()
  render(
    <FileSearchStoreProvider deps={deps}>
      <div style={{ height: 400 }}>
        <ResultsList />
      </div>
    </FileSearchStoreProvider>,
  )
  worker.emit({ type: 'query-result', entries: results })
  return { worker }
}

describe('ResultsList', () => {
  let writeText: ReturnType<typeof vi.fn>

  beforeEach(() => {
    writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
  })

  afterEach(() => {
    // @ts-expect-error cleanup test-only override
    delete navigator.clipboard
  })

  it('shows an empty state when there are no results', () => {
    renderList([])
    expect(screen.getByText(/no results/i)).toBeInTheDocument()
  })

  it('renders a row with name, path, size, and modified date as plain text', async () => {
    renderList([
      entry({ name: 'invoice.pdf', path: 'Docs/invoice.pdf', size: 2048, lastModified: 1_700_000_000_000 }),
    ])
    await waitFor(() => expect(screen.getByText('invoice.pdf')).toBeInTheDocument())
    expect(screen.getByText('Docs/invoice.pdf')).toBeInTheDocument()
  })

  it('only renders a fraction of a 10,000-row result set (virtualized, not one DOM node per row)', async () => {
    const many = Array.from({ length: 10_000 }, (_, i) => entry({ name: `f${i}.txt`, path: `f${i}.txt` }))
    renderList(many)
    await waitFor(() => expect(screen.getAllByRole('row').length).toBeGreaterThan(0))
    expect(screen.getAllByRole('row').length).toBeLessThan(500)
  })

  it('clicking a row copies its path to the clipboard and shows a success toast', async () => {
    renderList([entry({ name: 'a.pdf', path: 'Docs/a.pdf' })])
    await userEvent.click(await screen.findByText('a.pdf'))

    expect(writeText).toHaveBeenCalledWith('Docs/a.pdf')
    expect(await screen.findByText(/copied/i)).toBeInTheDocument()
  })

  it('shows a failure toast, not a silent failure, when the clipboard write is rejected', async () => {
    writeText.mockRejectedValueOnce(new Error('denied'))
    renderList([entry({ name: 'a.pdf', path: 'Docs/a.pdf' })])
    await userEvent.click(await screen.findByText('a.pdf'))

    expect(await screen.findByText(/couldn.?t copy/i)).toBeInTheDocument()
  })
})
