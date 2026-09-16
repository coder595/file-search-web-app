import { vi } from 'vitest'
import type { FileSearchDeps } from '../store/fileSearchStore'
import type { WorkerInMessage } from '../workers/scan.worker'
import type { WorkerOutMessage } from '../workers/scanController'

class FakeWorker {
  posted: WorkerInMessage[] = []
  onmessage: ((e: MessageEvent<WorkerOutMessage>) => void) | null = null
  postMessage(msg: WorkerInMessage) {
    this.posted.push(msg)
  }
  emit(msg: WorkerOutMessage) {
    this.onmessage?.({ data: msg } as MessageEvent<WorkerOutMessage>)
  }
}

/** Builds an in-memory FileSearchDeps for tests — no real Worker/IndexedDB/FS Access API. */
export function makeFakeDeps(overrides: Partial<FileSearchDeps> = {}) {
  const worker = new FakeWorker()
  const deps: FileSearchDeps = {
    createWorker: () => worker as unknown as Worker,
    isSupported: () => true,
    showDirectoryPicker: vi.fn(),
    checkPermission: vi.fn().mockResolvedValue('granted'),
    requestPermission: vi.fn().mockResolvedValue('granted'),
    loadRootHandle: vi.fn().mockResolvedValue(undefined),
    saveRootHandle: vi.fn().mockResolvedValue(undefined),
    loadEntries: vi.fn().mockResolvedValue(undefined),
    saveEntries: vi.fn().mockResolvedValue(undefined),
    clearCache: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
  return { worker, deps }
}
