# Improvement Plan — file-search-web-app

**Status:** APPROVED by owner (2026-10-03). Executing on branch `improve/phase-4`. Eng-review amendments are in the Decision ledger at the end of this file.
**Date:** 2026-09-27
**Baseline (measured today):** lint 0 errors / 3 warnings · 123 tests passing · build OK (100 KB gzip main JS + 53 KB worker) · `npm audit` 0 vulns · 8 dev deps have patch/minor updates · no CI · all work lands directly on `master`.

Ponytail rule for the whole plan: each item has to fix a real, observed gap. Speculative features stay in `TODOS.md`.

---

## Phase A — Process and safety net (do first; the rest depends on it)

| # | Item | Why | Effort |
|---|------|-----|--------|
| A1 | Work on a feature branch (`improve/<phase>`) and open PRs | Every phase gate in `PROGRESS.md` says `/review` "doesn't apply" because nothing gets diffed. This gap has repeated for 3 phases. | XS |
| A2 | GitHub Actions CI: `lint → test:coverage → build → e2e (chromium)` on PRs | There's no automated gate at all. Today, "tests pass" only means someone remembered to run them. | S |
| A3 | Bump the patch/minor dev deps (vite 8.3.1, vitest 5.0.2, oxlint 1.85, jsdom 30.1). **Do not** bump TypeScript 7 or @types/node 26. | Low-risk upkeep. A major TS bump is its own decision and goes in TODOS. | XS |
| A4 | Fix the 3 lint warnings: `require-yield` in `scanController.test.ts:133`, `only-export-components` in `FileSearchStoreProvider.tsx:27` (move the hook/context to its own file), and `incompatible-library` on `useVirtualizer` (add a suppression comment that states the reason) | A clean lint baseline lets CI fail on warnings. | XS |
| A5 | Speed up Vitest: `pool: 'vmThreads'` or a shared jsdom (Vitest's own hint says 69% of test time goes to jsdom setup) | Faster feedback loop. Check with Context7 (vitest docs) first. | XS |

## Phase B — Correctness and robustness (open TODOs + gaps)

| # | Item | Source | Effort |
|---|------|--------|--------|
| B1 | IndexedDB quota handling: catch `QuotaExceededError` around idb writes and fall back to in-memory for that session with a visible notice. Warn early using `navigator.storage.estimate()`. | TODOS P3, but it can fail silently and lose data | S |
| B2 | Silent-failure sweep of the store, worker, db and permission code (`ecc:silent-failure-hunter`) | No one has audited swallowed errors or `.catch(() => {})` | S |
| B3 | Worker crash handling: `worker.onerror` / `messageerror` → error state plus a Retry action | Right now a crash in the worker would leave the UI stuck on "scanning" | S |
| B4 | Real Firefox and Safari (WebKit) check of the fallback path: add `firefox` and `webkit` Playwright projects for the fallback spec only | PROGRESS says "not yet verified in a real Firefox/Safari" | S |

## Phase C — Security hardening

| # | Item | Effort |
|---|------|--------|
| C1 | CSP meta tag: `default-src 'self'; connect-src 'none'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'` (TODOS P2). Confirm that dev-mode HMR still works (scope it to the build only if needed) and that E2E passes. | S |
| C2 | `/cso` diff-scoped pass, then `ecc:security-reviewer` on the final diff | XS |

## Phase D — UX, UI and accessibility

| # | Item | Tool | Effort |
|---|------|------|--------|
| D1 | Design audit of the live app (hierarchy, spacing, empty/loading/error states, dark mode). Audit only; fixes are chosen from the findings, not all applied at once. | `/impeccable` audit (or `hallmark` audit), `ui-ux-pro-max` for guidelines, `/design-review` for the live fix pass | M |
| D2 | Restore-progress indicator for large cached indexes (the 50k-entry rebuild takes 329 ms). Already logged as a Phase 2 candidate. | frontend-design | S |
| D3 | WCAG 2.2 AA audit: contrast in both themes, focus rings, the `aria-live` scan-progress announcement, the listbox semantics | `ecc:a11y-architect`, Lighthouse via chrome-devtools MCP | S |
| D4 | Result actions: "open containing folder" is **not possible** in a browser, so skip it. Consider "copy name" alongside "copy path" only if D1 flags it. | — | — |

## Phase E — Performance

| # | Item | Effort |
|---|------|--------|
| E1 | `/benchmark` re-run against the 2026-09-16 baseline (it hasn't been re-run since Phases 2 and 3) | XS |
| E2 | Profile a 50k-entry scan with chrome-devtools `performance_start_trace`. Optimize only if a hotspot shows up (`ecc:performance-optimizer`). | S |

## Phase F — Docs and release

| # | Item | Effort |
|---|------|--------|
| F1 | README: add the missing ignore-patterns section (flagged as pending in the PROGRESS Phase 3 gate) | XS |
| F2 | Add `CHANGELOG.md` and a `VERSION` bump via `/ship` on the first PR | XS |
| F3 | `/document-release`, then update `PROGRESS.md` with a Phase 4 gate section and `plan.md` with a Section 26 build log | XS |
| F4 | Optional: deploy the static build (Vercel or GitHub Pages) so people can use it without the portable zip. **Needs owner approval because it's public.** | S |

## Explicitly out of scope (stay in TODOS.md)
Glob and `.gitignore` ignore rules · TypeScript 7 migration · any backend · file-content search.

---

## Tool and agent assignment

| Stage | Tools |
|-------|-------|
| Plan review | `/plan-eng-review` (gstack), `ecc:architect`, and the agency-agents Engineering Division **Software Architect** (if installed) |
| Library docs | Context7 (vitest pool, Playwright projects, CSP + Vite, idb quota) |
| Web research | FireCrawl (CSP for Vite SPAs, File System Access API status in Firefox/Safari 2026) |
| Execute per item | `ecc:tdd-guide` (RED→GREEN), `superpowers:subagent-driven-development`, agency **Frontend Developer**, **DevOps Automator** (A2 CI) |
| UI | `impeccable`, `hallmark`, `ui-ux-pro-max`, `frontend-design`, `ecc:taste` |
| Live QA | BrowserUse / gstack `/qa` + `/browse`, chrome-devtools MCP for Lighthouse and traces |
| Review | `ecc:react-reviewer`, `ecc:typescript-reviewer`, `ecc:silent-failure-hunter`, `/review` (gstack, now possible on a branch), `/ponytail-review` |
| Security | `/cso`, `ecc:security-reviewer` |
| Ship | `/ship`, `/document-release` |

## Done criteria
CI green on the PR · coverage ≥ 80% (currently 96%) · 0 lint warnings · E2E passes in Chromium, and the fallback spec passes in Firefox and WebKit · CSP active in the build with a clean network tab · `/review` and `/cso` clean · PROGRESS.md Phase 4 gate filled in.

---

# Eng review — /plan-eng-review of IMPROVEMENT_PLAN.md (2026-10-03, branch improve/phase-4)

Target: `IMPROVEMENT_PLAN.md` (this file). Reviewers: native /plan-eng-review pass, `ecc:architect` subagent, agency `Software Architect` subagent. Research: Context7 (vitest pool docs, Playwright projects/permissions, Vite plugin `apply`/`transformIndexHtml`, idb-keyval error handling), FireCrawl (File System Access API status: Firefox negative position, Safari "oppose" — plan.md Section 4 constraint still holds; MDN: a worker loaded from a URL gets its CSP from its own response headers, not the page's meta tag).

Baseline probes (2026-10-03): `npx vitest run` 123 passed, 6.18s, jsdom created 22× = 68% of tracked time · `npm run lint` 3 warnings (scanController.test.ts:133, FileSearchStoreProvider.tsx:27, VirtualizedEntryTable.tsx:42).

## Scope record
feature answers: D2 = cut the `navigator.storage.estimate()` early warning from B1 (2026-10-03); structure: B "Smaller arrangement" (D3, 2026-10-03); accepted scope: all plan items except the B1 early warning; B2 folds into the B1/B3 commits, D2 reuses B3's restore-complete message, CSP is an inline plugin in vite.config.ts; pending remedies: R1–R9.
Scope Challenge result: scope reduced per recommendation (D2 cut).

Factual corrections applied without a question (no behavior change): plan header said PROPOSED although the owner approved it — updated.

## Decision ledger

### R1: B1 — what to do when saving the cache fails
Finding: 1, P1, 9/10, src/store/fileSearchStore.ts:82 `void deps.saveEntries(msg.entries)` + :90 `(await deps.loadEntries()) ?? []` + :148-149 clearCache/saveRootHandle; both architects.
Plan baseline: B1 "catch QuotaExceededError around idb writes and fall back to in-memory for that session with a visible notice".
Runtime evidence: the index already lives in worker memory, so "fall back to in-memory" is a no-op. The real bug: failed save after selectFolder leaves a root handle and no entries, so the next reload restores `[]` and shows "ready" with 0 results and no notice. A failed `saveRootHandle` rejects selectFolder before the scan starts (unhandled).
Comparison grid:
| Choice | Current | A | B |
|---|---|---|---|
| R1 save-failure behavior | silent unhandled rejection; empty restore on reload | catch saveEntries/saveRootHandle; on failure delete cached entries, set a visible "couldn't save — will re-scan next time" notice; init re-scans when handle granted but entries missing | catch + notice only (no init re-scan) |
Question D4: B1 save failure — recover how? ELI10: when the browser's storage is full, saving the file list fails silently today; next time you open the app it shows an empty folder as if it had no files. A: catch it, show a notice, and next launch re-scan instead of showing an empty list. B: catch + notice only. Recommendation: A because B still leaves the empty-folder lie on reload. Completeness A=10, B=6.
Header: B1 recovery
Options:
A) Catch, notice, re-scan on reload (recommended)
✅ Fixes the silent empty-result reload, the actual data-loss symptom. ✅ Re-scan path reuses startScan; no new mechanism. ❌ A reload after a failed save costs a full scan. human ~3h / CC ~20min.
B) Catch and notice only
✅ Smallest diff; no unhandled rejection anymore. ✅ User sees a notice this session. ❌ Next reload still shows 0 results as "ready" with no notice.

State: approved
Actual answer: A) Catch, notice, re-scan on reload (D4, 2026-10-03)
Accepted scope: catch saveEntries/saveRootHandle failures (no unhandled rejection); on saveEntries failure delete cached entries and show a visible notice; init re-scans (not restore `[]`) when the handle is granted but cached entries are missing; tests for each path.
History: none

### R2: B3 — surface worker scan failures
Finding: 2, P1, 9/10, src/workers/scan.worker.ts:16 `void controller.scan(...)`; src/workers/walk.ts:70 `throw err`; store has no onerror (fileSearchStore.ts:70-87); both architects.
Plan baseline: B3 "worker.onerror / messageerror → error state plus a Retry action".
Runtime evidence: a non-NotAllowedError (e.g. NotFoundError, folder deleted before Refresh) rejects scan() inside the worker = unhandled rejection in the worker, which does NOT fire `error` on the Worker object; UI stays "scanning" forever.
Comparison grid:
| Choice | Current | A | B |
|---|---|---|---|
| R2 error path | none | worker catches scan() rejection → posts `{type:'error', message}`; store adds `onerror` as backstop for load/crash; new `'error'` status; drop `messageerror` (plain objects can't fail to deserialize) | onerror + messageerror only, as planned |
Question D5: B3 — how do worker failures reach the UI? ELI10: if a folder disappears mid-scan, the scanner crashes quietly and the screen says "scanning…" forever. Listening only for the browser's crash event (the plan) misses this case. A: the worker reports its own errors, with the crash event as a backstop. Recommendation: A because B misses the likeliest failure. Completeness A=10, B=4.
Header: B3 errors
Options:
A) Worker posts error + onerror (recommended)
✅ Catches the real failure (rejected scan) and true crashes/load failures. ✅ One new message type in the existing contract. ❌ Touches the worker message contract (store + worker + tests). human ~3h / CC ~20min.
B) onerror/messageerror only
✅ Exactly the plan text. ✅ No change to the worker contract. ❌ Rejected scans never fire onerror, so the stuck-on-scanning bug remains.

State: approved
Actual answer: A) Worker posts error + onerror (D5, 2026-10-03)
Accepted scope: worker catches scan()/restore failures and posts `{type:'error', message}`; store handles it plus `worker.onerror` as backstop; new `'error'` status with visible message; no `messageerror` handler; tests for each path.
History: none

### R3: B3 — what Retry does
Finding: 3, P2, 8/10, src/store/fileSearchStore.ts:62 `const worker = deps.createWorker()`; ecc:architect.
Plan baseline: "a Retry action" (unspecified).
Runtime evidence: worker is captured once; after a load failure/crash it is dead, so Retry = refresh() would post into a dead worker.
Comparison grid:
| Choice | Current | A | B |
|---|---|---|---|
| R3 retry | n/a | terminate + recreate worker, re-attach handlers, re-check permission, startScan (keeps filters/ignorePatterns/rootHandle) | call refresh() on the same worker |
Question D6: Retry behavior? ELI10: after an error the user clicks Retry. If the scanner process itself died, re-using it does nothing. A: start a fresh scanner and rescan. B: just ask the old one to rescan. Recommendation: A because one path covers both "worker alive" and "worker dead". Completeness A=10, B=6.
Header: B3 retry
Options:
A) Fresh worker, re-check, rescan (recommended)
✅ Works whether the worker is alive or dead. ✅ Re-checks permission, so a revoked grant goes to Resume access. ❌ Worker becomes `let`; handler attach moves into a function. human ~2h / CC ~15min.
B) Retry = refresh()
✅ One line. ✅ Works for the rejected-scan case. ❌ Silently does nothing after a real worker crash/load failure (e.g. a CSP block).

State: approved
Actual answer: A) Fresh worker, re-check, rescan (D6, 2026-10-03)
Accepted scope: `retry()` terminates the worker, creates a new one via deps.createWorker, re-attaches handlers, re-checks permission (not granted → needs-permission), then startScan; filters/ignorePatterns/rootHandle preserved; Retry button in the error state; tests.
History: none

### R4: B3/D2 — restore-complete message
Finding: 4, P2, 8/10, src/store/fileSearchStore.ts:91-92 posts `restore` then immediately `set({status:'ready'})`; Software Architect.
Plan baseline: D2 "restore-progress indicator for large cached indexes".
Runtime evidence: status says ready before the worker has rebuilt the index (329ms at 50k); a throw during restore looks like an empty result.
Comparison grid:
| Choice | Current | A | B |
|---|---|---|---|
| R4 restore state | ready set immediately | new `restoring` status until worker posts `restore-complete` (errors go through R2's error message); D2 indicator = "Restoring N cached entries…" text while restoring | keep immediate ready; D2 shows a timed spinner |
Question D7: Restore completion signal? ELI10: on reopen the app says "ready" before the search index is rebuilt; on huge folders the first search can come back empty for a moment. A: the worker says when it's actually done, and we show "Restoring…" until then. Recommendation: A because D2 needs the real signal anyway. Completeness A=10, B=5.
Header: Restore done
Options:
A) restore-complete message (recommended)
✅ Accurate state; D2 indicator and B3 errors use the same signal. ✅ No guessing with timers. ❌ One more message type + status value. human ~2h / CC ~15min.
B) Timed spinner
✅ No contract change. ✅ Quick. ❌ Indicator is fake: it can end before or after the real rebuild.

State: approved
Actual answer: A) restore-complete message (D7, 2026-10-03)
Accepted scope: new `restoring` status set when restore is posted; worker posts `{type:'restore-complete', count}`; store moves to ready then queries; D2 = "Restoring N cached entries…" text (aria-live) while restoring; tests.
History: none

### R5: C1 — where the CSP applies and how it's tested
Finding: 5, P1, 9/10, playwright.config.ts:17 `command: 'npm run dev'`; plugin-react inline refresh preamble + HMR `ws:` in dev; mockFileSystem.ts:74,99 routes dev-only URLs; both architects.
Plan baseline: C1 "CSP meta tag … confirm dev HMR still works (scope it to the build only if needed) and that E2E passes".
Runtime evidence: a meta CSP with `connect-src 'none'` and no inline scripts breaks the dev server, so it must be build-only, and then the existing dev-server E2E never sees it.
Comparison grid:
| Choice | Current | A | B |
|---|---|---|---|
| R5 CSP scope/test | none | inline Vite plugin `apply:'build'` injecting the meta tag; new Playwright project running one smoke spec against `vite preview` asserting no `securitypolicyviolation`, the app renders, and fallback path renders | build-only meta tag, verified manually once in the browser |
Question D8: CSP — how do we prove it works? ELI10: the security rule (CSP) can only be on in the production build, because the dev server needs things the rule blocks. Our automated browser tests run against the dev server, so they would never see it. A: add one small automated test against the production build. Recommendation: A because a CSP that nothing tests silently breaks the app on the next change. Completeness A=10, B=5.
Header: CSP test
Options:
A) Build-only + preview smoke test (recommended)
✅ CI proves the shipped build runs under the CSP with zero violations. ✅ Dev and existing E2E unaffected. ❌ One more Playwright project + webServer for `vite preview`. human ~3h / CC ~20min.
B) Build-only, manual check
✅ Smaller diff. ✅ Dev unaffected. ❌ Any future inline script/style or new connection breaks prod silently.

State: approved
Actual answer: A) Build-only + preview smoke test (D8, 2026-10-03)
Accepted scope: inline Vite plugin with `apply:'build'` injects the CSP meta tag; new Playwright project + `vite preview` webServer running one smoke spec: no `securitypolicyviolation`, app renders, fallback path renders; wired into `npm run e2e` and CI.
History: none

### R6: C1 — policy content
Finding: 6, P2, 8/10, plan C1 policy text; src/store/fileSearchStore.ts:28 worker via `new URL(..., import.meta.url)`; VirtualizedEntryTable.tsx style props (CSSOM, not governed by style-src); MDN (worker CSP comes from its own response headers); both architects.
Plan baseline: `default-src 'self'; connect-src 'none'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'`.
Runtime evidence: no blob: worker in the code; build CSS is an external file.
Comparison grid:
| Choice | Current | A | B |
|---|---|---|---|
| R6 policy | plan text | `default-src 'self'; connect-src 'none'; worker-src 'self'; style-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; form-action 'none'` — fall back to adding `'unsafe-inline'` to style-src only if the preview smoke test shows a violation; document that the meta CSP does not govern the worker | plan text as written |
Question D9: Which CSP rules? ELI10: the plan's rule list allows two things the app never uses (blob workers, inline styles) and leaves out three standard lock-downs. Tighter is safer if it still works; the smoke test from R5 tells us. Recommendation: A because least privilege at no extra code. Completeness A=9, B=6.
Header: CSP rules
Options:
A) Tighter policy (recommended)
✅ Drops unused `blob:` and (if the test passes) `'unsafe-inline'`. ✅ Adds object-src/base-uri/form-action, which don't fall back to default-src. ❌ May need one iteration if a violation appears. human ~1h / CC ~10min.
B) Plan policy as written
✅ Already approved text. ✅ Lower risk of a first-run violation. ❌ Allows blob: workers and inline styles nothing needs.

State: approved
Actual answer: A) Tighter policy (D9, 2026-10-03)
Accepted scope: `default-src 'self'; connect-src 'none'; worker-src 'self'; style-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; form-action 'none'`; add `'unsafe-inline'` to style-src only if the R5 smoke test shows a style violation; document that the meta CSP does not govern the worker.
History: none

### R7: B4 — what the Firefox/WebKit run actually proves
Finding: 7, P2, 8/10, playwright.config.ts:13 global `permissions: ['clipboard-read','clipboard-write']` (Playwright docs: supported permissions differ by browser); tests/e2e/fileSearch.spec.ts:125 forces `__FORCE_FALLBACK__`; both architects.
Plan baseline: B4 "add firefox and webkit Playwright projects for the fallback spec only".
Runtime evidence: the only fallback E2E forces the flag and checks a banner, so running it in Firefox proves the banner renders, not that detection or `directoryOpen` work.
Comparison grid:
| Choice | Current | A | B |
|---|---|---|---|
| R7 cross-browser proof | chromium only, forced flag | new `tests/e2e/fallback.spec.ts` (no forced flag): real detection shows banner, then pick a folder via `filechooser.setFiles(<fixture dir>)` and assert files list + search; firefox/webkit projects run only this spec with `permissions: []`; chromium keeps the forced-flag test | add firefox/webkit projects to the existing banner test |
Question D10: What should the Firefox/WebKit test prove? ELI10: today the "fallback" test fakes being Firefox inside Chrome and only checks that a banner appears. Running that same test in real Firefox proves very little. A: a new test that lets real Firefox/WebKit detect themselves and actually pick a folder and list files. Recommendation: A because the plan's goal is "verified in a real Firefox/Safari", and only A verifies it. Note: Playwright WebKit on Linux is close to Safari but not Safari. Completeness A=9, B=4.
Header: B4 proof
Options:
A) Real detection + folder pick test (recommended)
✅ Proves detection, picker and listing in real engines. ✅ Isolated spec, so Chromium-only mocks aren't involved. ❌ Needs a small fixture folder and CI installs 2 more browsers. human ~3h / CC ~20min.
B) Existing banner test in 3 browsers
✅ Tiny config change. ✅ Matches the plan literally. ❌ Proves only that a banner renders under a forced flag.

State: approved
Actual answer: A) Real detection + folder pick test (D10, 2026-10-03)
Accepted scope: new `tests/e2e/fallback.spec.ts` (no forced flag) with a small fixture folder: banner via real detection, pick folder via filechooser, files listed, search narrows; firefox + webkit projects run only this spec with `permissions: []`; chromium keeps the forced-flag test; CI installs firefox + webkit.
History: none

### R8: A5 — how to speed up Vitest
Finding: 8, P3, 8/10, Vitest pool docs (vmThreads: memory leaks, cross-realm `instanceof Error` false); src/workers/walk.ts:9 `err instanceof DOMException`; src/store/fileSearchStore.ts:58 `err instanceof Error`; both architects.
Plan baseline: A5 "`pool: 'vmThreads'` or a shared jsdom".
Runtime evidence: 22 jsdom environments = 68% of 6.18s; ~11 test files are pure logic (src/workers/*, several src/lib/*).
Comparison grid:
| Choice | Current | A | B |
|---|---|---|---|
| R8 approach | default forks, jsdom everywhere | `// @vitest-environment node` docblock on pure-logic test files; keep jsdom + isolation for components; keep only if the suite stays green and faster | `pool: 'vmThreads'` as planned |
Question D11: A5 — which speed-up? ELI10: most test time is spent building a fake browser for every test file, even files that test pure logic. A: give pure-logic tests no fake browser at all. B: the plan's vmThreads mode, which the Vitest docs warn leaks memory and breaks `instanceof Error` checks our code uses. Recommendation: A because it gets the speed-up without the known breakage. Note: options differ in kind, not coverage — no completeness score.
Header: A5 speedup
Options:
A) Node env for pure-logic tests (recommended)
✅ Removes about half the jsdom setups with zero runtime risk. ✅ Keeps per-file isolation. ❌ A docblock line in ~11 test files. human ~30min / CC ~5min.
B) pool: 'vmThreads'
✅ One config line, as planned. ✅ Vitest's own hint suggests it. ❌ Docs: memory leaks + `instanceof Error` false across realms, which our error checks rely on.

State: approved
Actual answer: A) Node env for pure-logic tests (D11, 2026-10-03)
Accepted scope: `// @vitest-environment node` on pure-logic test files that pass under node; jsdom + default pool for the rest; keep only if green and faster (before/after timing recorded in the commit).
History: none

### R9: Phase A order
Finding: 9, P3, 8/10, plan Phase A table order (A2 CI before A4 warnings fixed); Software Architect.
Plan baseline: A1 → A2 → A3 → A4 → A5.
Runtime evidence: lint currently has 3 warnings, so a "0 warnings" CI gate added before A4 would be red on its first run.
Comparison grid:
| Choice | Current | A | B |
|---|---|---|---|
| R9 order | A1→A2→A3→A4→A5 | A1 → A4 → A3 → A5 → A2 (CI last, so it starts green on the final baseline); C1 lands before any F4 deploy | as listed |
Question D12: Phase A order? ELI10: the CI gate fails on lint warnings, and 3 warnings exist today. Fix the warnings and bump deps first, then add CI so its first run is green. Recommendation: A because B commits a red CI. Note: options differ in kind, not coverage — no completeness score.
Header: A order
Options:
A) A1→A4→A3→A5→A2 (recommended)
✅ CI's first run is green and measures the final Phase A baseline. ✅ Same items, same commits. ❌ Commit order no longer matches the table numbering.
B) Table order
✅ Commits read A1..A5 in order. ✅ No plan edit. ❌ The A2 commit lands a CI config that fails until A4.

State: approved
Actual answer: A) A1→A4→A3→A5→A2 (D12, 2026-10-03)
Accepted scope: execute Phase A as A1 → A4 → A3 → A5 → A2; C1 lands before any F4 deploy.
History: none

Approval readiness: PASS — R1 (D4), R2 (D5), R3 (D6), R4 (D7), R5 (D8), R6 (D9), R7 (D10), R8 (D11), R9 (D12); scope cut D2; structure D3; TODO D13 → added to TODOS.md (worker header CSP); TS 7/@types/node 26 TODO added per A3's own text.

## Amended plan (authoritative — supersedes the tables above where they differ)

Execution order: **A1 → A4 → A3 → A5 → A2**, then B → C → D → E → F. Gate between phases: `npm run lint` (0 warnings) · `npm run test:coverage` (≥80%) · `npm run build` · `npm run e2e`.

- **A5** → `// @vitest-environment node` on pure-logic test files (R8), not vmThreads.
- **B1** → catch `saveEntries`/`saveRootHandle` failures; on failure delete cached entries + visible notice; `init` re-scans when the handle is granted but entries are missing (R1). No `storage.estimate()` warning (D2).
- **B2** → folded into B1/B3 commits; `ecc:silent-failure-hunter` still runs in each phase review.
- **B3** → worker posts `{type:'error'}` for scan/restore failures, store `onerror` backstop, `'error'` status (R2); Retry = fresh worker + permission re-check + rescan (R3); `restoring` status + `restore-complete` message (R4).
- **B4** → new `tests/e2e/fallback.spec.ts` (real detection, real folder pick) on firefox + webkit with `permissions: []` (R7).
- **C1** → build-only inline Vite plugin; policy per R6; `vite preview` smoke project asserting zero CSP violations (R5).
- **D2** → "Restoring N cached entries…" during `restoring` (R4).
- **F4** → unchanged: ask the owner first; must land after C1.

### Test coverage diagram (planned paths)
```
CODE PATHS                                          USER FLOWS
[+] fileSearchStore.ts                              [+] Storage full
  ├── saveEntries reject      [GAP→unit] R1           ├── [GAP→unit] notice shown after scan
  ├── saveRootHandle reject   [GAP→unit] R1           └── [GAP→unit] reload re-scans, not empty "ready"
  ├── init: granted+no entries[GAP→unit] R1         [+] Scan crash
  ├── msg 'error'             [GAP→unit] R2           ├── [GAP→unit] error state + message visible
  ├── worker.onerror          [GAP→unit] R2           └── [GAP→unit] Retry → fresh worker → rescan
  ├── retry()                 [GAP→unit] R3         [+] Reopen large cache
  └── 'restoring'→restore-complete [GAP→unit] R4      └── [GAP→unit] "Restoring N…" then results
[+] scan.worker / scanController                    [+] Production build
  ├── scan() reject → post error [GAP→unit] R2        └── [GAP→E2E preview] zero CSP violations R5
  └── restore() → restore-complete [GAP→unit] R4    [+] Real Firefox/WebKit
[+] vite.config.ts CSP plugin  [→E2E preview] R5      └── [GAP→E2E] detect → pick → list → search R7
COVERAGE: 0/14 planned paths tested yet (all new)  |  GAPS: 14 (2 E2E)
```

### NOT in scope
- `navigator.storage.estimate()` early warning — cut (D2): padded numbers, catch already handles the failure.
- `vmThreads`/`isolate:false` — rejected (R8): documented leaks and cross-realm `instanceof` breakage.
- `messageerror` handler — plain-object messages can't fail deserialization (R2).
- Header-based worker CSP — TODOS.md (D13).
- TypeScript 7 / @types/node 26 — TODOS.md (A3).
- Glob ignore rules, backend, content search — unchanged from plan.

### What already exists
- `isAbortError` pattern (fileSearchStore.ts:57) — reuse its shape for error-name checks.
- `startScan()` — R1's reload re-scan and R3's Retry both route through it; no new scan path.
- `FakeWorker` / `makeFakeDeps()` (src/test/fakeFileSearchDeps.ts) — store tests for R1–R4 inject failures through it.
- `FolderPicker.tsx` progress-text pattern — reused for the "Restoring N…" indicator.
- Playwright `webServer` config — extended to an array for `vite preview` (R5).

### Failure modes
| Path | Failure | Test | Handling | User sees |
|---|---|---|---|---|
| saveEntries | QuotaExceededError | planned unit | R1 catch + delete | notice; next reload re-scans |
| saveRootHandle | QuotaExceededError | planned unit | R1 catch | notice; scan still runs this session |
| scan() | NotFoundError mid-walk | planned unit | R2 post error | error state + Retry |
| worker load | CSP/script load failure | planned unit (onerror) | R2 backstop | error state + Retry (R3 fresh worker) |
| restore() | bad cached data throws | planned unit | R2/R4 | error state, not empty "ready" |
| CSP | future inline script/style | planned E2E preview | R5 test fails in CI | caught before merge |
No critical gaps (each failure has planned test + handling + visible state).

### Worktree parallelization strategy
Sequential implementation, no parallelization opportunity: B1/B3/R4 all change `src/store/fileSearchStore.ts` and the worker message contract; C1 and B4 both change `playwright.config.ts`.

## Implementation Tasks
- [ ] **T1 (P1, human ~3h / CC ~20min)** — store — B1 save-failure recovery (R1)
  - Surfaced by: Scope/R1 — fileSearchStore.ts:82,90,148-149
  - Files: src/store/fileSearchStore.ts, src/lib/db.ts, src/components/FolderPicker.tsx, tests
  - Verify: `npx vitest run src/store`
- [ ] **T2 (P1, human ~3h / CC ~20min)** — worker — post scan/restore errors + store error state + onerror (R2)
  - Surfaced by: R2 — scan.worker.ts:16, walk.ts:70
  - Files: src/workers/scan.worker.ts, src/workers/scanController.ts, src/store/fileSearchStore.ts, src/components/FolderPicker.tsx
  - Verify: `npx vitest run src/workers src/store`
- [ ] **T3 (P1, human ~2h / CC ~15min)** — store — Retry with fresh worker (R3)
  - Surfaced by: R3 — fileSearchStore.ts:62
  - Files: src/store/fileSearchStore.ts, src/components/FolderPicker.tsx
  - Verify: `npx vitest run src/store`
- [ ] **T4 (P2, human ~2h / CC ~15min)** — worker/store — restoring status + restore-complete + D2 indicator (R4)
  - Surfaced by: R4 — fileSearchStore.ts:91-92
  - Files: src/workers/*, src/store/fileSearchStore.ts, src/components/FolderPicker.tsx
  - Verify: unit + existing reload E2E
- [ ] **T5 (P1, human ~3h / CC ~20min)** — build — build-only CSP + preview smoke project (R5, R6)
  - Surfaced by: R5/R6 — playwright.config.ts:17, plan C1
  - Files: vite.config.ts, playwright.config.ts, tests/e2e/csp.spec.ts
  - Verify: `npm run build && npx playwright test --project=csp`
- [ ] **T6 (P2, human ~3h / CC ~20min)** — e2e — real Firefox/WebKit fallback spec (R7)
  - Surfaced by: R7 — playwright.config.ts:13, fileSearch.spec.ts:125
  - Files: playwright.config.ts, tests/e2e/fallback.spec.ts, tests/e2e/fixtures/
  - Verify: `npx playwright test --project=firefox --project=webkit`
- [ ] **T7 (P3, human ~30min / CC ~5min)** — tests — node environment for pure-logic tests (R8)
  - Surfaced by: R8 — vitest timing probe
  - Files: src/workers/*.test.ts, pure src/lib/*.test.ts
  - Verify: `npx vitest run` timing before/after
- [ ] **T8 (P3)** — process — Phase A order A1→A4→A3→A5→A2 (R9)
  - Surfaced by: R9
  - Files: n/a
  - Verify: CI first run green

### Completion summary
- Step 0: Scope Challenge — scope reduced per recommendation (D2 cut)
- Architecture Review: 4 issues found (R2, R3, R4, R5)
- Code Quality Review: 2 issues found (R1, R6)
- Test Review: diagram produced, 14 gaps identified (R7, R8 test-strategy issues)
- Performance Review: 0 issues found (E2 profiling unchanged)
- NOT in scope: written
- What already exists: written
- TODOS.md updates: 1 item proposed to user (+1 carried from A3)
- Failure modes: 0 critical gaps flagged
- Unresolved decisions: 0 in this review
- Outside voice: codex, unavailable (model_unusable: account can't use the default Codex model; native fallback unavailable — no TaskOutput tool). Independent reads came from 2 architect subagents (same harness).
- Parallelization: 1 lane, 0 parallel / 8 sequential
- Lake Score: 6/6 coverage choices took the complete option

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | not run |
| Outside Review | codex (`/plan-eng-review` outside voice) | Independent 2nd opinion | 1 | unavailable | Codex model_unusable; no native fallback (TaskOutput missing). ecc:architect + Software Architect subagents ran as independent reads: 23 findings combined, merged into R1–R9 |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | ISSUES OPEN (all resolved into plan) | 9 issues, 0 critical gaps |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | not run |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | not run |

- **OUTSIDE COVERAGE:** codex, plan-review, unavailable (HTTP 400: default model unsupported on a ChatGPT account; set `GSTACK_CODEX_MODEL`). No outside coverage credited.
- **VERDICT:** Eng review complete, all 9 findings resolved by owner answers and folded into the Amended plan — ready to implement. Status logged as issues_open because findings existed (mapped work, not failure).

NO UNRESOLVED DECISIONS
