# NOVA V11.10 — Relationships, People & Commitments

## هدف مرحله
این مرحله «روابط و خانواده» را از یک باکس درصدی به یک سیستم عملیاتی انسانی تبدیل می‌کند. سیستم به افراد امتیاز یا درصد کیفیت نمی‌دهد؛ فقط چیزهایی را که برای عمل و وفای به تعهد لازم‌اند نگه می‌دارد: فرد، ریتم پیگیری، آخرین تماس، قول، Waiting، موعد و مناسبت مهم.

## قابلیت‌های اصلی
- People Directory با نوع رابطه، سازمان، راه تماس، برچسب و یادداشت.
- cadence قابل تنظیم برای پیگیری و محاسبه خودکار `next_contact_at`.
- ثبت `قول من`، `منتظر او` و `تعهد مشترک`.
- تبدیل Follow-up یا Commitment به Task canonical.
- در حالت `waiting_on_them`، Task لینک‌شده در وضعیت Waiting-on-person قرار می‌گیرد.
- مناسبت مهم هر فرد با یک کلیک به Calendar canonical منتقل می‌شود.
- Dashboard حوزه روابط به جای «درصد رابطه»، تعداد موارد نیازمند توجه، قول‌های باز، Waiting و مناسبت‌های نزدیک را نشان می‌دهد.
- شمارش جلسه‌های اخیر مرتبط با نام فرد به عنوان context کمکی؛ بدون ساخت دیتابیس جلسه دوم.

## APIهای جدید
- `GET /api/v11.10/relationships`
- `POST /api/v11.10/people`
- `PATCH /api/v11.10/people/:id`
- `POST /api/v11.10/people/:id/touch`
- `POST /api/v11.10/people/:id/follow-up-task`
- `POST /api/v11.10/people/:id/calendar-event`
- `POST /api/v11.10/commitments`
- `PATCH /api/v11.10/commitments/:id`
- `POST /api/v11.10/commitments/:id/create-task`
- `GET /api/v11.10/health`

## دیتابیس
Migration جدید: `server/migrations/015_relationship_people_commitments.sql`

دو جدول اضافه شده‌اند:
- `people`
- `relationship_commitments`

همین SQL به `server/schema.sql` نیز اضافه شده تا نصب تازه پروژه آن را دریافت کند.

## سناریوی تست
1. وارد «روابط / افراد» شو.
2. یک فرد با cadence مثلاً ۱۴ روز ثبت کن.
3. «تماس انجام شد» را بزن؛ `last_contact_at` و `next_contact_at` باید تغییر کنند.
4. یک تعهد با نوع «قول من» ایجاد کن و `+Task` بزن.
5. یک تعهد با نوع «منتظر او» ایجاد کن و به Task تبدیل کن؛ Task باید Waiting-on-person داشته باشد.
6. برای فردی که مناسبت مهم دارد «تقویم» را بزن و در Calendar رویداد را ببین.
7. Dashboard را باز کن؛ کارت روابط باید تعداد Follow-up/Waiting/مناسبت را نمایش دهد.

## نکته معماری
V11.10 کیفیت رابطه را به عدد تقلیل نمی‌دهد. KPIها فقط برای استثناهای عملیاتی هستند: پیگیری موعددار، تعهد عقب‌افتاده، قول باز و Waiting.
