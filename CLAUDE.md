# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev                              # dev server at http://localhost:5173
npm run build                            # tsc -b && vite build (type-checks, then builds)
npm run lint                             # oxlint

npm test                                 # vitest run (full unit/component suite)
npx vitest run src/path/to/file.test.ts  # single test file
npx vitest run -t "test name substring"  # single test by name
npm run test:watch                       # vitest in watch mode
npm run test:coverage                    # vitest run --coverage (80% threshold, see vite.config.ts)

npm run e2e                              # playwright test (starts its own dev server)
npx playwright test tests/e2e/foo.spec.ts -g "test name"   # single E2E test

./scripts/package-portable.sh            # build + zip a no-npm-install portable release
```

Vitest excludes `tests/e2e/**` (Playwright specs use `@playwright/test`, not Vitest — they are not interchangeable runners; do not add Playwright specs under `src/`).

## Architecture

This is a 100% client-side SPA (Vite + React + TypeScript + Tailwind v4, Zustand for state) — no backend exists or is planned. The core constraint shaping everything: the **File System Access API** (`showDirectoryPicker()`) only works in Chrome/Edge/Opera, so the app has two parallel UI paths gated by `src/lib/browserSupport.ts`:

- **Live path** (Chrome/Edge): `App.tsx` → `FileSearchStoreProvider` → `FolderPicker` / `SearchBar` / `FiltersPanel` / `ResultsList`, all reading from the Zustand store.
- **Fallback path** (Firefox/Safari, or `window.__FORCE_FALLBACK__` for testing): `FallbackFileList.tsx` — self-contained, no worker, no IndexedDB persistence, session-only (`browser-fs-access`'s `directoryOpen()`).

Both paths render results through the **same** `VirtualizedEntryTable.tsx` (`@tanstack/react-virtual`) — keyboard nav, ARIA listbox semantics, and copy-path behavior are written once and apply to both.

### The scan/search worker (`src/workers/`)

All directory walking and searching happens in a single dedicated Web Worker (`scan.worker.ts`), never the main thread. The worker owns a `ScanController` (`scanController.ts`) that holds one `SearchIndex` (a FlexSearch wrapper) and serves two concerns from the same instance:

- **Scanning** (`walk.ts`): recursive, batched/yielded directory walk. Every `scan()` call bumps an internal generation counter; a stale walk checks it before each batch and aborts if superseded — this is what lets clicking Refresh or picking a new folder mid-scan cleanly cancel the old walk instead of corrupting the index with two interleaved writers.
- **Querying** (`filters.ts`, `sort.ts`, `queryParse.ts`): search + filter + sort all happen here, in the worker, so the UI never re-implements "what counts as a match" — it just renders whatever `query-result` messages send back. Search is live during an in-progress scan, not blocked until it finishes.
- **Restoring** (`restore()`): rebuilds the FlexSearch index from IndexedDB-cached entries on reload with no directory walk, for instant reopen.

The worker message contract (`WorkerInMessage`/`WorkerOutMessage`) is the seam between `src/store/fileSearchStore.ts` and `scan.worker.ts` — read both together when changing it.

**Ignore patterns** (`src/lib/ignorePatterns.ts`) skip whole directories *during the walk*, not as a post-hoc query filter — `walk.ts` checks each directory name against the set before recursing into it, so an ignored folder is never indexed at all (see the `scanned`/`skipped`/`ignored` counts in `scan-complete`). The pattern list is exact-name matching only (no globs), persisted in `localStorage` independent of the IndexedDB-cached index, and flows store → `scan` worker message → `walk.ts` on every scan/refresh.

### Store and dependency injection (`src/store/`)

`fileSearchStore.ts` is a vanilla Zustand store (not the React-hook `create()`) that orchestrates the worker, `src/lib/db.ts` (IndexedDB via `idb-keyval`), and `src/lib/permission.ts` (the File System Access permission flow). Every browser-API dependency is injected via a `FileSearchDeps` object (`createWorker`, `showDirectoryPicker`, `checkPermission`, `loadRootHandle`, etc.) with `defaultFileSearchDeps` as the real implementation. `FileSearchStoreProvider.tsx` provides one shared store instance via React context and calls `init()` on mount.

This DI pattern exists because none of `Worker`, `IndexedDB`, or `showDirectoryPicker()` exist in jsdom — component tests inject `makeFakeDeps()` (`src/test/fakeFileSearchDeps.ts`, a `FakeWorker` + mocked storage) instead of hitting real browser APIs. `src/test/setup.ts` stubs `Worker`, `ResizeObserver`, and `matchMedia` globally so a component tree can at least mount without crashing even when a test doesn't care about worker/theme behavior.

**Permission flow is spec-constrained, not a design choice**: `queryPermission()` can run silently on load, but `requestPermission()` requires real user-gesture activation — calling it automatically throws. This is why `resumeAccess()` exists as a separate, button-gated action from `init()`'s silent check.

### Keyboard navigation and ARIA (`VirtualizedEntryTable.tsx`)

Because rows are virtualized, off-screen entries don't exist in the DOM, so selection is `selectedIndex` React state, not DOM focus — the container (`role="listbox"`, `tabIndex=0`) owns focus and `aria-activedescendant`; rows are `role="option"` `<div>`s (never `<button>` — overriding a native interactive element's implicit ARIA role is unreliable across screen readers). `selectedIndex` resets to `0` whenever the `entries` prop reference changes; `virtualizer.scrollToIndex()` is called only from inside the arrow-key handlers themselves, never from an effect watching `entries` — otherwise a debounced search-as-you-type refresh would cause the list to jump on every keystroke.

### E2E mocking (`tests/e2e/fixtures/mockFileSystem.ts`)

Native OS folder-picker dialogs cannot be automated by any tool (Playwright included), so E2E tests mock `window.showDirectoryPicker`. This requires more than a plain object: a real `FileSystemDirectoryHandle` is a browser host object with structured-clone support a mock object lacks, so it can't cross `postMessage` to the real worker or round-trip through real `IndexedDB`. The fixture works around both: `Worker.prototype.postMessage` is patched to swap the mock handle for a clone-safe `{tree}` descriptor before sending (revived by a prelude injected into the worker's own script via `page.route`), and idb-keyval's module is replaced with a `sessionStorage`-backed stub (survives `page.reload()`, unlike an in-memory `Map`, since each navigation is a fresh JS realm).

### Portable build (`scripts/package-portable.sh`)

Zips `dist/` plus `scripts/run.sh`/`run.bat` into a build that needs no `npm install` — just Python or Node already on the machine to serve the static files (a browser refuses to load ES modules from `file://`). `run.bat` must not rely on a bare `where python` check: Windows 11 ships a `python.exe` App Execution Alias stub on `PATH` (`...\WindowsApps\python.exe`) that exists even with no real Python installed and just opens the Microsoft Store instead of running anything — the script filters that path out before trusting the match.

## Process notes

`plan.md` is the source-of-truth design doc (architecture, data model, phase-by-phase build log, and a running `## GSTACK REVIEW REPORT` — read it before making architectural changes). `PROGRESS.md` tracks phase status and the production-readiness gate. `TODOS.md` holds deferred, explicitly-scoped-out work — check it before adding speculative features.

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
- Author a backlog-ready spec/issue → invoke /spec
