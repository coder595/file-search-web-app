import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { IndexEntry } from '../lib/types'
import { VirtualizedEntryTable } from './VirtualizedEntryTable'

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
    vi.useRealTimers()
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
    await userEvent.keyboard('{End}')
    // jsdom has no layout: the virtualizer renders a small window around the scroll offset
    const ids = screen.getAllByRole('option').map((o) => o.id)
    const active = listbox.getAttribute('aria-activedescendant')
    if (active) expect(ids).toContain(active)
    expect(ids.length).toBeLessThan(500)
  })
})
