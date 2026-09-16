import type { Page } from '@playwright/test'

export interface MockFileNode {
  name: string
  kind: 'file'
  size?: number
  lastModified?: number
}
export interface MockDirNode {
  name: string
  kind: 'directory'
  children: (MockFileNode | MockDirNode)[]
}

/**
 * The worker-side prelude, injected in front of the real scan.worker.ts
 * bundle. A mock FileSystemDirectoryHandle built on the main thread can't
 * cross postMessage to the real Worker (only the browser's native handle
 * objects have structured-clone support) — so the main-thread patch below
 * sends a clone-safe {__mockHandleId, tree} descriptor instead, and this
 * prelude revives it back into a live handle (with real entries()/getFile()
 * methods) before the app's own onmessage handler runs. Registered via
 * addEventListener so it fires first regardless of the app's `self.onmessage
 * = ...` assignment (same-target listeners run in registration order).
 */
const WORKER_PRELUDE = `
function __reviveMockHandle(node) {
  if (node.kind === 'file') {
    return {
      kind: 'file',
      name: node.name,
      async getFile() {
        return new File([new Uint8Array(node.size ?? 10)], node.name, { lastModified: node.lastModified ?? Date.now() });
      },
    };
  }
  const children = node.children.map(__reviveMockHandle);
  return {
    kind: 'directory',
    name: node.name,
    async *entries() {
      for (const child of children) yield [child.name, child];
    },
  };
}
self.addEventListener('message', (event) => {
  const data = event.data;
  if (data && data.type === 'scan' && data.root && data.root.__mockHandleId) {
    data.root = __reviveMockHandle(data.root.tree);
  }
}, true);
`

/**
 * Native folder-picker dialogs can't be automated (plan.md Section 16), so
 * E2E tests mock the File System Access API instead: `window.showDirectoryPicker`,
 * the postMessage hop to the scan Worker, and idb-keyval's IndexedDB
 * persistence. A real `FileSystemDirectoryHandle` is a browser host object
 * with special structured-clone support a plain mock object doesn't have, so:
 * - idb-keyval's real IndexedDB storage is replaced with a sessionStorage-backed
 *   stub (survives page.reload(), unlike an in-memory Map — each navigation is
 *   a fresh JS realm) that stores a marker for the handle and rehydrates it
 *   from `window.__mockRootHandle`, which addInitScript rebuilds fresh on every
 *   navigation before any app code runs.
 * - `Worker.prototype.postMessage` is patched to swap a mock handle for a
 *   clone-safe descriptor before sending; the worker-side prelude above
 *   revives it back into a live handle on arrival.
 */
export async function installMockFileSystem(
  page: Page,
  tree: MockDirNode,
  options: { permission?: 'granted' | 'prompt' | 'denied' } = {},
) {
  await page.route('**/idb-keyval.js*', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: `
        const PREFIX = 'e2e-idb-stub:';
        export function get(key) {
          const raw = sessionStorage.getItem(PREFIX + key);
          if (raw === null) return Promise.resolve(undefined);
          const parsed = JSON.parse(raw);
          if (parsed && parsed.__mockHandleMarker) return Promise.resolve(window.__mockRootHandle);
          return Promise.resolve(parsed);
        }
        export function set(key, value) {
          const isHandle = value && typeof value === 'object' && value.kind === 'directory' && typeof value.entries === 'function';
          sessionStorage.setItem(PREFIX + key, JSON.stringify(isHandle ? { __mockHandleMarker: true } : value));
          return Promise.resolve();
        }
        export function del(key) {
          sessionStorage.removeItem(PREFIX + key);
          return Promise.resolve();
        }
      `,
    }),
  )

  await page.route('**/scan.worker.ts?worker_file*', async (route) => {
    const response = await route.fetch()
    const original = await response.text()
    await route.fulfill({ response, body: `${WORKER_PRELUDE}\n${original}` })
  })

  await page.addInitScript(
    ({ tree, permission }) => {
      function buildHandle(node: MockFileNode | MockDirNode): unknown {
        if (node.kind === 'file') {
          return {
            kind: 'file',
            name: node.name,
            async getFile() {
              const size = node.size ?? 10
              return new File([new Uint8Array(size)], node.name, {
                lastModified: node.lastModified ?? Date.now(),
              })
            },
          }
        }
        const childHandles = node.children.map(buildHandle)
        return {
          kind: 'directory',
          name: node.name,
          __isMockHandle: true,
          __tree: node,
          async *entries() {
            for (const child of childHandles as { name: string }[]) {
              yield [child.name, child]
            }
          },
          async queryPermission() {
            return (window as unknown as { __mockPermission?: string }).__mockPermission ?? permission
          },
          async requestPermission() {
            const w = window as unknown as { __mockPermission?: string; __mockRequestResult?: string }
            const result = w.__mockRequestResult ?? 'granted'
            w.__mockPermission = result
            return result
          },
        }
      }

      const OriginalPostMessage = Worker.prototype.postMessage
      Worker.prototype.postMessage = function patchedPostMessage(
        this: Worker,
        message: unknown,
        ...rest: unknown[]
      ) {
        const msg = message as { type?: string; root?: { __isMockHandle?: boolean; __tree?: unknown } }
        if (msg && msg.type === 'scan' && msg.root?.__isMockHandle) {
          message = { ...msg, root: { __mockHandleId: true, tree: msg.root.__tree } }
        }
        return (OriginalPostMessage as (this: Worker, ...a: unknown[]) => unknown).apply(this, [message, ...rest])
      }

      const root = buildHandle(tree)
      ;(window as unknown as { showDirectoryPicker: () => Promise<unknown> }).showDirectoryPicker =
        async () => root
      ;(window as unknown as { __mockRootHandle: unknown }).__mockRootHandle = root
    },
    { tree, permission: options.permission ?? 'granted' },
  )
}

/** Small deterministic folder tree used by most E2E tests. */
export const SAMPLE_TREE: MockDirNode = {
  name: 'root',
  kind: 'directory',
  children: [
    { name: 'invoice_2026_march.pdf', kind: 'file', size: 2048, lastModified: Date.UTC(2026, 2, 1) },
    { name: 'report.docx', kind: 'file', size: 9000, lastModified: Date.UTC(2026, 1, 1) },
    {
      name: 'Documents',
      kind: 'directory',
      children: [{ name: 'invoice_2025_march.pdf', kind: 'file', size: 500, lastModified: Date.UTC(2025, 2, 1) }],
    },
  ],
}
