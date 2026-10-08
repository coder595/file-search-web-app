import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { IndexEntry } from '../lib/types'
import { TOAST_CLEAR_MS, VirtualizedEntryTable } from './VirtualizedEntryTable'

const entry = (name: string): IndexEntry => ({
  id: `/root/My "Docs"/${name}`,
  name,
  path: `My "Docs"/${name}`,
  extension: 'txt',
  kind: 'file',
  size: 1,
  lastModified: 1,
})
const entries = [entry('a b.txt'), entry('c.txt'), entry('d.txt')]

describe('VirtualizedEntryTable a11y', () => {
  afterEach(() => vi.useRealTimers())

  it('names the listbox and describes the Enter-to-copy hint', () => {
    render(<VirtualizedEntryTable entries={entries} />)
    const listbox = screen.getByRole('listbox', { name: 'Search results' })
    const hint = document.getElementById(listbox.getAttribute('aria-describedby')!)
    expect(hint).toHaveTextContent('Press Enter to copy the selected path.')
    expect(hint).toHaveClass('sr-only')
  })

  it('uses IDREF-safe option ids with posinset/setsize, matching aria-activedescendant', () => {
    render(<VirtualizedEntryTable entries={entries} />)
    const options = screen.getAllByRole('option')
    for (const o of options) expect(o.id).toMatch(/^\S+-opt-\d+$/)
    expect(options[1]).toHaveAttribute('aria-posinset', '2')
    expect(options[1]).toHaveAttribute('aria-setsize', '3')
    expect(screen.getByRole('listbox')).toHaveAttribute('aria-activedescendant', options[0].id)
  })

  it('clicking a row selects it', async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
    render(<VirtualizedEntryTable entries={entries} />)
    const options = screen.getAllByRole('option')
    await userEvent.click(options[2])
    expect(options[2]).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('listbox')).toHaveAttribute('aria-activedescendant', options[2].id)
  })

  it('keeps one always-mounted status region whose text is set then cleared', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
    render(<VirtualizedEntryTable entries={entries} />)
    const status = screen.getByRole('status')
    expect(status).toBeEmptyDOMElement()
    await userEvent.click(screen.getAllByRole('option')[0])
    expect(status).toHaveTextContent(/copied/i)
    act(() => void vi.advanceTimersByTime(4500))
    expect(status).toBeEmptyDOMElement()
  })

  it('clears the toast after TOAST_CLEAR_MS and a repeat copy shows it again', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
    render(<VirtualizedEntryTable entries={entries} />)
    const status = screen.getByRole('status')
    await userEvent.click(screen.getAllByRole('option')[0])
    expect(status).toHaveTextContent(/copied/i)
    act(() => void vi.advanceTimersByTime(TOAST_CLEAR_MS))
    expect(status).toBeEmptyDOMElement()
    await userEvent.click(screen.getAllByRole('option')[0])
    expect(status).toHaveTextContent(/copied/i)
  })

  it('hides decorative emoji from assistive tech', () => {
    render(<VirtualizedEntryTable entries={entries} />)
    expect(screen.getAllByRole('option')[0].querySelector('[aria-hidden="true"]')).toHaveTextContent('📄')
  })

  it('omits aria-activedescendant when the selected row is not rendered', async () => {
    const many = Array.from({ length: 500 }, (_, i) => entry(`f${i}.txt`))
    render(<VirtualizedEntryTable entries={many} />)
    const listbox = screen.getByRole('listbox')
    listbox.focus()
    await userEvent.keyboard('{End}') // selects index 499; jsdom has no layout so it is never rendered
    expect(screen.getAllByRole('option').length).toBeLessThan(500)
    expect(screen.queryByRole('option', { name: /f499\.txt/ })).not.toBeInTheDocument()
    expect(listbox).not.toHaveAttribute('aria-activedescendant')
  })

  it('points aria-activedescendant at an existing option when the selected row is rendered', () => {
    const many = Array.from({ length: 500 }, (_, i) => entry(`f${i}.txt`))
    render(<VirtualizedEntryTable entries={many} />)
    const active = screen.getByRole('listbox').getAttribute('aria-activedescendant')
    expect(active).toBeTruthy()
    expect(document.getElementById(active!)).toBeInTheDocument()
  })
})
