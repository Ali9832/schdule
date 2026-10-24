# NOAVA changelog

Version format follows Semantic Versioning: MAJOR.MINOR.PATCH.

## [2.1.1] - 2026-10-24

Upgrade: **2.1.0 → 2.1.1**, based on `a31ca0a484aa8f116099daef84ca524065c281cf`. Release commit: annotated tag `v2.1.1`.

### Fixed
- Replace scattered title-only Enter listeners and reliance on implicit browser submission with one capture-phase keyboard router. Enter/Numpad Enter in an editable single-line field explicitly calls the form's normal `requestSubmit` path.
- Cover general create/edit, finance, calendar, academic, inspector, project report/meeting and quick-capture forms. Existing meeting, goal, resource, schedule, spiritual/religious, people/commitments and health entry controls invoke their existing save button path and share pending guards with mouse saves.
- Consume handled Enter before stale global command-palette or inline quick-capture handlers can swallow or duplicate it. Retain required-field validation and failed-save recovery.
- Leave textareas, search controls, read-only/disabled fields, autocomplete selection, IME composition, modified Enter and date/time picker inputs to their own behavior. Ignore repeated keydown while a save is pending.
- Version new/changed scripts and synchronize package, visible version and service-worker cache to 2.1.1. No server API or data migration changes.

### Validation
- Real local task create/edit and dashboard quick capture save exactly once, including Enter keydown without a separate character event and held-key repeat. Existing textarea-newline, empty-title, failure recovery and composition tests pass.
- Keyboard dispatch probes cover general, finance, calendar, academic, task inspector, project report/meeting and 11 legacy entry points, including Numpad Enter and a stale command-palette shortcut. Probes intercept submit handlers without writing records; persistence checks use isolated local fixtures.
- Build and all 64 QA checks passed, together with keyboard persistence/dispatch, date-control, scheduling and page-layout browser regression checks. The previous Enter implementation did not provide uniform coverage across these entry points.

## [2.1.0] - 2026-10-24

Upgrade: **2.0.3 → 2.1.0**, based on `746c0a6fd5935473894e62f8dd66e576b4c1b372`. Release commit: annotated tag `v2.1.0` (`git rev-parse v2.1.0^{commit}`). Compatible UI features; API routes, ISO date/time payloads and stored data remain compatible.

### Improved scheduling form
- Show one primary program date. Start/end times appear only for timed programs; the last day appears only when a user explicitly selects a multi-day event. Non-event records keep a single date.
- Group recurrence with reminders. Explain the interval using the chosen unit (days/weeks/months/years), and show a plain-language summary beginning at the first occurrence.
- Choose one repetition ending mode: no end, a specific date, or a total count. Hidden controls are disabled and excluded from the recurrence payload. Earlier records with both conditions retain both via an explicit legacy mode, instead of silently losing a condition.
- Move a separate delivery deadline behind an opt-in setting. Distinguish program date, delivery deadline and recurrence ending; reminders clearly identify their reference time. Course/project links, attachments and notification settings are grouped separately.
- Preserve existing multi-day ranges, recurrence interval/end conditions, deadlines, priorities and drafts when editing. Hidden elements remain hidden despite grid/flex styling. Remove an old closed day-dialog node before immediately reopening it to avoid duplicate dialog IDs.

### Unified date/time input
- Persian date and 24-hour time fields accept manual Persian/Arabic/Latin digits, including compact `14050803` and `1330`, and normalize on blur while preserving ISO/HH:mm values for APIs.
- Focused inputs support mouse-wheel and Up/Down changes to the selected numeric segment. Unfocused, disabled/read-only fields and Ctrl/Meta wheel do not change values. Date month/year changes clamp the day to the destination month's length.
- Date and time pickers include editable numeric year/month/day or hour/minute controls with scroll and increase/decrease buttons. Existing calendar-grid selection remains available; invalid dates are rejected and parent forms remain open while choosing.
- Version the changed assets and synchronize package/UI/service-worker caches to `2.1.0`.

### Validation
- Dedicated browser coverage: visible date reduction, timed/multi-day toggles, compact Persian typing, real wheel/arrow interaction, manual and wheel picker controls, month-end clamping, recurring class persistence, opt-in deadline removal and old dual-condition/multi-day records.
- Regression checks passed for image/audio attachment previews, per-occurrence completion/reminders, planning dates, financial editing, project reports/meetings, keyboard submission and page hierarchy. Build and all 63 QA checks passed. Local demo fixtures only; no production account data modified by tests.

## [2.0.3] - 2026-10-24

Upgrade: **2.0.2 → 2.0.3**, based on `464fbc62718019468714388bc822fb3b23506311`. Release commit: annotated tag `v2.0.3` (`git rev-parse v2.0.3^{commit}`).

### Fixed
- The general add/edit dialog is now a native HTML form with a required title and an explicit submit button. Enter in a single-line title/input submits through the same save path as clicking Save; textarea Enter keeps its newline and Cancel does not submit.
- Prevent concurrent/duplicate saves, including repeated Enter during slow create or edit requests. Validation and failed-save recovery retain the entered text and draft.
- Title fields in the meeting, outcome and resource composers support Enter. Custom shortcuts exclude IME composition, auto-repeat and modified Enter; composer saves share a pending guard with button saves.
- Existing native forms (calendar, finance, inspector and project reports) retain their standard keyboard submission behavior.
- The changed JS asset URL and service-worker/package/UI versions are synchronized to 2.0.3. No backend API or stored-data changes.

### Validation
- Browser uses real keyboard events to create and edit a task, verifies one mutation on repeated Enter, rejects an empty title, checks textarea newline and failed-save recovery, and tests composer Enter/IME/modifier handling.
- Build/full QA, general NOAVA browser workflows and shell layout regression run before release.

## [2.0.2] - 2026-10-24

Upgrade: **2.0.1 → 2.0.2**, based on `2b686a7b4dd6e9c6eddc7383cef7a56ab5aca19b`. Release commit: annotated tag `v2.0.2`.

### Fixed
- Root cause of the user's screenshot: a duplicate opening `div.top-actions` left the topbar unclosed, nesting the day strip and every page inside its flex row. Removed the extra opening tag; all pages are direct children of `main` again. At 1920px the dashboard restores its 1600px width instead of being squeezed to roughly 517px beside the header.
- This markup regression was introduced in 2.0.0. The unrelated overdue-dialog fix in 2.0.1 did not address the reported layout failure.
- Synchronized visible/package/cache version to 2.0.2; no account data or APIs changed.

### Validation
- New mandatory shell-structure QA rejects the exact duplicate-container regression in source and built HTML.
- Browser geometry checks all page parents, absence of pages inside the topbar, dashboard width and header separation at 390, 1280, 1920 and 3200px (including the wide viewport associated with browser zoom-out).
- Visually inspected a 1920px screenshot of the corrected layout. Build, full QA, NOAVA workflows and overdue-dialog browser regression run before release.

## [2.0.1] - 2026-10-24

Upgrade: **2.0.0 → 2.0.1**, based on `5a660440b136cdb333ea53deba4d81f2eb8bcc94`. Release commit: annotated tag `v2.0.1` (`git rev-parse v2.0.1^{commit}`).

### Fixed
- Reproduced a blocking overdue-review layout with 100 rows: the only dismissal button was over 13,000px below the viewport. Added an always-visible close header and footer, with scrolling limited to the list, including narrow/short screens.
- Support real backdrop clicks and Escape, preserve inside clicks, and prevent dismissal while a write is pending.
- Capture the dialog instance in close handlers so a delayed close event cannot remove a newly reopened dialog.
- Automatic review does not interrupt a focused input. Session-storage errors cannot prevent dismissal.
- Version the changed JS/CSS asset URLs so an older service-worker cache cannot pair the new document with the old dialog code. Cache namespace synchronized to `noava-v2.0.1`.

### Validation and limits
- Dedicated browser regression checks 100 rows on desktop, mobile and landscape; visible controls, list scrolling, real close/backdrop clicks, inside clicks, rapid reopen, focus protection and zero data writes.
- Full build/QA and NOAVA browser regression run before release. No production account data was changed during diagnosis.
- This fixes a reproduced UI blocker. The user's unspecified production error has not been identified conclusively; authenticated production workflows require the failing screen/action to reproduce.

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
