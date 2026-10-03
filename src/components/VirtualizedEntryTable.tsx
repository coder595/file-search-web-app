import { useVirtualizer } from '@tanstack/react-virtual'
import { useEffect, useId, useRef, useState } from 'react'
import type { IndexEntry } from '../lib/types'

const ROW_HEIGHT = 36

function formatSize(bytes: number): string {
  if (bytes === 0) return '—'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`
}

function formatDate(epochMs: number): string {
  if (!epochMs) return '—'
  return new Date(epochMs).toLocaleDateString()
}

/**
 * Virtualized (@tanstack/react-virtual) results table shared by the live
 * (Chrome/Edge) results list and the read-only fallback listing — same row
 * rendering and copy-path behavior either way, per plan.md Section 8 item 7.
 *
 * Keyboard-navigable as an ARIA listbox (plan.md Section 24): since rows are
 * virtualized, off-screen entries don't exist in the DOM, so selection lives
 * as a `selectedIndex` in React state rather than real DOM focus/tabIndex.
 * The container owns keyboard focus and `aria-activedescendant`; rows are
 * non-interactive `role="option"` elements, not `<button>` — overriding a
 * native interactive element's implicit role is a known assistive-tech
 * inconsistency.
 */
export function VirtualizedEntryTable({ entries }: { entries: IndexEntry[] }) {
  const parentRef = useRef<HTMLDivElement>(null)
  const listId = useId()
  const [toast, setToast] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)

  // oxlint-disable-next-line react/incompatible-library -- TanStack Virtual returns non-memoizable functions; this component is intentionally not compiler-memoized
  const virtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  })

  // A changed result set (new search/filter/scan) always resets selection to
  // the top — never left pointing at stale/out-of-bounds data. This never
  // triggers a scroll itself; only a keypress does (see handleKeyDown).
  useEffect(() => {
    setSelectedIndex(0)
  }, [entries])

  // Clear the (always-mounted) status text so a repeat copy re-announces.
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 4000)
    return () => clearTimeout(t)
  }, [toast])

  async function copyPath(entry: IndexEntry) {
    try {
      await navigator.clipboard.writeText(entry.path)
      setToast(`Copied "${entry.path}"`)
    } catch {
      setToast(`Couldn't copy "${entry.path}"`)
    }
  }

  function moveSelection(delta: number) {
    const next = Math.min(Math.max(selectedIndex + delta, 0), entries.length - 1)
    setSelectedIndex(next)
    virtualizer.scrollToIndex(next)
  }

  function jumpSelection(index: number) {
    setSelectedIndex(index)
    virtualizer.scrollToIndex(index)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        moveSelection(1)
        break
      case 'ArrowUp':
        e.preventDefault()
        moveSelection(-1)
        break
      case 'Home':
        e.preventDefault()
        jumpSelection(0)
        break
      case 'End':
        e.preventDefault()
        jumpSelection(entries.length - 1)
        break
      case 'Enter': {
        e.preventDefault()
        const entry = entries[selectedIndex]
        if (entry) void copyPath(entry)
        break
      }
    }
  }

  if (entries.length === 0) {
    return <p className="p-4 text-sm text-gray-500 dark:text-gray-400">No results.</p>
  }

  // Only point at an option that exists in the DOM (rows are virtualized).
  const activeRendered = virtualizer.getVirtualItems().some((v) => v.index === selectedIndex)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <p role="status" aria-atomic="true" className="px-2 pb-1 text-xs text-gray-500 dark:text-gray-400">
        {toast}
      </p>
      <p id={`${listId}-hint`} className="sr-only">
        Press Enter to copy the selected path.
      </p>
      <div
        ref={parentRef}
        className="min-h-0 flex-1 overflow-auto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:focus-visible:outline-blue-400"
        role="listbox"
        aria-label="Search results"
        aria-describedby={`${listId}-hint`}
        tabIndex={0}
        aria-activedescendant={activeRendered ? `${listId}-opt-${selectedIndex}` : undefined}
        onKeyDown={handleKeyDown}
      >
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const item = entries[virtualRow.index]
            const selected = virtualRow.index === selectedIndex
            return (
              <div
                key={item.id}
                id={`${listId}-opt-${virtualRow.index}`}
                role="option"
                aria-selected={selected}
                aria-posinset={virtualRow.index + 1}
                aria-setsize={entries.length}
                onClick={() => {
                  setSelectedIndex(virtualRow.index)
                  void copyPath(item)
                }}
                title="Click to copy path"
                className={`absolute left-0 top-0 flex w-full cursor-pointer items-center gap-4 border-b border-gray-100 px-2 text-sm dark:border-gray-700 ${
                  selected ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
                style={{ height: ROW_HEIGHT, transform: `translateY(${virtualRow.start}px)` }}
              >
                <span aria-hidden="true" className="w-6 shrink-0 text-gray-400 dark:text-gray-500">
                  {item.kind === 'directory' ? '📁' : '📄'}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium text-gray-900 dark:text-gray-100">
                  {item.name}
                </span>
                <span className="min-w-0 flex-[2] truncate text-gray-500 dark:text-gray-400">{item.path}</span>
                <span className="w-16 shrink-0 text-right max-sm:hidden text-gray-500 dark:text-gray-400">
                  {formatSize(item.size)}
                </span>
                <span className="w-24 shrink-0 text-right max-sm:hidden text-gray-500 dark:text-gray-400">
                  {formatDate(item.lastModified)}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
