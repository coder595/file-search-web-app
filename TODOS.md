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

## Feature

### Glob-pattern ignore rules (`*.log`, `build-*`, `.gitignore` import)

**What:** Extend ignore patterns from exact directory-name match to glob support, and/or read the scanned folder's real `.gitignore`.

**Why:** Explicitly scoped out of Phase 3 (plan.md Section 25) — exact-name match against a fixed list covers the stated roadmap line without a new dependency, but can't express `*.log`, `build-*`, or versioned cache-dir patterns. Flagged during the outside-voice review as a likely near-term feature request.

**Context:** The gold-standard approach (what ripgrep/fd do) is real `.gitignore`-glob matching via a micromatch/minimatch-style library, reading the actual `.gitignore` from the scanned root. That's a bigger scope jump than this roadmap line asked for — revisit only if real usage shows the exact-match list is insufficient.

**Effort:** M
**Priority:** P3
**Depends on:** None
