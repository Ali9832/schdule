# NOVA V11.7 — Goals, Outcomes & Area Control

این مرحله لایه «جهت و کنترل حوزه‌های زندگی» را به معماری canonical متصل می‌کند. هدف اصلی این است که Outcome قابل سنجش باشد، Projectها به Outcome واقعی لینک شوند، و Areaها با شواهد قابل اقدام کنترل شوند؛ نه با یک درصد کلی و مبهم از «وضعیت زندگی».

## قابلیت‌های اضافه‌شده

- داشبورد جدید V11.7 با KPIهای Outcome فعال، Outcome در ریسک، پوشش Project → Outcome و Areaهای نیازمند توجه.
- صفحه Outcomes بازطراحی‌شده با Current / Target / Unit / Baseline / Direction / Due / Review / Next Action.
- نمایش درصد فقط برای Outcomeهایی که مخرج و معیار قابل فهم دارند.
- لینک چند Project فعال به یک Outcome از طریق `entity_links` با relation=`advances`.
- محاسبه `Project → Outcome coverage` برای پیدا کردن Projectهای فعال بدون نتیجه روشن.
- Area Control مبتنی بر استثناها: Task عقب‌افتاده، Waiting، Project بدون Next Action و Outcome ریسکی/نیازمند توجه.
- Standard اختصاصی برای هر Area؛ بدون ساختن درصد مصنوعی برای سلامت/روابط/معنویت و سایر Areaها.
- Outcome Editor با تعریف معیار و منبع اندازه‌گیری.
- Preview مستقل دارای داده نمایشی و امکان ویرایش محلی بدون Backend.

## قواعد شفاف وضعیت Outcome

- `risk`: Outcome فعال که موعد آن گذشته است.
- `attention`: معیار سنجش ناقص است، Next Action ندارد، یا موعد نزدیک است و فاصله با Target زیاد است.
- `stable`: بر اساس داده موجود استثنای فوری دیده نمی‌شود.
- `done`: Outcome تکمیل شده است.

این قواعد امتیاز مخفی یا «AI score» نیستند و دلیل هر وضعیت در UI نمایش داده می‌شود.

## Data model

Migration جدید:

`server/migrations/012_outcome_area_control.sql`

فیلدهای جدید Outcomes:

- `metric_name`
- `baseline_value`
- `target_direction`
- `review_at`
- `measurement_note`
- `version`

رابط Project → Outcome از جدول canonical `entity_links` استفاده می‌کند و داده تکراری نمی‌سازد.

## APIهای V11.7

- `GET /api/v11.7/control`
- `POST /api/v11.7/outcomes`
- `PATCH /api/v11.7/outcomes/:id`
- `DELETE /api/v11.7/outcomes/:id`
- `POST /api/v11.7/outcomes/:id/projects/:projectId`
- `DELETE /api/v11.7/outcomes/:id/projects/:projectId`
- `GET /api/v11.7/health`

APIهای نسخه‌های قبلی حفظ شده‌اند.

## سناریوی تست پیشنهادی

1. `npm install`
2. `npm run demo`
3. صفحه `اهداف / Outcomes` را باز کنید.
4. یک Outcome بسازید و Area، Current، Target، Unit و Next Action تعیین کنید.
5. یک یا چند Project را به Outcome لینک کنید.
6. در Dashboard مقدار `Project → Outcome` را بررسی کنید.
7. در صفحه Areas، Standard یک حوزه را ویرایش کنید و دلیل وضعیت آن را بررسی کنید.
8. یک Outcome با موعد گذشته بسازید تا وضعیت `در ریسک` نمایش داده شود.
9. یک Outcome بدون Unit یا Next Action بسازید تا وضعیت `نیازمند توجه` نمایش داده شود.

## تست انجام‌شده در بسته تحویلی

- `node --check server/index.js`
- Syntax check تمام بلوک‌های JavaScript داخل `index.html`
- فایل Preview مستقل از همان `index.html` ساخته شده است.

تست Runtime کامل Fastify/PostgreSQL نیازمند نصب dependencyها و اجرای پروژه روی سیستم مقصد است.
