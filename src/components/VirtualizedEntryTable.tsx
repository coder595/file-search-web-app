import { useVirtualizer } from '@tanstack/react-virtual'
import { useRef, useState } from 'react'
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
 */
export function VirtualizedEntryTable({ entries }: { entries: IndexEntry[] }) {
  const parentRef = useRef<HTMLDivElement>(null)
  const [toast, setToast] = useState<string | null>(null)

  const virtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  })

  async function copyPath(entry: IndexEntry) {
    try {
      await navigator.clipboard.writeText(entry.path)
      setToast(`Copied "${entry.path}"`)
    } catch {
      setToast(`Couldn't copy "${entry.path}"`)
    }
  }

  if (entries.length === 0) {
    return <p className="p-4 text-sm text-gray-500">No results.</p>
  }

  return (
    <div>
      {toast && (
        <p role="status" className="px-2 pb-1 text-xs text-gray-500">
          {toast}
        </p>
      )}
      <div ref={parentRef} className="h-full overflow-auto" role="table">
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const item = entries[virtualRow.index]
            return (
              <button
                key={item.id}
                type="button"
                role="row"
                onClick={() => void copyPath(item)}
                title="Click to copy path"
                className="absolute left-0 top-0 flex w-full items-center gap-4 border-b border-gray-100 px-2 text-left text-sm hover:bg-gray-50"
                style={{ height: ROW_HEIGHT, transform: `translateY(${virtualRow.start}px)` }}
              >
                <span className="w-6 shrink-0 text-gray-400">{item.kind === 'directory' ? '📁' : '📄'}</span>
                <span className="min-w-0 flex-1 truncate font-medium text-gray-900">{item.name}</span>
                <span className="min-w-0 flex-[2] truncate text-gray-500">{item.path}</span>
                <span className="w-16 shrink-0 text-right text-gray-500">{formatSize(item.size)}</span>
                <span className="w-24 shrink-0 text-right text-gray-500">{formatDate(item.lastModified)}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
