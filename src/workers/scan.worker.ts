/// <reference lib="webworker" />
import type { IndexEntry, QueryFilters } from '../lib/types'
import { ScanController, type WorkerOutMessage } from './scanController'

export type WorkerInMessage =
  | { type: 'scan'; root: FileSystemDirectoryHandle }
  | { type: 'restore'; entries: IndexEntry[] }
  | { type: 'query'; filters: QueryFilters }

const controller = new ScanController((msg: WorkerOutMessage) => self.postMessage(msg))

self.onmessage = (event: MessageEvent<WorkerInMessage>) => {
  const message = event.data
  switch (message.type) {
    case 'scan':
      void controller.scan(message.root)
      break
    case 'restore':
      controller.restore(message.entries)
      break
    case 'query':
      controller.query(message.filters)
      break
  }
}
