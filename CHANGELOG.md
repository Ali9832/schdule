# NOAVA changelog

Version format follows Semantic Versioning: MAJOR.MINOR.PATCH.

## [2.0.0] - 2026-10-24

Upgrade: **1.6.0 → 2.0.0**. Previous commit: `0a974cae181857f7431ee5bd7bd827ce5dd4010b`. The release commit is referenced by annotated tag [`v2.0.0`](https://github.com/Ali9832/schdule/releases/tag/v2.0.0); resolve locally with `git rev-parse v2.0.0^{commit}`. Author: `molibdengit`.

### Breaking change: monetary API unit
- All financial amounts now use **TOMAN**, including accounts, budgets, debts, installments, commitments and transactions. Finance API consumers must send toman instead of rial. Existing API paths are retained.
- Legacy snapshots without `finance.currency_unit: "TOMAN"` are divided by 10 on read without modifying the source. The next normal write persists converted amounts with the marker; subsequent reads/writes do not divide again. No startup-wide database rewrite/scan is performed. Signed balances and fractional toman are preserved.
- The major version reflects this API unit change. Package identity becomes `noava`; deployment URL and Git repository stay unchanged.

### Added and fixed
- NOAVA branding and «آوای نو» slogan, title, sidebar, PWA manifest and notification names; old storage keys and structured meeting prefixes remain compatible.
- Academic course registration/editing, course filters, Saturday–Friday timetable, exams, quizzes, homework, study and course projects, sharing existing calendar/tasks/projects and recurrence. Server checks course/project ownership.
- Sidebar and top avatar open the account page with the signed-in user's identity.
- Real backdrop clicks close the day dialog; inside clicks and drags originating inside do not.
- Account-scoped local drafts for calendar, finance, general forms, inspector edits, project reports/meetings, meeting/outcome/resource composers and quick capture. Drafts survive accidental close/reload, expire after 30 days and clear after successful save, explicit discard or logout. Passwords and file contents are excluded.
- Task checkboxes/status changes strike through and dim completed records, move them to the bottom and guard pending writes. Server pagination sorts done tasks last; calendar completion appears immediately and follows the same ordering.
- Daily overdue review supports completion/deletion, selection and explicit carry-forward. Recurring items move one occurrence while preserving the series and future state.
- Service-worker namespace `noava-v2.0.0` clears previous app caches.

### Validation
- Build passed; 61 QA checks passed; all 13 local smoke endpoints returned 200. Financial conversion/formatting and academic/overdue API tests passed.
- Browser coverage: branding/profile, draft reload/discard/account isolation, grouped toman entry, real backdrop clicks, academic recurrence/project links, completion order and mobile layout.
- Regression checks: project reports/meetings, Today actions, financial settlement/balances, routine hit targets and confirmed-write performance. Final results are recorded in `IMPLEMENTATION_REPORT_FA.md`.

### Limits and remaining work
- Drafts belong to the current browser; no cross-device synchronization. Unsaved file/audio selections must be selected again after reload. Closed-site push reminders remain outside this release.
- Automatic overdue review covers the previous 730 days. Older items remain in original views. Group transfers are sequential: successful transfers stay committed if a later request fails; only unprocessed rows remain to retry.
- Production account workflows require authentication. Deployment health checks confirm version/commit/storage, not a production write test.

## [1.6.0] - 2026-10-23

### Added
- Two dedicated boxes in project details: linked meetings and dated project reports, preserving existing project fields and links.
- Create project meetings directly in the inspector; they share the existing calendar/meetings records, support explicit held/scheduled status and link to full meeting editing.
- Persist project reports in a separate user-owned PostgreSQL table with local snapshot support; reports are editable and include optimistic version conflict protection.
- Include project reports in the existing local-to-PostgreSQL import plan; deleting a project cascades its report history in both storage modes.
- Reports are visible both in project history and the Reports page, with edit actions returning to the correct project.
- Idempotent schema migration 018, user/project isolation tests, input validation and immediate confirmed report updates without full-application reloads.
- Past meeting dates are not treated as proof that a meeting was held. Report lists show the latest 100 entries; unsaved report drafts survive inspector reopening within the same browser session only.

## [1.5.0] - 2026-10-23

### Added
- Today-view task cards have completion checkboxes, edit actions and confirmed deletion in the requested fourth card under `#todayPageBody`.
- Completed tasks are struck through, visually muted and stably moved behind open tasks; unchecking reopens a task.
- Responsive accessible controls, immediate pending completion feedback, duplicate-action protection and failure rollback without application-wide reloads.

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
