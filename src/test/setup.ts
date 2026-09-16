import '@testing-library/jest-dom/vitest'

// jsdom doesn't implement ResizeObserver; @tanstack/react-virtual needs one to measure rows.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
;(globalThis as unknown as { ResizeObserver: typeof ResizeObserverStub }).ResizeObserver = ResizeObserverStub

// jsdom never lays out elements (every size metric is 0), so a virtualizer
// sees a 0-height scroll container and renders nothing. Give every element a
// fixed viewport-sized height so @tanstack/react-virtual has something to
// compute a visible range against.
Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, value: 500 })
Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 500 })

// jsdom has no Worker implementation. Component-tree smoke tests that render
// the real FileSearchStoreProvider (default deps) need `new Worker(...)` to
// not throw; tests that exercise actual scan/query behavior inject a
// FakeWorker via deps (see src/test/fakeFileSearchDeps.ts) instead.
class WorkerStub {
  onmessage: ((event: MessageEvent) => void) | null = null
  postMessage() {}
  terminate() {}
}
;(globalThis as unknown as { Worker: typeof WorkerStub }).Worker = WorkerStub

// jsdom has no matchMedia. Default to "no preference" (light); tests that
// care about a specific OS preference override this locally (see
// useTheme.test.ts, ThemeToggle.test.tsx).
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }) as unknown as MediaQueryList
}
