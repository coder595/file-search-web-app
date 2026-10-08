# TODOS

## Infrastructure

### IndexedDB storage quota/eviction handling

**What:** Detect and handle browser storage-quota exhaustion when caching very large scans.

**Why:** The design ceiling is 10,000–50,000 files (plan.md Section 7). Beyond that, IndexedDB writes could hit the browser's storage quota and fail silently mid-cache-write.

**Context:** Not needed for Phase 1's stated scale. Start with `navigator.storage.estimate()` to warn before hitting the limit, and a `QuotaExceededError` catch around the idb-keyval write so a failed cache write degrades gracefully (falls back to in-memory-only for that session) instead of throwing unhandled.

**Effort:** S
**Priority:** P3
**Depends on:** None

### CSP-based network egress guard

**What:** Add a Content-Security-Policy `connect-src 'none'` (or equivalent) as defense-in-depth proof that no scanned data can leave the browser, beyond code review alone.

**Why:** plan.md Section 12 states "no files are ever uploaded" as a core security property, but today that's enforced only by code review and a manual network-tab check. A CSP header makes it a runtime-enforced guarantee instead of a code-review promise.

**Context:** Add via an `index.html` meta tag or Vite's dev/build headers. Verify it doesn't break Google Fonts/CDN resources if any get added to the UI later — scope the policy to exactly what the app needs (likely `connect-src 'none'` since there's no API to call).

**Effort:** S
**Priority:** P2
**Depends on:** None

### Header-based CSP for the scan worker

**What:** Serve a `Content-Security-Policy` HTTP header (not just the build's `<meta>` tag) so the scan worker is fenced too.

**Why:** A worker loaded from a URL takes its CSP from its own response headers, not the page's meta tag (MDN, "CSP in workers"). The Phase 4 meta CSP (`connect-src 'none'`) therefore doesn't apply inside `scan.worker.ts`, the code that touches file data. The worker makes no network calls today (grep-verified), so this is defense in depth.

**Pros:** "no network egress" becomes runtime-enforced everywhere. **Cons:** `python -m http.server` can't send custom headers, so `scripts/run.sh`/`run.bat` would need a small custom handler.

**Context:** Start in `scripts/run.sh` + `run.bat`. A hosted deploy (IMPROVEMENT_PLAN F4) would set it via platform headers instead. The same header should carry `frame-ancestors 'none'` (clickjacking): browsers ignore `frame-ancestors` in a `<meta>` CSP, so the Phase 4 meta policy can't set it (Phase 4 security review).

**Effort:** S
**Priority:** P3
**Depends on:** Phase 4 C1 (meta CSP)

### TypeScript 7 / @types/node 26 major bump

**What:** Upgrade `typescript` ~6.0 → 7 and `@types/node` 24 → 26.

**Why:** Explicitly deferred from IMPROVEMENT_PLAN A3: a major compiler bump is its own decision, not routine upkeep.

**Context:** Needs owner approval before starting. Run `npm run build` (tsc -b) and the full suite after the bump.

**Effort:** S–M
**Priority:** P3
**Depends on:** None

### Phase 4 review follow-ups (skipped by owner, 2026-10-04)

**What:** Five small robustness gaps from the Phase 4 `/review` that were consciously deferred:
1. Skip `saveEntries` for a scan whose root handle failed to persist (`src/store/fileSearchStore.ts`, `selectFolder`), so an old root can't be paired with new entries on reload.
2. Add a `worker.onmessageerror` backstop that resets the query flags, and make `retry()` set its status synchronously so a double-click can't run it twice.
3. Show "No results." only for a loaded folder in every status (`src/components/ResultsList.tsx`), clear a stale save notice after a later successful save, and `console.error` a thrown `requestPermission` in `resumeAccess`.
4. Stronger keyboard-selected row cue in `VirtualizedEntryTable.tsx` (e.g. `ring-1 ring-inset ring-blue-600 dark:ring-blue-400`) for dark and forced-colors modes.
5. Residual from review cycle 3: a worker crash during `selectFolder`'s `clearCache`/`saveRootHandle` await can still leave status on `scanning`; move the `status === 'error'` check and `replaceWorker()` to just before `startScan`.

**Why:** Each is a low-probability edge case; none blocks the Phase 4 merge.

**Effort:** S each
**Priority:** P3
**Depends on:** None

## Feature

### Skip entries that vanish mid-scan instead of failing the whole scan

**What:** In `src/workers/walk.ts`, treat a per-entry `NotFoundError` (file or folder deleted while the walk runs) like `NotAllowedError`: skip it and keep walking.

**Why:** Found by the Phase 4 silent-failure review. Today any non-`NotAllowedError` aborts the whole scan. Since Phase 4 B3 that failure is visible (error state + Retry), but a folder with churny temp files can fail repeatedly.

**Pros:** Large live folders scan reliably. **Cons:** Needs care to still abort when the ROOT itself is gone (that should stay an error, not "0 files").

**Context:** `walk.ts` `isNotAllowedError` + the `skipped` event; add a test with a handle whose `getFile()` rejects with `NotFoundError`.

**Effort:** S
**Priority:** P3
**Depends on:** None

### Glob-pattern ignore rules (`*.log`, `build-*`, `.gitignore` import)

**What:** Extend ignore patterns from exact directory-name match to glob support, and/or read the scanned folder's real `.gitignore`.

**Why:** Explicitly scoped out of Phase 3 (plan.md Section 25) — exact-name match against a fixed list covers the stated roadmap line without a new dependency, but can't express `*.log`, `build-*`, or versioned cache-dir patterns. Flagged during the outside-voice review as a likely near-term feature request.

**Context:** The gold-standard approach (what ripgrep/fd do) is real `.gitignore`-glob matching via a micromatch/minimatch-style library, reading the actual `.gitignore` from the scanned root. That's a bigger scope jump than this roadmap line asked for — revisit only if real usage shows the exact-match list is insufficient.

**Effort:** M
**Priority:** P3
**Depends on:** None
