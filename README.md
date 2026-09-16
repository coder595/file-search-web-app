# File Search

A single-page web app that lets you pick a folder on your machine and instantly
search files inside it by name and metadata — no upload, no server, no files
ever leaving your device.

See [`plan.md`](./plan.md) for the full project plan, architecture, and
production-readiness gate. See [`PROGRESS.md`](./PROGRESS.md) for current
build status.

## Browser support

This app relies on the **File System Access API** (`showDirectoryPicker()`),
which only Chrome, Edge, and Opera implement (Windows/Linux/macOS). Firefox
and Safari have no plans to support it.

- **Chrome / Edge / Opera:** full experience — persistent folder access,
  incremental search during scan, cached index for instant reopening.
- **Firefox / Safari:** a one-line banner appears and the app falls back to a
  read-only, session-only file listing via `<input type="file" webkitdirectory>`.
  No persistence, no re-scan, no remembered permission — you re-pick the
  folder every visit.
- **Mobile browsers:** not supported. No mobile browser exposes a folder
  picker at all.

This is a hard platform limitation, not a design choice — see `plan.md`
Section 4.

## Keyboard shortcuts

- `/` — focus the search box (works in both Chrome/Edge and the Firefox/Safari fallback)
- `↑` / `↓` — move the selection in the results list
- `Home` / `End` — jump to the first / last result
- `Enter` — copy the selected result's path (same as clicking it)

## Dark mode

Follows your OS preference by default; click the toggle in the header to
override it. Your choice is remembered across reloads.

## Setup

```bash
npm install
npm run dev       # start the dev server at http://localhost:5173
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check (`tsc -b`) and produce a production build |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run oxlint |
| `npm test` | Run the Vitest unit/component suite once |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run test:coverage` | Run tests with a coverage report (80% threshold, per `plan.md` Section 17) |
| `npm run e2e` | Run the Playwright E2E suite |

## Architecture

```
Browser Tab
├── UI (React + TypeScript, Tailwind CSS)
├── Indexing Web Worker (src/workers/) — walks the folder, builds a
│   FlexSearch index, and answers search/filter/sort queries
├── IndexedDB (src/lib/db.ts, via idb-keyval) — persists the root folder
│   handle and the last scan's entries for instant reload
└── Zustand store (src/store/) — orchestrates the UI, worker, and IndexedDB
```

- `src/lib/` — pure helpers: shared types, browser-support detection,
  IndexedDB persistence, permission flow, fallback-mode file ingestion
- `src/workers/` — the scan worker and its pure logic (directory walk,
  search index, filtering, sorting, query parsing)
- `src/store/` — the Zustand store and its React binding
- `src/components/` — UI components
- `src/test/` — shared test fixtures (fake worker/dependencies, jsdom setup)

No file content or path is ever sent over the network — everything above runs
entirely client-side.
