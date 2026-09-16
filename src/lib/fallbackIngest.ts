import type { IndexEntry } from './types'

/**
 * Converts browser-fs-access's File[] (from the Firefox/Safari fallback,
 * Section 4) into the same IndexEntry shape the Chrome/Edge path uses. These
 * files have no FileSystemHandle at all, so `handle` stays undefined.
 */
export function filesToEntries(files: File[]): IndexEntry[] {
  return files.map((file) => {
    const path = file.webkitRelativePath || file.name
    const dot = file.name.lastIndexOf('.')
    const extension = dot > 0 ? file.name.slice(dot + 1) : ''
    return {
      id: path,
      name: file.name,
      path,
      extension,
      kind: 'file',
      size: file.size,
      lastModified: file.lastModified,
      handle: undefined,
    }
  })
}
