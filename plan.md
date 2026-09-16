# File Search Web App — Project Plan

## 1. Overview
A single-page web app that lets a user pick a folder on their Windows or Linux machine (via the browser's native folder picker) and instantly search files inside it by name and metadata — no upload, no server, no files ever leaving the device.

## 2. Goals
- Fast, accurate filename/metadata search across a selected folder (recursive)
- No file upload — everything stays local, runs entirely client-side
- Works from a regular browser tab, not an installed app
- Index persists across sessions so re-opening the folder doesn't require a full re-scan
- Clean, keyboard-friendly UI
- Production-grade quality bar: tested, reviewed, security-audited, documented (Section 17)

## 3. Non-Goals (v1)
- Full-text search inside file contents (out of scope now; schema below leaves room to add it later)
- Editing, deleting, or moving files
- Cross-device sync
- Mobile support (the required browser API has no mobile support at all)
- Full feature parity on Firefox/Safari (see constraint below — this is a hard browser limitation, not a design choice)

## 4. Critical Technical Constraint — Read First
This shapes everything else below.

The **File System Access API** (`showDirectoryPicker()`, `FileSystemDirectoryHandle`) is the only web-standard way for a browser tab to get a persistent, re-scannable handle to a real folder on disk. Support is:
- ✅ Chrome 86+, Edge 86+, Opera 72+ — Windows, Linux, macOS
- ❌ Firefox — negative standards position, not shipping it
- ❌ Safari — opposed on security grounds, macOS/iPadOS/iOS
- ❌ No mobile browser exposes the folder picker at all

**Implication:**
- Primary experience targets Chrome/Edge/Opera on Windows and Linux — matches your two target OSes.
- Fallback for Firefox/Safari: one-time, read-only folder listing via `<input type="file" webkitdirectory>` (via the `browser-fs-access` library). This can list name/path/size/type for that session only — no persistent handle, no re-scan, no remembered permission.
- App detects support on load and shows a one-line banner: "Full experience works best in Chrome or Edge. You're in read-only fallback mode."

## 5. Architecture
Pure client-side single-page app. **No backend server.**

```
Browser Tab
├── UI (React + TypeScript)
├── Indexing Web Worker (single worker, serves both scan and query)
│   ├── Walks FileSystemDirectoryHandle recursively, yielding in batches (Section 11)
│   ├── Builds in-memory search index (FlexSearch) incrementally as files are found
│   ├── Handles query messages {query, filters, sort} — search, filter, AND sort
│   │   all happen here, never duplicated in the UI (single source of truth)
│   ├── Answers query messages between walk batches, so live search stays
│   │   responsive during an in-progress scan (see Concurrency below)
│   └── Reports scan progress back to main thread
├── IndexedDB (via idb-keyval)
│   ├── Stores the ROOT FileSystemDirectoryHandle only (structured-cloneable,
│   │   re-request permission on reload — see Permission Flow below).
│   │   Individual IndexEntry records do NOT carry a handle in Phase 1 (Section 7).
│   └── Caches last-built entry list; FlexSearch index is rebuilt from it in the
│       worker on load (not persisted itself — see Section 9 performance note)
└── Search Engine (FlexSearch, inside the worker)
```

Why a worker: recursively walking a large folder and building an index will freeze the UI if done on the main thread. Only queries and results cross the thread boundary.

**Worker concurrency (scan + search share one worker):**
- The walk runs in small yielded batches (Section 11). A query message is always
  processed between batches — this is cooperative scheduling, not true preemption,
  and is sufficient because batches are already small.
- Every walk carries an incrementing **generation counter**. Clicking Refresh or
  picking a new folder bumps the generation; any in-flight walk checks its
  generation before each batch and aborts if stale. This prevents two concurrent
  walks from writing into the same FlexSearch instance (a real corruption path,
  not an edge case) — only one walk's writes are ever live at a time.

**Permission flow (reload):**
- On boot: call `queryPermission()` on the stored root handle (silent, no user
  gesture required). If `granted`, restore the cached entry list instantly and
  rebuild the FlexSearch index in the worker — **no automatic re-scan**; only the
  manual Refresh button (Section 8 item 9) triggers a full re-scan.
- If not granted: show a "Resume access to `<folder>`" button. `requestPermission()`
  requires transient user activation (a real click) and will silently fail if
  called automatically on page load — this is a browser spec constraint, not a
  design choice. The click on "Resume access" is what satisfies it.
- If the user dismisses the initial `showDirectoryPicker()` prompt: no-op, stay on
  the empty "select a folder" state.
- If a subfolder throws `NotAllowedError` mid-walk (e.g. an OS-restricted
  directory): skip that subtree, log it, continue walking siblings. Surface a
  "N folders skipped (no permission)" note rather than aborting the whole scan.

## 6. Tech Stack
| Layer | Choice | Why |
|---|---|---|
| Framework | React + TypeScript + Vite | Fast dev loop, static build output, no server needed |
| Search index | FlexSearch | Built for large in-browser datasets; faster than Fuse.js at scale; supports contains/prefix/fuzzy |
| Persistence | idb-keyval | Thin, reliable IndexedDB wrapper for handles + cached index |
| Fallback | browser-fs-access | Handles Firefox/Safari gracefully instead of hand-rolled detection |
| Large lists | @tanstack/react-virtual | Renders 50k+ results without DOM meltdown |
| State | Zustand | Minimal boilerplate for this scope |
| Styling | Tailwind CSS | Fast to build a clean UI without a design-system dependency |
| Testing | Vitest + React Testing Library; Playwright for e2e (handle mocked) | |

No backend, no database server, no auth. Static app: `npm run dev` locally, or deploy as static files if ever hosted.

## 7. Data Model
```ts
interface IndexEntry {
  id: string;                                              // stable id (path hash)
  name: string;                                             // "invoice_2026_03.pdf"
  path: string;                                              // "Documents/Invoices/2026/invoice_2026_03.pdf"
  extension: string;                                          // "pdf"
  kind: "file" | "directory";
  size: number;                                                // bytes (0 for directories)
  lastModified: number;                                         // epoch ms
  handle?: FileSystemFileHandle | FileSystemDirectoryHandle;     // Phase 1: always undefined; reserved for Phase 2 preview (Section 10)
}
```
`FileSystemHandle` objects are structured-cloneable, so no serialize/re-resolve step is
needed *when a handle is actually stored*. In Phase 1, no per-entry handle is stored at
all: no MVP feature (search, filter, sort, copy-path, virtualized list) ever reads one
back — copy-path works off `path`. Only the **root** `FileSystemDirectoryHandle` persists
(one record, stored separately — see Section 5's IndexedDB layer), used for permission
re-grant and to re-walk on refresh. This also resolves the fallback path cleanly: the
Firefox/Safari fallback (Section 4) yields plain `File` objects with `webkitRelativePath`,
which have no `FileSystemHandle` at all — `handle` being optional means the same
`IndexEntry` shape works for both ingestion paths without a special case.

Design ceiling: this schema and the worker/IndexedDB architecture in Section 5 target
**10,000–50,000 entries**. It is not designed or tested against 500k-entry trees (see
Section 18).

## 8. Core Features — MVP (Phase 1)
1. **Folder picker** — "Select Folder" → `showDirectoryPicker()`; fallback banner + `<input webkitdirectory>` where unsupported. Dismissing the native picker is a no-op — stay on the empty "select a folder" state.
2. **Recursive scan** — walks all subfolders into the index above, with a live progress indicator ("Scanned 4,213 files…"). Runs under the worker's generation-counter scheme (Section 5) so a new scan (Refresh, or a new folder pick) cleanly supersedes an in-flight one. A subfolder that throws `NotAllowedError` is skipped (with a "N folders skipped" note), not fatal to the whole scan.
3. **Instant search** — debounced (~120–150ms) type-ahead, searches `name` (optionally `path`) via FlexSearch, computed in the worker. **Available during an in-progress scan** — returns live partial results against whatever the index contains so far, not blocked until the scan completes.
4. **Filters** — extension, size range, date-modified range, files-only/folders-only toggle. Combined with the search query and sort **inside the worker** (Section 5) — the UI never re-filters or re-sorts independently, avoiding duplicated match logic.
5. **Sort** — name, size, date modified, relevance. Same worker-side handling as filters (item 4).
6. **Results list** — virtualized, shows name, path, size, modified date, type icon.
7. **Copy path** — click a result to copy its relative path via `navigator.clipboard.writeText()`, with a success/failure toast. (Can't "open in Explorer" — the browser sandbox forbids invoking the OS shell; worth stating explicitly so it's not a surprise gap.)
8. **Persisted session** — reopening the app (Chrome/Edge only) restores the cached entry list from IndexedDB and rebuilds the in-worker FlexSearch index **instantly, with no automatic re-scan**. Permission is re-checked silently via `queryPermission()`; if not already granted, a "Resume access to `<folder>`" button (real click, satisfies the browser's `requestPermission()` user-activation requirement — see Section 5) is shown instead of a broken/stuck restore.
9. **Manual refresh** — the *only* action that triggers a full re-scan (no native file-watching API exists for this).
10. **Unsupported-browser banner** — per Section 4.

## 9. Search Capabilities
- Plain substring match (default, case-insensitive)
- Fuzzy/typo-tolerant toggle (FlexSearch fuzzy mode)
- Extension shorthand — `.pdf` or `ext:pdf` filters by extension
- Multi-term AND — "invoice 2026" matches names containing both
- Optional: simple wildcard support (`*`, `?`)
- Regex mode (Phase 2, Section 10) must validate/bound user-supplied patterns before running — an unbounded regex against tens of thousands of filenames in the worker is a ReDoS risk against your own UI, not just a theoretical one

## 10. Feature Roadmap — Phase 2+ (not blocking the initial build)
- **Multi-folder indexing** — index several folders, tag results by source root
- **Duplicate finder** — by name+size (cheap) or content hash (expensive, opt-in)
- **File preview** — text/image files under a size cap via `getFile()` + blob URL
- **Saved searches / search history**
- **Ignore patterns** — skip `node_modules`, `.git`, etc., configurable with sensible defaults
- **Export results** — CSV/JSON of current result set
- **Regex search mode** — see the ReDoS note in Section 9
- **Content search (opt-in, later)** — text extraction for text-based files (`.txt`, `.md`, `.json`, code). Out of scope now, but the schema in Section 7 leaves room for a `content` field without a rewrite
- **PWA / installable**, offline-capable
- **Keyboard-first UX** — `/` to focus search, arrows + Enter to select, copy-path shortcut
- **Dark/light theming**
- **Multi-tab sync** via `BroadcastChannel`

## 11. Performance Considerations
- All scanning/indexing in a Web Worker — never block the UI thread
- Batch directory walking (yield periodically) so progress UI stays responsive on huge trees
- Virtualized rendering for result lists
- Debounce search-as-you-type (~120–150ms)
- Cache index in IndexedDB for instant return visits, with background re-scan
- Baseline and track with gstack's `/benchmark` (Section 14) so a regression shows up on the PR, not after users notice

## 12. Security & Privacy
- No files are ever uploaded — 100% client-side, nothing to leak from a backend that doesn't exist
- Permissions are per-origin, browser-managed; users can revoke folder access via browser site settings anytime
- State clearly in-app that this only reaches folders the user explicitly grants, and never outside the browser sandbox

**VibeSec-Skill category applicability** — this app has no backend, no accounts, and no API, so most of a standard web-app security checklist doesn't apply. Scoping it explicitly avoids wasted review effort chasing non-issues:

| VibeSec category | Applies here? | Why |
|---|---|---|
| Access Control (IDOR, privilege escalation, mass assignment) | No | No backend, no accounts, no server-side records to escalate into |
| Client-Side (XSS stored/reflected/DOM, CSRF, secret exposure, open redirect) | **Partially — real** | XSS is live wherever filenames/paths are rendered (they're untrusted input straight off the user's disk); CSRF and open redirect are N/A (no server, no redirects); secret exposure is N/A (no API keys shipped, nothing to leak) |
| Server-Side (SSRF, SQLi, XXE, path traversal, insecure upload) | No | No server, no database, no upload endpoint |
| Authentication (passwords, sessions, JWT) | No | No accounts |
| API Security (mass assignment, GraphQL) | No | No API |

The one real item: **filenames and paths are untrusted input.** Render them as text only (React's default escaping is enough) — never through `dangerouslySetInnerHTML` or manual HTML string building. Same discipline applies to the Phase-2 regex search mode (Section 9).

**Supply-chain hygiene**: no server-side attack surface doesn't mean no attack surface — the shipped JS bundle is one. `npm audit` (or equivalent) clean before each release; see Section 17.

## 13. Known Hard Limitations (surface these up front, not discovered later)
- No full Firefox/Safari support (Section 4)
- No native "reveal in File Explorer / open file" — sandbox forbids invoking the OS shell
- No real-time file-system watching — changes need a manual refresh
- No mobile browser support

## 14. Claude Code Tooling & Process
Four skill/plugin packs are installed in the terminal this gets built in. Each does a different job — here's the division of labor so they reinforce each other instead of duplicating work:

| Tool | Role in this build |
|---|---|
| **gstack** | The sprint backbone: Think → Plan → Build → Review → Test → Ship → Reflect. Supplies the planning gate (`/plan-eng-review`), the staff-engineer bug pass (`/review`), the security audit (`/cso` — OWASP + STRIDE), live-browser QA (`/qa`), performance baselining (`/benchmark`), and release (`/ship`, `/document-release`). |
| **ECC** | Code-level discipline within each gstack stage: `tdd-workflow` (RED → GREEN → REFACTOR with evidence) for every feature, `security-review` skill and `typescript-reviewer`/`security-reviewer` agents for continuous review, `e2e-testing` skill (Playwright, Page Object Model) fulfilling Section 16. ECC's `backend-patterns`/`api-design`/`database-migrations` skills are N/A — there's no backend — skip them rather than force-fitting. |
| **VibeSec-Skill** | Security knowledge injected into every `/cso` and `/security-review` pass, scoped per the applicability table in Section 12 — don't let it chase SQLi/SSRF/auth findings that can't exist in a backend-less app. |
| **ponytail** | Runs continuously (default `full` level). It's the mechanical enforcement of Section 5/6's own bias toward native platform features over extra libraries — e.g. it's the reason a native `<input type="date">` beats installing a date-picker component for the date-modified filter. Run `/ponytail-review` after each phase to catch anything that crept toward over-engineering. |

If `/review` (gstack) and ECC's `security-review`/`typescript-reviewer` flag the same thing, that's a good sign, not redundant work — fix it once. If they disagree, prefer gstack's finding for architecture-level calls (it has the fuller picture of the plan) and ECC's for language-specific idiom calls.

## 15. Build Phases
1. **Phase 0 — Scaffold**: Vite + React + TS, Tailwind, base layout, browser-support detection. Run `/plan-eng-review` (gstack) against this plan.md *before* writing code — lock architecture, surface any hidden assumption.
2. **Phase 1 — MVP** (Section 8): built feature-by-feature via ECC's `tdd-workflow` (RED test → implement → GREEN → refactor). After each feature: `/ponytail-review`. After the full phase: `/review` (gstack), then `/cso` (gstack, scoped per Section 12's table).
3. **Phase 2 — Polish**: keyboard nav, dark mode, copy path, fallback UX. Same TDD + review loop as Phase 1.
4. **Phase 3 — Roadmap features**: pick from Section 10 based on real usage. Regex search mode specifically needs the ReDoS bound from Section 9 before it ships.
5. **Release gate**: Section 17, every time before calling a phase "done."

## 16. Testing Strategy
- **TDD per feature** via ECC's `tdd-workflow` — failing test first, evidence captured, then implement to green
- Unit tests for indexing/search logic (pure functions, testable outside the sandbox) — target 80%+ coverage per ECC's testing standard
- Component tests (React Testing Library)
- E2E via ECC's `e2e-testing` skill (Playwright, Page Object Model), with `FileSystemDirectoryHandle` mocked — native dialogs can't be automated
- Live-browser pass via gstack's `/qa` for anything the mocked E2E can't reach

## 17. Production-Readiness Gate
All of these before a phase is "done," not just Phase 1:
- [ ] `/plan-eng-review` (gstack) run and its findings incorporated
- [ ] TDD followed per ECC's `tdd-workflow`, 80%+ coverage
- [ ] `/review` (gstack) clean
- [ ] `/cso` (gstack) clean, scoped to the Section 12 applicability table — don't chase N/A categories
- [ ] `/ponytail-review` clean — no unnecessary abstraction or dependency
- [ ] `/qa` (gstack) live-browser pass exercising folder picker, search, filters
- [ ] `/benchmark` (gstack) baseline captured, no regression vs. previous baseline
- [ ] `npm audit` (or equivalent) clean — supply-chain hygiene on the shipped bundle
- [ ] `/document-release` (gstack) — README, this plan.md, and PROGRESS.md all reflect what actually shipped
- [ ] `/ship` (gstack) — final coverage audit, PR opened

## 18. Open Questions
- Should Firefox/Safari fallback be fully supported, or best-effort with a banner? Plan above assumes best-effort.
- ~~Any target file-count ceiling to design/test against (10k files vs 500k)?~~ **Resolved in `/plan-eng-review`:** 10,000–50,000 entries (Section 7). Not designed or tested for 500k-entry trees.
- Confirming: no hidden requirement to host this anywhere beyond localhost — it's 100% client-side either way.
- **Strategic premise (raised in `/plan-eng-review` outside voice, acknowledged, not blocking):** native OS tools (Everything/voidtools on Windows, `fd`/`plocate` on Linux) already do instant, whole-filesystem, continuously-updated search with no folder-picker ritual or per-session permission re-grant. This plan doesn't name a specific constraint (locked-down machine, no install rights, one UI across Windows+Linux) that makes a browser tab the better answer. Doesn't change Phase 0/1 scope; worth an explicit answer in Section 2 if this plan is revisited.

## 19. NOT in Scope (from `/plan-eng-review`)
Work considered during review and explicitly deferred, each with a one-line rationale:
- **Deriving handles from the root by path on demand** (Issue 1C alternative) — rejected in favor of the simpler "root handle only, no per-entry handle" design; adds an async walk per file-open with no Phase 1 consumer.
- **500k-file design ceiling** — explicitly out of scope; this architecture targets 10k–50k entries (Section 7). Scaling further is a distinct, unscoped effort (different storage/indexing strategy).
- **Persisting FlexSearch's own exported index** (Issue 4A alternative) — rejected; rebuilding from cached `IndexEntry` records on load is simpler and fast enough at the stated ceiling. Revisit only if `/benchmark` (Section 17) shows rebuild time is actually slow.
- **CI/CD build/publish pipeline** — N/A. This is a client-side app run via `npm run dev` or served as static files; there is no distributable artifact (binary/package/container) to build and publish. Confirmed against Section 18's open question (no hosting requirement beyond localhost).
- **Native `Array.includes` in place of FlexSearch** (Issue F, outside voice) — rejected; Section 9 requires a fuzzy/typo-tolerant toggle, which FlexSearch already covers alongside plain substring match in one dependency.
- **Auto re-scan on tab reopen** — rejected; contradicted the Phase 1 acceptance criteria. Only the manual Refresh button re-scans (Section 8 item 9).
- **All Section 10 Phase 2+ roadmap items** (multi-folder, duplicate finder, preview, saved searches, ignore patterns, export, regex mode, content search, PWA, keyboard-first UX, theming, multi-tab sync) — unchanged, already scoped to Phase 2/3.
- **Scaling down Section 17's production gate** (Issue H, outside voice) — considered and rejected; you specified this exact gate explicitly before this review started. Kept as-is.

## 20. What Already Exists
The repository is greenfield — only `plan.md` and `prompt.md` exist, no source code. Nothing to reuse from within this project. What the plan already correctly reuses instead of hand-rolling (verified via research during this review, Section 6):
- **FlexSearch** — confirmed the right choice over MiniSearch/Fuse.js for a 10k+ entry, fuzzy-capable client-side search (MiniSearch is lighter but FlexSearch is faster at this scale; Fuse.js targets <10k items).
- **idb-keyval + structured-clone storage of `FileSystemDirectoryHandle`** — confirmed as the standard, Chrome-documented pattern for persistent folder access across reloads, not a custom serialization scheme.
- **Transferring `FileSystemDirectoryHandle` to a Web Worker via `postMessage`** — confirmed structured-cloneable and usable inside a worker; the Section 5 architecture is standards-compliant, not a workaround.
- **`browser-fs-access`** for the Firefox/Safari fallback — avoids hand-rolled feature detection, per Section 6's own stated rationale.

## 21. Failure Modes (from Test Review diagram, Section 16/17 test coverage)
For each new codepath, one realistic production failure and whether it's covered:

| Codepath | Failure mode | Test? | Error handling? | User sees |
|---|---|---|---|---|
| Directory walk | `NotAllowedError` on a restricted subfolder | Required (new) | Yes — skip subtree, continue (Section 5) | "N folders skipped" note, not silent |
| Directory walk | Two walks race (Refresh mid-scan) | Required (new) | Yes — generation counter (Section 5) | Old walk's results never appear; no corruption |
| Permission restore | `requestPermission()` called without a click | Required (new) | Yes — `queryPermission()` + gated "Resume access" button (Section 5) | Explicit resume prompt, not a stuck/broken restore |
| Picker | User dismisses `showDirectoryPicker()` | Required (new) | Yes — no-op (Section 8 item 1) | Empty "select a folder" state |
| Clipboard | `navigator.clipboard.writeText()` denied/unsupported | Required (new) | Yes — failure toast (Section 8 item 7, task T5) | Explicit failure toast, not silent failure |
| IndexedDB write | Quota exceeded on a very large scan | Deferred (TODOS.md, P3) | Not yet — out of scope at 10k–50k ceiling | Out of scope for Phase 1 |
| FlexSearch rebuild | Rebuild-from-cache is slow at the top of the 10k–50k range | To be measured (`/benchmark`, Section 17) | N/A (perf, not correctness) | Perceived lag on reopen if unmeasured |

**Critical gap found and resolved during this review:** the clipboard-write failure path (copy-path button) initially had no specified error handling. Fixed by adding an explicit success/failure toast requirement to Section 8 item 7 and task T5 above — no open critical gaps remain.

## 22. Worktree Parallelization Strategy
Sequential implementation, no meaningful parallelization opportunity for Phase 0+1: the worker (scan+search+filter+sort), the IndexedDB layer, and the UI components all depend on the shared `IndexEntry` type and the worker's message contract being settled first. Splitting across worktrees would mean two lanes both guessing at the same not-yet-written interface, which is more coordination overhead than the ~10-12 files justify. Build Phase 0 scaffold → worker + types → IndexedDB layer → UI components, in that order, within one workstream.

## 23. Implementation Tasks
Synthesized from this review's findings. Each task derives from a specific finding above. Run with Claude Code; checkbox as you ship.

- [ ] **T1 (P1)** — worker — Implement `scan.worker.ts` with batched recursive walk, generation-counter cancellation, and incremental FlexSearch indexing
  - Surfaced by: Architecture Issue 1A/1B, Cross-model Issue E — worker concurrency
  - Files: `src/workers/scan.worker.ts`, `src/lib/types.ts`
  - Verify: unit tests for batch yielding, generation-counter abort on stale walk, `NotAllowedError` subtree skip
- [ ] **T2 (P1)** — worker — Implement `handleQuery({query, filters, sort})` message handler (search + filter + sort, single source of truth)
  - Surfaced by: Code Quality Issue 2A
  - Files: `src/workers/scan.worker.ts`
  - Verify: unit tests per Section 16 coverage diagram (substring, fuzzy, ext shorthand, multi-term AND, each filter, each sort key)
- [ ] **T3 (P1)** — persistence — Implement root-handle-only IndexedDB storage + `queryPermission()`/`requestPermission()` gated-button flow
  - Surfaced by: Cross-model Issue B (spec-compliance bug) — verified against MDN
  - Files: `src/lib/db.ts`, `src/components/FolderPicker.tsx`
  - Verify: test reopen with granted / not-granted / dismissed permission states
- [ ] **T4 (P1)** — types — Make `IndexEntry.handle` optional; verify fallback ingestion path populates the schema without it
  - Surfaced by: Cross-model Issue C (data model gap) and Issue D (unused per-entry handles)
  - Files: `src/lib/types.ts`, fallback ingestion code
  - Verify: unit test that fallback-path entries construct validly with `handle: undefined`
- [ ] **T5 (P2)** — UI — Copy-path clipboard write with explicit success/failure toast
  - Surfaced by: Failure Modes — critical gap (clipboard write has no specified error handling)
  - Files: `src/components/ResultsList.tsx`
  - Verify: test clipboard failure path shows a toast, not silent failure
- [ ] **T6 (P2)** — perf — `/benchmark` pass isolating FlexSearch rebuild-from-cache time at 10k–50k entries
  - Surfaced by: Performance Issue 4A
  - Files: n/a (measurement task, part of Section 17 gate)
  - Verify: rebuild time reported and reviewed against "instant" claim in Section 8 item 8
- [ ] **T7 (P3, TODOS.md)** — persistence — IndexedDB quota/eviction handling
  - Surfaced by: TODO candidate, approved for TODOS.md
  - Files: `src/lib/db.ts`
  - Verify: n/a — tracked in TODOS.md, not required for Phase 1
- [ ] **T8 (P2, TODOS.md)** — security — CSP `connect-src 'none'` (or equivalent) as runtime-enforced network-egress guard
  - Surfaced by: TODO candidate, approved for TODOS.md
  - Files: `index.html` or Vite config
  - Verify: n/a — tracked in TODOS.md, not required for Phase 1

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | not run |
| Outside Review | Claude subagent (native fallback — Codex not authenticated) | Independent 2nd opinion | 1 | completed | 8 findings (A-H), all presented as cross-model tension and resolved with the user |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR | 11 issues, 0 critical gaps (all resolved and folded into plan.md) |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | not run |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | not run |

**OUTSIDE COVERAGE:** Codex CLI is installed but not authenticated (`CODEX_MODE: not_authed`) — fell back to a Claude subagent with fresh context per the skill's documented fallback. Same harness as this review; model identity is not independently verifiable, so treat this as an independent *read* rather than a true cross-model check. It surfaced 8 findings the native review missed, most notably a verified browser-spec bug (`requestPermission()` requires user activation, confirmed against MDN) and a fallback-mode data-model gap — both real, both fixed in plan.md.

**VERDICT:** ENG CLEARED — ready to implement. CEO/Design/DX reviews not run (optional; not required to proceed to Phase 0 scaffolding for this scope).

NO UNRESOLVED DECISIONS
