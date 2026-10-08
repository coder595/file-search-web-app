import { vi } from 'vitest'
import type { FileSearchDeps } from '../store/fileSearchStore'
import type { WorkerInMessage } from '../workers/scan.worker'
import type { WorkerOutMessage } from '../workers/scanController'

// Scan replies may omit scanId; emit() fills in the latest posted scan's id so tests read naturally.
type Loose<M> = M extends { scanId: number } ? Omit<M, 'scanId'> & { scanId?: number } : M

class FakeWorker {
  posted: WorkerInMessage[] = []
  onmessage: ((e: MessageEvent<WorkerOutMessage>) => void) | null = null
  onerror: ((e: ErrorEvent) => void) | null = null
  terminated = false
  terminate() {
    this.terminated = true
  }
  crash() {
    this.onerror?.({} as ErrorEvent)
  }
  postMessage(msg: WorkerInMessage) {
    this.posted.push(msg)
  }
  emit(msg: Loose<WorkerOutMessage>) {
    let data = msg as WorkerOutMessage
    if ((msg.type === 'progress' || msg.type === 'scan-complete') && msg.scanId === undefined) {
      const lastScan = this.posted.findLast((m) => m.type === 'scan')
      data = { ...msg, scanId: lastScan?.type === 'scan' ? lastScan.scanId : 0 } as WorkerOutMessage
    }
    this.onmessage?.({ data } as MessageEvent<WorkerOutMessage>)
  }
}

/** Builds an in-memory FileSearchDeps for tests — no real Worker/IndexedDB/FS Access API. */
export function makeFakeDeps(overrides: Partial<FileSearchDeps> = {}) {
  const worker = new FakeWorker()
  const workers = [worker]
  let created = false
  const deps: FileSearchDeps = {
    createWorker: () => {
      // First call hands out `worker`; later calls (retry) get a fresh one.
      const w = workers.length === 1 && !created ? worker : new FakeWorker()
      created = true
      if (w !== worker) workers.push(w)
      return w as unknown as Worker
    },
    isSupported: () => true,
    showDirectoryPicker: vi.fn(),
    checkPermission: vi.fn().mockResolvedValue('granted'),
    requestPermission: vi.fn().mockResolvedValue('granted'),
    loadRootHandle: vi.fn().mockResolvedValue(undefined),
    saveRootHandle: vi.fn().mockResolvedValue(undefined),
    loadEntries: vi.fn().mockResolvedValue(undefined),
    saveEntries: vi.fn().mockResolvedValue(undefined),
    clearCache: vi.fn().mockResolvedValue(undefined),
    clearEntries: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
  return { worker, workers, latestWorker: () => workers[workers.length - 1], deps }
}
