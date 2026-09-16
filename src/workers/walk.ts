import type { IndexEntry } from '../lib/types'

export type WalkEvent = { type: 'entry'; entry: IndexEntry } | { type: 'skipped'; path: string }

function isNotAllowedError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'NotAllowedError'
}

async function toIndexEntry(
  handle: FileSystemFileHandle | FileSystemDirectoryHandle,
  path: string,
): Promise<IndexEntry> {
  if (handle.kind === 'file') {
    const file = await handle.getFile()
    const dot = handle.name.lastIndexOf('.')
    const extension = dot > 0 ? handle.name.slice(dot + 1) : ''
    return {
      id: path,
      name: handle.name,
      path,
      extension,
      kind: 'file',
      size: file.size,
      lastModified: file.lastModified,
    }
  }
  return {
    id: path,
    name: handle.name,
    path,
    extension: '',
    kind: 'directory',
    size: 0,
    lastModified: 0,
  }
}

/**
 * Recursively walks a directory handle, yielding an `entry` event per file
 * or subfolder found. A subfolder whose `entries()` throws `NotAllowedError`
 * (e.g. an OS-restricted directory) yields a `skipped` event for that
 * subfolder and its subtree is abandoned — walking continues with siblings.
 * Any other error propagates and aborts the walk.
 */
export async function* walkDirectory(
  dir: FileSystemDirectoryHandle,
  path = '',
): AsyncGenerator<WalkEvent> {
  try {
    for await (const [name, handle] of dir.entries()) {
      const entryPath = path ? `${path}/${name}` : name
      yield { type: 'entry', entry: await toIndexEntry(handle, entryPath) }
      if (handle.kind === 'directory') {
        yield* walkDirectory(handle, entryPath)
      }
    }
  } catch (err) {
    if (isNotAllowedError(err)) {
      yield { type: 'skipped', path }
      return
    }
    throw err
  }
}
