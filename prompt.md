# Prompt for Claude Code — Build the File Search Web App

You are building a file search web app from the attached `plan.md`. Read `plan.md` in full before writing any code — it is the source of truth for scope, architecture, tech stack, tooling process (Section 14), and constraints. This is a production build, not a prototype: the gate in `plan.md` Section 17 applies, not just a "does it run" bar.

## Tooling available in this terminal
gstack, ECC, VibeSec-Skill, and ponytail are installed. Use them as `plan.md` Section 14 assigns them — don't run every tool at every step; each has a specific job:
- **gstack** — sprint process: `/plan-eng-review`, `/review`, `/cso`, `/qa`, `/benchmark`, `/document-release`, `/ship`
- **ECC** — `tdd-workflow` skill per feature, `security-review` skill, `e2e-testing` skill (Playwright)
- **VibeSec-Skill** — security knowledge inside `/cso` and `security-review` passes, scoped to `plan.md` Section 12's applicability table (this app has no backend — don't flag SQLi/SSRF/auth findings that can't exist)
- **ponytail** — stays active (`full` level) for the whole build; run `/ponytail-review` after each phase

## Working style
- Before writing any code: run `/plan-eng-review` (gstack) against `plan.md`. Fold its findings back into `plan.md` itself if they change scope or architecture — don't let the plan and the review diverge.
- Build each feature through ECC's `tdd-workflow`: failing test first, capture the RED evidence, implement to GREEN, refactor. This applies to Phase 0 and Phase 1 equally.
- Build in the phase order from `plan.md` Section 15 (Phase 0 → Phase 1 → Phase 2 → Phase 3). Don't jump ahead before the current phase clears Section 17's gate.
- After each feature: `/ponytail-review`. After each full phase: `/review` (gstack), then `/cso` (gstack) scoped per Section 12.
- Maintain `PROGRESS.md` at the repo root: phase status (not started / in progress / done), which Section 17 gate items are checked for the current phase, and any deviations from `plan.md` with a one-line reason. Log VibeSec categories assessed as N/A explicitly (per Section 12's table) rather than silently skipping them, so a later reviewer can see they were considered, not missed.
- If something in `plan.md` is ambiguous, make the most reasonable call, log it under "Assumptions" in `PROGRESS.md`, and keep moving — don't block on it unless it changes architecture.
- If something genuinely contradicts a stated constraint in `plan.md` Section 4 or 13 (hard browser limitations, not preferences), stop and flag it rather than quietly working around it.

## Scope for this session
Start with **Phase 0 (scaffold)** and **Phase 1 (MVP)**. Move to Phase 2/3 only after Phase 1 clears every item in `plan.md` Section 17.

## Acceptance criteria for Phase 1
Functional (all must be true):
- [ ] `npm run dev` starts the app with no errors
- [ ] In Chrome/Edge: "Select Folder" opens the native picker, and picking a real folder triggers a recursive scan with a visible progress indicator
- [ ] Typing in the search box filters results live (debounced), matching by filename
- [ ] Extension, size, and date-modified filters work and combine with the search query
- [ ] Results list is virtualized and stays responsive with a folder containing 10,000+ files (a synthetic test folder is fine)
- [ ] Closing and reopening the tab restores the last folder's index from IndexedDB without a full re-scan (a permission re-request prompt is expected)
- [ ] A manual "Refresh" button triggers a full re-scan
- [ ] In Firefox/Safari (or a manual feature-flag override for testing), the app shows the fallback banner and still lists files read-only via `<input webkitdirectory>`
- [ ] No file content or path is ever sent over the network — verify no fetch/XHR calls touch scanned data

Production-readiness (from `plan.md` Section 17 — required before Phase 1 is "done", not optional polish):
- [ ] `/plan-eng-review` findings incorporated
- [ ] TDD followed via ECC's `tdd-workflow`, 80%+ unit coverage
- [ ] `/review` (gstack) clean
- [ ] `/cso` (gstack) clean, scoped per Section 12
- [ ] `/ponytail-review` clean
- [ ] `/qa` (gstack) live-browser pass
- [ ] `/benchmark` (gstack) baseline captured
- [ ] `npm audit` clean
- [ ] E2E suite (ECC `e2e-testing`, Playwright, mocked `FileSystemDirectoryHandle`) passing
- [ ] `/document-release` (gstack) run — README and `PROGRESS.md` current
- [ ] `/ship` (gstack) — coverage audit, PR opened

## Tech constraints — don't deviate without flagging
Use the stack in `plan.md` Section 6: React + TypeScript + Vite, FlexSearch, idb-keyval, browser-fs-access, @tanstack/react-virtual, Zustand, Tailwind CSS. All scanning/indexing runs in a Web Worker — never block the main thread with directory walking. Filenames/paths render as text only, never via `dangerouslySetInnerHTML` (Section 12).

## Output
- Working code, organized sensibly (e.g. `src/components`, `src/workers`, `src/lib`, `src/store`)
- `README.md` with setup/run instructions and a short note on the browser-support limitation from `plan.md` Section 4
- `PROGRESS.md` as described above, including the Section 17 gate checklist status
