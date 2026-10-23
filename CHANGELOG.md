# Molibden changelog

Version format follows Semantic Versioning: MAJOR.MINOR.PATCH.

## [1.4.2] - 2026-10-23

### Fixed
- Render confirmed task creation/edit/delete responses into shared local views immediately instead of waiting for application-wide reloads.
- Remove repeated bootstrap/modules downloads, unchanged-reference invalidation and duplicate task-page loads from the save path.
- Defer and debounce visible-view reconciliation and menu counts; remove startup preloading of hidden legacy analytics.
- Shorten inspector saves by refreshing the selected record rather than the entire canonical bootstrap and dashboard first.
- Keep failed-save drafts, prevent double submission, and reject stale in-flight task/dashboard snapshots after a confirmed mutation.
- Local controlled benchmark with 150 ms added per request: task creation fell from 1,215 ms (1 write + 8 reads before completion) to 165–172 ms (1 write before completion). These are not production latency measurements.
- Includes the previously prepared routine-cell fix below; v1.4.1 was not published separately. See `docs/PERFORMANCE_FA.md` for reproduction and remaining production checks.

## [1.4.1] - 2026-10-23 (prepared; included in 1.4.2)

### Fixed
- Make the entire routine day cell a native checkbox label, including its centre and padding, without duplicate toggle handlers.
- Consistent checkbox sizing, touch targets, keyboard focus and accessible routine/day labels.
- Fix routine-column sizing and remove its horizontal sticky overlay so it cannot cover day controls after RTL scrolling; column headers remain vertically sticky.

## [1.4.0] - 2026-10-23

### Added
- Shared Persian planning-date bar on every page, defaulting to today's Tehran date, with day navigation, a date picker and return-to-today.
- Automatic Tehran midnight rollover when following today; manually selected dates remain unchanged. Reminders still use the real clock.
- Day filters for task lists, daily views, meeting lists and finance transactions/deadlines; retain undated items and provide an all-days switch.
- Date-aware dashboard queries and cache keys, calendar/timeline anchors and habit-matrix month selection.
- Editable date proposals for new tasks, projects, finance records, meetings, religious events and health forms without changing dates of existing records.
- Finance month summaries follow the selected month; selected-day transaction filtering occurs before pagination. Account balances remain current, not historical snapshots.
- Regression coverage for date validation, midnight rollover, day filtering, defaults, existing-record dates and mobile layouts. Permanent lists and non-daily module summaries retain their existing scope.

## [1.3.0] - 2026-10-23

### Added
- Dedicated add/edit forms inside every finance box: accounts, monthly budgets, commitments, debts and transactions.
- Visible paid/received history, pending transaction confirmation and explicit full-debt/commitment settlement.
- Optional linked settlement transactions with account balance updates; status-only settlement for previously recorded payments.
- Idempotent settlements, validated user-scoped writes, safe balance correction when editing transactions and locked settled financial fields.
- Finance API regression tests; settlement records do not initiate bank transfers. Installment-by-installment payment tracking is not included.

## [1.2.0] - 2026-10-23

### Added
- Independent due date/time, reminders, priority and daily/weekly/Persian-monthly/Persian-yearly recurrence for every unified calendar kind.
- Recurrence interval, optional end date/count, per-occurrence completion and deletion, and explicit series-wide editing.
- In-app reminders and opt-in browser notifications while the site is open; no closed-site push delivery is configured.
- Private image/audio attachments stored separately in PostgreSQL (up to 5 per item, 2 MiB each), authenticated preview/download/removal, plus local snapshot support.
- Idempotent calendar attachment schema migration and validation of file types, contents and size.

## [1.1.2] - 2026-10-23

### Fixed
- Applied startup performance changes to the current Molibden application, preserving the reviewed 65 categories, 10 domains, authentication and Persian calendar.
- Load the full bank only when the items page opens. Deduplicate simultaneous initialization requests.
- Render category rows on expansion, 50 at a time; search all items including unrendered rows, with topic and review filters preserved.
- Defer hidden-view API preloads and hidden-view navigation counter requests; share the compact dashboard cache.
- Serve cached public assets immediately and refresh them in the background; keep API responses outside the service worker cache.

## [1.1.1] - 2026-10-23

### Fixed
- Restored the Molibden 1.1 application from b9b7f64 after the accidental replacement with the older NOVA ZIP (restoration commit: 47d7a25).
- Restored Persian calendar, account authentication, responsive UI, Vercel integration, and the reviewed bank of 3,248 items in 65 categories across 10 domains.

### Changed
- Unified application and API version numbers using package.json.
- Displayed the version in the page header and exposed version and deployment commit through /api/health and /api/release.
- Added QA checks for matching package, lockfile, UI, changelog and service worker versions.

### At this release
- Startup performance changes had not yet been reapplied to Molibden; completed in 1.1.2.

## [1.1.0]

- Existing Molibden baseline at b9b7f64: calendar, authentication, reviewed categories and PostgreSQL configuration.
