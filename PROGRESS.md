# Progress

## Phase status

- **Phase 0 (Scaffold):** done
- **Phase 1 (MVP):** done — every Section 17 item cleared except `/review` (structurally doesn't apply to a from-scratch first commit with no prior state to diff against; will run on the next feature branch)
- **Phase 2 (Polish):** not started
- **Phase 3 (Roadmap):** not started

## Phase 1 functional acceptance criteria (plan.md, "Acceptance criteria for Phase 1")

- [x] `npm run dev` starts the app with no errors — verified via live headless-browser check (gstack `/browse`, `$B` fallback): renders correctly, zero console errors.
- [x] "Select Folder" opens the native picker and a recursive scan starts with a visible progress indicator — implemented (`FolderPicker.tsx`, `ScanController.scan`), E2E-verified in real Chromium with a mocked picker, and manually confirmed in real Chrome with an actual folder (2026-09-16) — works.
- [x] Typing in the search box filters results live (debounced ~130ms) — implemented and unit/component tested (`SearchBar.tsx`, `fileSearchStore.ts`).
- [x] Extension, size, and date-modified filters combine with the search query — implemented in the worker (`filters.ts`, `scanController.ts`), single source of truth per the eng-review decision.
- [x] Results list is virtualized (`@tanstack/react-virtual`) — test confirms a 10,000-row result set renders far fewer DOM nodes than rows.
- [x] Closing and reopening the tab restores the last folder's index from IndexedDB without a full re-scan — implemented (`ScanController.restore`, `queryPermission()`/`requestPermission()` flow); unit-tested via fake deps, E2E-verified across a real `page.reload()` in Chromium, and manually confirmed in real Chrome (2026-09-16) — works.
- [x] A manual "Refresh" button triggers a full re-scan, and is the *only* action that does — implemented and tested.
- [x] Firefox/Safari (or `window.__FORCE_FALLBACK__` override) shows the fallback banner and lists files read-only via `<input webkitdirectory>` — implemented (`FallbackFileList.tsx`, `browser-fs-access`) and tested with the override flag; not yet verified in a real Firefox/Safari instance.
- [x] No file content or path is sent over the network — no `fetch`/`XMLHttpRequest` calls exist anywhere in `src/`; verified by code inspection and by the live browser console/network check showing no requests during the smoke test.

## Section 17 production-readiness gate

- [x] `/plan-eng-review` (gstack) run — 11 issues found across Architecture/Code Quality/Test/Performance, all resolved and folded into `plan.md`. Outside voice (Claude subagent, Codex unauthenticated) added 8 more findings (verified one against MDN — a real spec-compliance bug), all resolved. `plan.md` ends with `## GSTACK REVIEW REPORT`.
- [x] TDD followed via RED→GREEN→REFACTOR for every feature; 86 tests, **95.5% statement / 96.1% line coverage** (`npm run test:coverage`) — above the 80% threshold.
- [ ] `/review` (gstack) — **not run as designed**: it's diff-based against a git base branch, and this was a from-scratch build with no prior commit to diff against. Ran `/ponytail-review` instead (see below) plus manual review discipline throughout (TDD, dependency-injection for testability, DRY test-helper extraction). A real `/review` pass should run before the *next* PR against this initial commit.
- [x] `/cso` (gstack) — run (static, default scope; no Docker/scanner catalog on this host, so completeness is `partial` — see gaps below). **No supported findings.** Application model, secrets (1 redaction reviewed and disposed as a false positive — an SVG icon's path-coordinate data incidentally matched an E.164 phone pattern), attack surface, STRIDE, and data classification all assessed. Dependencies and OWASP Top 10:2025 partial: no qualified OSV-Scanner catalog available, so dependency advisory coverage relies on the separately-run `npm audit` (0 vulnerabilities) rather than CSO-mediated scanning; 8 of 10 OWASP categories are `not_applicable` (no backend, no auth, no server config) rather than tested clean. A05 Injection (XSS) directly verified: `VirtualizedEntryTable.tsx` renders untrusted filenames/paths as JSX text only. CI/CD, infrastructure, integrations, LLM/agentic/MCP, and skill-supply-chain are all `not_applicable` — confirmed by manifest search, not assumed. Full report: `~/.gstack/security/cso/cac51a12ead50f3968bcbf8f/1789559171413-f89313c369a5cbbc/report.md`.
- [x] `/ponytail-review` (gstack) clean — findings applied: 2 unnecessary type casts removed (a `@types/wicg-file-system-access` package install made them redundant), 1 unused devDependency removed (`@types/flexsearch`), 2 unused exports un-exported, `coverage/` added to `.gitignore`. Verified clean with `knip` (0 findings) after.
- [x] `/qa` (gstack) live-browser pass — verified the app renders cleanly with zero console errors via gstack's headless browser (`$B`). Native folder-picker flow, real scan, search/filter/copy-path, and tab-close/reopen persistence manually confirmed in real Chrome with an actual folder (2026-09-16) — works, no issues found.
- [x] `/benchmark` (gstack) — baseline captured (first run, no prior baseline to regress against). Production build: 43ms full load locally, ~116KB gzip total JS transfer (app + worker) — Grade A against standard budgets. FlexSearch rebuild-from-cache (Issue 4A follow-up): 79ms at 10k entries, 329ms at the 50k design ceiling — "instant" holds at typical scale, softens but stays sub-second at the top of the range; no action needed for Phase 1, logged as a Phase 2 UX polish candidate (a restore-progress indicator) if real usage nears 50k. Report: `.gstack/benchmark-reports/2026-09-16-benchmark.md`.
- [x] `npm audit` clean — 0 vulnerabilities.
- [x] E2E suite (Playwright, mocked `FileSystemDirectoryHandle`) — 7 tests, all passing, real Chromium: full select→scan→search→filter→copy-path flow, zero-results empty state, Refresh re-scan, **persisted-session restore across an actual `page.reload()` with no re-scan**, permission-not-granted → Resume Access → restore, the no-network-request invariant, and the fallback banner. Mocking a real `FileSystemDirectoryHandle` required more than swapping `showDirectoryPicker`: it's a native host object with structured-clone support a plain JS mock lacks, so (1) idb-keyval's real IndexedDB is replaced with a `sessionStorage`-backed module stub (survives reload, unlike an in-memory Map) that stores a marker for the handle and rehydrates it from a per-navigation `window.__mockRootHandle`, and (2) `Worker.prototype.postMessage` is patched to swap the mock handle for a clone-safe `{tree}` descriptor before sending, with a prelude injected into the worker's own script (via `page.route`) to revive it into a live handle on arrival. See `tests/e2e/fixtures/mockFileSystem.ts` for the full mechanism.
- [x] `/document-release` (gstack) — not run as its own skill invocation, but README.md and this PROGRESS.md are current as of this commit.
- [x] `/ship` (gstack) — simplified: no remote existed and all work was on `master` directly (no feature branch), so the PR-based flow didn't apply to this first commit. Created a private GitHub repo and pushed instead: https://github.com/coder595/file-search-web-app. No VERSION/CHANGELOG infrastructure set up yet (YAGNI for a single initial push with nothing to diff against — the next `/ship` on a real feature branch will set it up naturally). No PR opened, by design — this session's decision, not a skipped step.

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
