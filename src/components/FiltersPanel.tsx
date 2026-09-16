import type { ChangeEvent } from 'react'
import { useFileSearchStore } from '../store/FileSearchStoreProvider'
import type { QueryFilters } from '../lib/types'

const labelClass = 'flex flex-col gap-1 text-xs font-medium text-gray-600 dark:text-gray-400'
const inputClass = 'rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100'

export function FiltersPanel() {
  const filters = useFileSearchStore((s) => s.filters)
  const setFilters = useFileSearchStore((s) => s.setFilters)

  function numberField(key: 'minSize' | 'maxSize') {
    return (e: ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value
      setFilters({ [key]: value === '' ? undefined : Number(value) } as Partial<QueryFilters>)
    }
  }

  function dateField(key: 'modifiedAfter' | 'modifiedBefore') {
    return (e: ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value
      setFilters({ [key]: value === '' ? undefined : new Date(value).getTime() } as Partial<QueryFilters>)
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className={labelClass}>
        Extension
        <input
          className={inputClass}
          value={filters.extension ?? ''}
          onChange={(e) => setFilters({ extension: e.target.value || undefined })}
          placeholder="pdf"
        />
      </label>

      <label className={labelClass}>
        Min size (bytes)
        <input
          type="number"
          className={inputClass}
          value={filters.minSize ?? ''}
          onChange={numberField('minSize')}
        />
      </label>

      <label className={labelClass}>
        Max size (bytes)
        <input
          type="number"
          className={inputClass}
          value={filters.maxSize ?? ''}
          onChange={numberField('maxSize')}
        />
      </label>

      <label className={labelClass}>
        Modified after
        <input type="date" className={inputClass} onChange={dateField('modifiedAfter')} />
      </label>

      <label className={labelClass}>
        Modified before
        <input type="date" className={inputClass} onChange={dateField('modifiedBefore')} />
      </label>

      <label className={labelClass}>
        Type
        <select
          className={inputClass}
          value={filters.kind ?? ''}
          onChange={(e) => setFilters({ kind: (e.target.value || undefined) as QueryFilters['kind'] })}
        >
          <option value="">All</option>
          <option value="file">Files only</option>
          <option value="directory">Folders only</option>
        </select>
      </label>

      <label className={labelClass}>
        Sort
        <select
          className={inputClass}
          value={filters.sort}
          onChange={(e) => setFilters({ sort: e.target.value as QueryFilters['sort'] })}
        >
          <option value="relevance">Relevance</option>
          <option value="name">Name</option>
          <option value="size">Size</option>
          <option value="lastModified">Date modified</option>
        </select>
      </label>
    </div>
  )
}
