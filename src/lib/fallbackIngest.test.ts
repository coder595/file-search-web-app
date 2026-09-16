import { describe, expect, it } from 'vitest'
import { filesToEntries } from './fallbackIngest'

function fakeFile(name: string, webkitRelativePath: string, size = 100, lastModified = 12345): File {
  const file = new File(['x'.repeat(size)], name, { lastModified })
  Object.defineProperty(file, 'webkitRelativePath', { value: webkitRelativePath })
  return file
}

describe('filesToEntries', () => {
  it('converts a File with webkitRelativePath into an IndexEntry with no handle', () => {
    const file = fakeFile('invoice.pdf', 'Documents/invoice.pdf', 2048, 999)
    const [entry] = filesToEntries([file])
    expect(entry).toMatchObject({
      name: 'invoice.pdf',
      path: 'Documents/invoice.pdf',
      extension: 'pdf',
      kind: 'file',
      size: 2048,
      lastModified: 999,
      handle: undefined,
    })
  })

  it('falls back to file.name for path when webkitRelativePath is empty', () => {
    const file = new File(['x'], 'a.txt')
    const [entry] = filesToEntries([file])
    expect(entry.path).toBe('a.txt')
  })

  it('handles a file with no extension', () => {
    const file = fakeFile('README', 'README')
    const [entry] = filesToEntries([file])
    expect(entry.extension).toBe('')
  })
})
