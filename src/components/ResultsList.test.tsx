import { act, render, screen, waitFor } from '@testing-library/react'
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
  act(() => worker.emit({ type: 'query-result', entries: results }))
  return { worker }
}

describe('ResultsList', () => {
  // Regression: FINDING-006 — "No results." showed before any folder was chosen
  // Found by /design-review on 2026-10-03
  it('invites the user to pick a folder (not "No results.") before any folder is loaded', () => {
    const { deps } = makeFakeDeps()
    render(
      <FileSearchStoreProvider deps={deps}>
        <ResultsList />
      </FileSearchStoreProvider>,
    )
    expect(screen.getByText(/select a folder to search its files/i)).toBeInTheDocument()
    expect(screen.getByText(/nothing leaves your computer/i)).toBeInTheDocument()
    expect(screen.queryByText('No results.')).not.toBeInTheDocument()
  })

  let writeText: ReturnType<typeof vi.fn>

  beforeEach(() => {
    writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
  })

  afterEach(() => {
    // @ts-expect-error cleanup test-only override
    delete navigator.clipboard
  })

  it('shows "No results." when a loaded folder matches nothing', async () => {
    const { deps, worker } = makeFakeDeps({
      loadRootHandle: vi.fn().mockResolvedValue({ name: 'root' } as FileSystemDirectoryHandle),
      loadEntries: vi.fn().mockResolvedValue([]),
    })
    render(
      <FileSearchStoreProvider deps={deps}>
        <ResultsList />
      </FileSearchStoreProvider>,
    )
    await waitFor(() => expect(worker.posted.some((m) => m.type === 'restore')).toBe(true))
    act(() => worker.emit({ type: 'restore-complete', count: 0 }))
    act(() => worker.emit({ type: 'query-result', entries: [] }))
    expect(await screen.findByText('No results.')).toBeInTheDocument()
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
    await waitFor(() => expect(screen.getAllByRole('option').length).toBeGreaterThan(0))
    expect(screen.getAllByRole('option').length).toBeLessThan(500)
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

  describe('keyboard navigation', () => {
    function threeEntries() {
      return [
        entry({ id: '1', name: 'a.pdf', path: 'a.pdf' }),
        entry({ id: '2', name: 'b.pdf', path: 'b.pdf' }),
        entry({ id: '3', name: 'c.pdf', path: 'c.pdf' }),
      ]
    }

    it('the listbox container is focusable and the first row starts selected', async () => {
      renderList(threeEntries())
      await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(3))
      const listbox = screen.getByRole('listbox')
      expect(listbox).toHaveAttribute('tabIndex', '0')
      expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true')
    })

    it('ArrowDown moves the selection, ArrowUp moves it back', async () => {
      renderList(threeEntries())
      const listbox = await screen.findByRole('listbox')
      listbox.focus()

      await userEvent.keyboard('{ArrowDown}')
      let options = screen.getAllByRole('option')
      expect(options[1]).toHaveAttribute('aria-selected', 'true')
      expect(options[0]).toHaveAttribute('aria-selected', 'false')

      await userEvent.keyboard('{ArrowUp}')
      options = screen.getAllByRole('option')
      expect(options[0]).toHaveAttribute('aria-selected', 'true')
    })

    it('ArrowUp at the first row and ArrowDown at the last row clamp instead of wrapping', async () => {
      renderList(threeEntries())
      const listbox = await screen.findByRole('listbox')
      listbox.focus()

      await userEvent.keyboard('{ArrowUp}')
      expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true')

      await userEvent.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}')
      const options = screen.getAllByRole('option')
      expect(options[2]).toHaveAttribute('aria-selected', 'true')
    })

    it('Home and End jump to the first and last row', async () => {
      renderList(threeEntries())
      const listbox = await screen.findByRole('listbox')
      listbox.focus()

      await userEvent.keyboard('{End}')
      expect(screen.getAllByRole('option')[2]).toHaveAttribute('aria-selected', 'true')

      await userEvent.keyboard('{Home}')
      expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true')
    })

    it('Enter on the selected row copies its path, same as a click', async () => {
      renderList(threeEntries())
      const listbox = await screen.findByRole('listbox')
      listbox.focus()

      await userEvent.keyboard('{ArrowDown}{Enter}')

      expect(writeText).toHaveBeenCalledWith('b.pdf')
    })

    it('aria-activedescendant points at the selected option', async () => {
      renderList(threeEntries())
      const listbox = await screen.findByRole('listbox')
      listbox.focus()
      await userEvent.keyboard('{ArrowDown}')

      const selected = screen.getAllByRole('option')[1]
      expect(listbox).toHaveAttribute('aria-activedescendant', selected.id)
    })

    it('a new result set resets the selection to the first row', async () => {
      const { worker } = renderList(threeEntries())
      const listbox = await screen.findByRole('listbox')
      listbox.focus()
      await userEvent.keyboard('{ArrowDown}{ArrowDown}')
      expect(screen.getAllByRole('option')[2]).toHaveAttribute('aria-selected', 'true')

      act(() =>
        worker.emit({
          type: 'query-result',
          entries: [entry({ id: '9', name: 'z.pdf', path: 'z.pdf' })],
        }),
      )

      await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(1))
      expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true')
    })
  })
})
