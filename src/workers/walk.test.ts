import { describe, expect, it } from 'vitest'
import { walkDirectory } from './walk'

type Handle = FileHandle | DirHandle
interface FileHandle {
  kind: 'file'
  name: string
  getFile: () => Promise<{ size: number; lastModified: number }>
}
interface DirHandle {
  kind: 'directory'
  name: string
  entries: () => AsyncGenerator<[string, Handle]>
}

function file(name: string, size = 10, lastModified = 1000): FileHandle {
  return { kind: 'file', name, getFile: async () => ({ size, lastModified }) }
}

function dir(name: string, children: Handle[] | (() => never)): DirHandle {
  return {
    kind: 'directory',
    name,
    async *entries() {
      if (typeof children === 'function') return children()
      for (const child of children) yield [child.name, child]
    },
  }
}

async function collect(root: DirHandle) {
  const events = []
  for await (const event of walkDirectory(root as unknown as FileSystemDirectoryHandle)) {
    events.push(event)
  }
  return events
}

describe('walkDirectory', () => {
  it('yields an entry event for each file at the top level', async () => {
    const root = dir('root', [file('a.txt'), file('b.txt')])
    const events = await collect(root)
    expect(events.map((e) => e.type)).toEqual(['entry', 'entry'])
    expect((events[0] as { entry: { path: string } }).entry.path).toBe('a.txt')
  })

  it('recurses into subdirectories, building nested paths', async () => {
    const root = dir('root', [dir('sub', [file('a.txt')])])
    const events = await collect(root)
    const paths = events
      .filter((e) => e.type === 'entry')
      .map((e) => (e as { entry: { path: string } }).entry.path)
    expect(paths).toEqual(['sub', 'sub/a.txt'])
  })

  it('builds file entries with size/lastModified from getFile()', async () => {
    const root = dir('root', [file('a.txt', 500, 1234)])
    const events = await collect(root)
    const fileEvent = events[0] as { entry: { size: number; lastModified: number; kind: string } }
    expect(fileEvent.entry).toMatchObject({ size: 500, lastModified: 1234, kind: 'file' })
  })

  it('builds directory entries with size 0', async () => {
    const root = dir('root', [dir('sub', [])])
    const events = await collect(root)
    const dirEvent = events[0] as { entry: { size: number; kind: string } }
    expect(dirEvent.entry).toMatchObject({ size: 0, kind: 'directory' })
  })

  it('skips a subfolder that throws NotAllowedError and continues with siblings', async () => {
    const restricted = dir('restricted', () => {
      throw new DOMException('nope', 'NotAllowedError')
    })
    const root = dir('root', [restricted, file('after.txt')])
    const events = await collect(root)
    expect(events).toContainEqual({ type: 'skipped', path: 'restricted' })
    const paths = events
      .filter((e) => e.type === 'entry')
      .map((e) => (e as { entry: { path: string } }).entry.path)
    expect(paths).toContain('after.txt')
  })

  it('propagates a non-permission error instead of silently skipping', async () => {
    const broken = dir('broken', () => {
      throw new Error('disk read error')
    })
    const root = dir('root', [broken])
    await expect(collect(root)).rejects.toThrow('disk read error')
  })
})
