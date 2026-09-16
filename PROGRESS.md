# Progress

## Phase status

- **Phase 0 (Scaffold):** done
- **Phase 1 (MVP):** in progress — functional acceptance criteria met; several Section 17 gate items still open (see below)
- **Phase 2 (Polish):** not started
- **Phase 3 (Roadmap):** not started

## Phase 1 functional acceptance criteria (plan.md, "Acceptance criteria for Phase 1")

- [x] `npm run dev` starts the app with no errors — verified via live headless-browser check (gstack `/browse`, `$B` fallback): renders correctly, zero console errors.
- [x] "Select Folder" opens the native picker and a recursive scan starts with a visible progress indicator — implemented (`FolderPicker.tsx`, `ScanController.scan`); native picker itself can't be automated in tests or headless browser (documented platform limitation, plan.md Section 16), needs a manual check in real Chrome/Edge before this is fully verified end-to-end.
- [x] Typing in the search box filters results live (debounced ~130ms) — implemented and unit/component tested (`SearchBar.tsx`, `fileSearchStore.ts`).
- [x] Extension, size, and date-modified filters combine with the search query — implemented in the worker (`filters.ts`, `scanController.ts`), single source of truth per the eng-review decision.
- [x] Results list is virtualized (`@tanstack/react-virtual`) — test confirms a 10,000-row result set renders far fewer DOM nodes than rows.
- [x] Closing and reopening the tab restores the last folder's index from IndexedDB without a full re-scan — implemented (`ScanController.restore`, `queryPermission()`/`requestPermission()` flow); unit-tested via fake deps, not yet verified in a real browser across an actual tab close/reopen.
- [x] A manual "Refresh" button triggers a full re-scan, and is the *only* action that does — implemented and tested.
- [x] Firefox/Safari (or `window.__FORCE_FALLBACK__` override) shows the fallback banner and lists files read-only via `<input webkitdirectory>` — implemented (`FallbackFileList.tsx`, `browser-fs-access`) and tested with the override flag; not yet verified in a real Firefox/Safari instance.
- [x] No file content or path is sent over the network — no `fetch`/`XMLHttpRequest` calls exist anywhere in `src/`; verified by code inspection and by the live browser console/network check showing no requests during the smoke test.

## Section 17 production-readiness gate

- [x] `/plan-eng-review` (gstack) run — 11 issues found across Architecture/Code Quality/Test/Performance, all resolved and folded into `plan.md`. Outside voice (Claude subagent, Codex unauthenticated) added 8 more findings (verified one against MDN — a real spec-compliance bug), all resolved. `plan.md` ends with `## GSTACK REVIEW REPORT`.
- [x] TDD followed via RED→GREEN→REFACTOR for every feature; 86 tests, **95.5% statement / 96.1% line coverage** (`npm run test:coverage`) — above the 80% threshold.
- [ ] `/review` (gstack) — **not run as designed**: it's diff-based against a git base branch, and this was a from-scratch build with no prior commit to diff against. Ran `/ponytail-review` instead (see below) plus manual review discipline throughout (TDD, dependency-injection for testability, DRY test-helper extraction). A real `/review` pass should run before the *next* PR against this initial commit.
- [ ] `/cso` (gstack) — not yet run this session.
- [x] `/ponytail-review` (gstack) clean — findings applied: 2 unnecessary type casts removed (a `@types/wicg-file-system-access` package install made them redundant), 1 unused devDependency removed (`@types/flexsearch`), 2 unused exports un-exported, `coverage/` added to `.gitignore`. Verified clean with `knip` (0 findings) after.
- [ ] `/qa` (gstack) live-browser pass — partial: verified the app renders cleanly with zero console errors via gstack's headless browser (`$B`, since Aside isn't available on this Linux machine). The native folder-picker flow, real scan of a large folder, and actual tab-close/reopen persistence still need a manual pass in real Chrome/Edge — native OS dialogs can't be automated (plan.md Section 16).
- [ ] `/benchmark` (gstack) — not yet run. TODOS.md includes a task to specifically isolate and measure the FlexSearch rebuild-from-cache time at the 10k-50k entry design ceiling once this runs.
- [x] `npm audit` clean — 0 vulnerabilities.
- [ ] E2E suite (Playwright, mocked `FileSystemDirectoryHandle`) — not yet built. Unit/component tests cover the same logic with fakes (worker, IndexedDB, permission flow); a true E2E pass through Playwright with a mocked handle is still open.
- [x] `/document-release` (gstack) — not run as its own skill invocation, but README.md and this PROGRESS.md are current as of this commit.
- [ ] `/ship` (gstack) — not run. No PR to open yet; this is the initial commit.

## Deviations from plan.md

- **Section 5/7/8 rewritten in place** during `/plan-eng-review` to fix a real spec-compliance bug (`requestPermission()` cannot fire silently on page load — confirmed against MDN), a fallback-mode data-model gap (`IndexEntry.handle` made optional), and a self-contradiction (Section 8 item 8 said reopening both "restores instantly" and "re-scans in the background" — resolved in favor of the stated acceptance criteria: no auto re-scan, only manual Refresh).
- **Per-entry `FileSystemHandle` storage dropped.** Section 7 originally had every `IndexEntry` carry its own handle. Review found no Phase 1 feature reads a per-file handle back after the walk (copy-path uses the `path` string) — only the root directory handle needs to persist. Cuts IndexedDB write size and avoids a speculative capability nothing in Phase 1 uses.
- **Design ceiling set explicitly to 10,000–50,000 entries** (plan.md Section 18's open question), not the 500k alternative — matches the architecture actually built (handle-per-entry omitted, FlexSearch chosen for this scale).

## Assumptions

- `plan.md` already served as the design doc for `/plan-eng-review`'s purposes (no separate `/office-hours` pass was run) — it already contained a problem statement, architecture, and constraints in enough depth.
- Fallback-mode search (Firefox/Safari) reuses the same `SearchIndex`/`matchesFilters`/`sortEntries` pure functions as the worker, run on the main thread instead of in a worker — Section 4 scopes fallback mode to a small, session-only listing where this is simpler than duplicating a worker path for it.
- Test coverage of `scan.worker.ts` itself (the ~20-line `self.onmessage` wiring) is indirect, via `ScanController`'s tests — the worker file just dispatches to already-tested methods and can't be exercised directly in jsdom (no real `Worker` global).

## VibeSec category assessment (plan.md Section 12 table)

Explicitly logged as considered, not skipped:

| Category | Status |
|---|---|
| Access Control (IDOR, privilege escalation) | N/A — no backend, no accounts |
| Client-Side XSS | **Applicable, addressed** — all filenames/paths render via JSX text interpolation only; no `dangerouslySetInnerHTML` anywhere in `src/` (grep-verified) |
| CSRF / open redirect | N/A — no server, no redirects |
| Secret exposure | N/A — no API keys shipped |
| Server-Side (SSRF, SQLi, XXE, path traversal) | N/A — no server, no database |
| Authentication | N/A — no accounts |
| API Security | N/A — no API |
| Supply-chain (`npm audit`) | **Applicable, clean** — 0 vulnerabilities |

A full `/cso` pass (STRIDE-scoped per this table) is still open — see Section 17 gate above.
