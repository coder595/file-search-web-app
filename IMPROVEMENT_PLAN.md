# Improvement Plan — file-search-web-app

**Status:** PROPOSED — waiting for owner approval. Nothing here has been run yet.
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
