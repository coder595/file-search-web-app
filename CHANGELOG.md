# Changelog

All notable changes to this project are documented here.

## [0.1.0.0] - 2026-10-08

### Added
- When a scan or restore fails, you now see "The search stopped." with a Retry button and, if a folder was loaded, a "Choose a different folder" button. Before, the app silently stopped.
- Reopening a cached folder shows "Restoring N cached entries…" until the index is ready. It no longer looks finished while it is still loading.
- If browser storage is full or a save fails, the app tells you, keeps working for the session, and rescans next time instead of loading a half-saved index.
- The first screen invites you to pick a folder and says nothing leaves your computer.
- Release builds ship a Content-Security-Policy (`connect-src 'none'`), so the page itself cannot send data anywhere.
- GitHub Actions CI runs lint (zero warnings), unit tests with coverage, the build, and E2E on every push and PR.
- E2E now runs the real Firefox/WebKit fallback path, a CSP enforcement check, and a 2,000-row list.

### Changed
- Searching while a large folder is scanning stays responsive. Queries are coalesced so only the latest filters run.
- Accessibility pass (WCAG 2.2 AA):
  - screen-reader names for the results list
  - announcements only on status changes, not every progress tick
  - focus stays put when buttons disappear
  - better text and border contrast
  - 24px remove targets on ignore chips
  - dark-mode native controls
  - layout reflows at 320px wide
- The ignore-folders hint reads "Applies to the next scan" until a folder is loaded.
- Dev dependencies were updated within their current major versions, and the lint warnings were fixed.

### Fixed
- The results list now virtualizes properly. It used to render every row at once.
- Typing `/` inside the search box types a slash and no longer jumps focus.
- Progress or completion messages from an older, cancelled scan can no longer overwrite the current one.
- A failed search query no longer kills the app; the next keystroke recovers.
