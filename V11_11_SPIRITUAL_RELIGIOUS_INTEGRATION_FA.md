# NOVA V11.11 — Spiritual & Religious Integration

این نسخه دو ماژول قدیمی را بدون حذف تجربه اختصاصی، روی مدل canonical می‌برد:

- **معنویت**: یک View اختصاصی روی `routines` با `routine_type = spiritual` است. ثبت روزانه همان `routine_logs` را مصرف می‌کند؛ بنابراین موتور جداگانه‌ای برای عادات معنوی نداریم.
- **مناسبت مذهبی**: یک View اختصاصی روی `planner_events` با `type = religious` است. تاریخ توسط کاربر ثبت می‌شود و سیستم تاریخ مذهبی را حدس نمی‌زند.
- `spiritual_routine_details` فقط متادیتای تخصصی مثل نیت، زمان ترجیحی، حداقل اقدام و پرسش تأمل را نگه می‌دارد.
- `religious_event_details` متادیتای تخصصی مثل یادداشت مناسبت، آمادگی و فاصله یادآوری را نگه می‌دارد.
- Action آمادگی یک Task canonical است و با `entity_links` به Event مناسبت متصل می‌شود.

## APIهای جدید

- `GET /api/v11.11/integration`
- `POST /api/v11.11/spiritual-routines`
- `PATCH /api/v11.11/spiritual-routines/:id`
- `POST /api/v11.11/spiritual-routines/:id/toggle`
- `POST /api/v11.11/religious-events`
- `PATCH /api/v11.11/religious-events/:id`
- `POST /api/v11.11/religious-events/:id/create-task`
- `GET /api/v11.11/health`

## Migration

`server/migrations/016_spiritual_religious_integration.sql`

## تست پیشنهادی

1. `npm install`
2. `npm run demo`
3. صفحه «نمای معنوی» را باز کنید و یک Routine ثبت/تیک کنید.
4. همان Routine باید از موتور canonical routines استفاده کند.
5. در «تقویم مذهبی» یک تاریخ آزمایشی ثبت کنید.
6. روی «Task آمادگی» بزنید؛ Task باید در Task workspace هم دیده شود.
7. تقویم/Timeline را باز کنید؛ Event مذهبی باید همان رکورد تقویم باشد، نه یک کپی جدید.
