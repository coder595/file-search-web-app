// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { ScanController } from './scanController'

interface FileHandle {
  kind: 'file'
  name: string
  getFile: () => Promise<{ size: number; lastModified: number }>
}
interface DirHandle {
  kind: 'directory'
  name: string
  entries: () => AsyncIterable<[string, FileHandle | DirHandle]>
}

function file(name: string, size = 10, lastModified = 1000): FileHandle {
  return { kind: 'file', name, getFile: async () => ({ size, lastModified }) }
}

function dir(name: string, children: (FileHandle | DirHandle)[]): DirHandle {
  return {
    kind: 'directory',
    name,
    async *entries() {
      for (const child of children) yield [child.name, child] as [string, FileHandle | DirHandle]
    },
  }
}

function deferred<T>() {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((r) => (resolve = r))
  return { promise, resolve }
}

describe('ScanController', () => {
  it('echoes scanId on progress, scan-complete and scan error', async () => {
    const posted: { type: string; scanId?: number }[] = []
    const controller = new ScanController((msg) => posted.push(msg as never))
    const many = dir('root', Array.from({ length: 250 }, (_, i) => file(`f${i}.txt`)))
    await controller.scan(many as unknown as FileSystemDirectoryHandle, undefined, 7)
    expect(posted.map((m) => m.type)).toEqual(expect.arrayContaining(['progress', 'scan-complete']))
    for (const m of posted) expect(m.scanId).toBe(7)

    const failing = {
      kind: 'directory',
      name: 'root',
      entries: () => ({
        [Symbol.asyncIterator]: () => ({ next: () => Promise.reject(new Error('gone')) }),
      }),
    } as unknown as FileSystemDirectoryHandle
    const errs: { type: string; scanId?: number }[] = []
    await new ScanController((m) => errs.push(m as never)).scan(failing, undefined, 9)
    expect(errs).toEqual([{ type: 'error', message: 'gone', scanId: 9 }])
  })

  it('indexes files during scan and posts scan-complete with the final count', async () => {
    const posted: unknown[] = []
    const controller = new ScanController((msg) => posted.push(msg))
    const root = dir('root', [file('a.txt'), file('b.txt')])

    await controller.scan(root as unknown as FileSystemDirectoryHandle)

    const complete = posted.find((m) => (m as { type: string }).type === 'scan-complete') as {
      scanned: number
      skipped: number
      entries: { name: string }[]
    }
    expect(complete).toMatchObject({ scanned: 2, skipped: 0 })
    expect(complete.entries.map((e) => e.name).sort()).toEqual(['a.txt', 'b.txt'])
  })

  it('makes scanned entries queryable immediately after scan completes', async () => {
    const posted: unknown[] = []
    const controller = new ScanController((msg) => posted.push(msg))
    const root = dir('root', [file('invoice.pdf'), file('report.docx')])

    await controller.scan(root as unknown as FileSystemDirectoryHandle)
    controller.query({ query: 'invoice', sort: 'name' })

    const result = posted.at(-1) as { type: string; entries: { name: string }[] }
    expect(result.type).toBe('query-result')
    expect(result.entries.map((e) => e.name)).toEqual(['invoice.pdf'])
  })

  it('query() combines search text with extension/size filters and sort', async () => {
    const posted: unknown[] = []
    const controller = new ScanController((msg) => posted.push(msg))
    const root = dir('root', [file('a.pdf', 100), file('b.pdf', 900), file('a.txt', 100)])
    await controller.scan(root as unknown as FileSystemDirectoryHandle)

    controller.query({ query: 'a', extension: 'pdf', sort: 'name' })
    const result = posted.at(-1) as { entries: { name: string }[] }
    expect(result.entries.map((e) => e.name)).toEqual(['a.pdf'])
  })

  it('a second scan() supersedes an in-flight first scan (generation counter)', async () => {
    const posted: unknown[] = []
    const controller = new ScanController((msg) => posted.push(msg))
    const gate = deferred<void>()

    const slowRoot: DirHandle = {
      kind: 'directory',
      name: 'root',
      async *entries() {
        yield ['a.txt', file('a.txt')]
        await gate.promise
        yield ['b.txt', file('b.txt')]
      },
    }
    const fastRoot = dir('root2', [file('only.txt')])

    const firstScan = controller.scan(slowRoot as unknown as FileSystemDirectoryHandle)
    // Let the first scan yield its first entry and reach the `await gate.promise` point.
    await vi.waitFor(() => expect(gate).toBeDefined())

    const secondScan = controller.scan(fastRoot as unknown as FileSystemDirectoryHandle)
    await secondScan
    gate.resolve()
    await firstScan

    const completions = posted.filter(
      (m): m is { type: string; scanned: number; skipped: number } =>
        typeof m === 'object' && m !== null && (m as { type: string }).type === 'scan-complete',
    )
    expect(completions.map((c) => ({ scanned: c.scanned, skipped: c.skipped }))).toEqual([
      { scanned: 1, skipped: 0 },
    ])
  })

  it('counts ignored folders separately from scanned and permission-skipped entries', async () => {
    const posted: unknown[] = []
    const controller = new ScanController((msg) => posted.push(msg))
    const root = dir('root', [dir('node_modules', [file('pkg.json')]), file('kept.txt')])

    await controller.scan(root as unknown as FileSystemDirectoryHandle, new Set(['node_modules']))

    const complete = posted.find((m) => (m as { type: string }).type === 'scan-complete') as {
      scanned: number
      skipped: number
      ignored: number
      entries: { name: string }[]
    }
    expect(complete).toMatchObject({ scanned: 1, skipped: 0, ignored: 1 })
    expect(complete.entries.map((e) => e.name)).toEqual(['kept.txt'])
  })

  it('counts skipped folders separately from scanned entries', async () => {
    const posted: unknown[] = []
    const controller = new ScanController((msg) => posted.push(msg))
    const restricted: DirHandle = {
      kind: 'directory',
      name: 'restricted',
      entries: () => ({
        [Symbol.asyncIterator]: () => ({
          next: () => Promise.reject(new DOMException('nope', 'NotAllowedError')),
        }),
      }),
    }
    const root = dir('root', [restricted, file('after.txt')])

    await controller.scan(root as unknown as FileSystemDirectoryHandle)

    const complete = posted.find((m) => (m as { type: string }).type === 'scan-complete') as {
      scanned: number
      skipped: number
    }
    expect(complete).toMatchObject({ scanned: 2, skipped: 1 })
  })
})

describe('ScanController.restore', () => {
  it('loads cached entries into the search index without walking, then makes them queryable', () => {
    const posted: unknown[] = []
    const controller = new ScanController((msg) => posted.push(msg))
    const entries = [
      { id: '1', name: 'cached.pdf', path: 'cached.pdf', extension: 'pdf', kind: 'file' as const, size: 5, lastModified: 1 },
    ]

    controller.restore(entries)
    controller.query({ query: 'cached', sort: 'name' })

    const result = posted.at(-1) as { entries: { name: string }[] }
    expect(result.entries.map((e) => e.name)).toEqual(['cached.pdf'])
  })

  it('a subsequent scan() clears restored entries before walking', async () => {
    const posted: unknown[] = []
    const controller = new ScanController((msg) => posted.push(msg))
    controller.restore([
      { id: 'old', name: 'stale.pdf', path: 'stale.pdf', extension: 'pdf', kind: 'file' as const, size: 1, lastModified: 1 },
    ])

    const root = {
      kind: 'directory' as const,
      name: 'root',
      async *entries() {},
    }
    await controller.scan(root as unknown as FileSystemDirectoryHandle)
    controller.query({ query: '', sort: 'name' })

    const result = posted.at(-1) as { entries: unknown[] }
    expect(result.entries).toEqual([])
  })

  describe('errors [B3]', () => {
    const failingRoot = {
      kind: 'directory',
      name: 'root',
      entries: () => ({
        [Symbol.asyncIterator]: () => ({
          next: () => Promise.reject(new DOMException('gone', 'NotFoundError')),
        }),
      }),
    } as unknown as FileSystemDirectoryHandle

    it('posts an error message when the walk fails with a non-permission error', async () => {
      const posted: unknown[] = []
      const controller = new ScanController((msg) => posted.push(msg))
      await controller.scan(failingRoot)
      expect(posted).toEqual([{ type: 'error', message: 'gone', scanId: 0 }])
    })

    it('falls back to the error name when the message is empty', async () => {
      const posted: unknown[] = []
      const controller = new ScanController((msg) => posted.push(msg))
      const root = {
        kind: 'directory',
        name: 'r',
        entries: () => ({
          [Symbol.asyncIterator]: () => ({ next: () => Promise.reject(new DOMException('', 'NotFoundError')) }),
        }),
      } as unknown as FileSystemDirectoryHandle
      await controller.scan(root)
      expect(posted).toEqual([{ type: 'error', message: 'NotFoundError', scanId: 0 }])
    })

    it('stays silent when a superseded scan fails', async () => {
      const posted: unknown[] = []
      const controller = new ScanController((msg) => posted.push(msg))
      const gate = deferred<void>()
      const slowFailing = {
        kind: 'directory',
        name: 'root',
        entries: () => ({
          [Symbol.asyncIterator]: () => ({
            next: async () => {
              await gate.promise
              throw new DOMException('gone', 'NotFoundError')
            },
          }),
        }),
      } as unknown as FileSystemDirectoryHandle

      const first = controller.scan(slowFailing)
      await controller.scan(dir('ok', [file('a.txt')]) as unknown as FileSystemDirectoryHandle)
      gate.resolve()
      await first

      expect(posted.filter((m) => (m as { type: string }).type === 'error')).toEqual([])
    })

    it('restore() posts an error instead of throwing when indexing fails', () => {
      const posted: unknown[] = []
      const controller = new ScanController((msg) => posted.push(msg))
      expect(() => controller.restore([null as never])).not.toThrow()
      expect(posted).toEqual([{ type: 'error', message: expect.any(String) as string }])
    })
  })

  it('restore() posts restore-complete with the count after indexing [D2]', () => {
    const posted: { type: string; count?: number }[] = []
    const controller = new ScanController((msg) => posted.push(msg))
    const entry = (n: string) => ({
      id: n, name: n, path: n, extension: 'txt', kind: 'file' as const, size: 1, lastModified: 1,
    })
    controller.restore([entry('a.txt'), entry('b.txt')])
    expect(posted).toEqual([{ type: 'restore-complete', count: 2 }])
    controller.query({ query: 'a', sort: 'name' })
    expect(posted.at(-1)?.type).toBe('query-result')
  })

  it('6. query() posts an error instead of throwing when search fails', () => {
    const posted: unknown[] = []
    const controller = new ScanController((msg) => posted.push(msg))
    expect(() => controller.query(null as never)).not.toThrow()
    expect(posted).toEqual([{ type: 'query-error', message: expect.any(String) as string }])
  })
})
