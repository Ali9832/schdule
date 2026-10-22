# NOVA V11.9 — سلامت، انرژی و عملکرد پایدار

## هدف این مرحله
V11.9 ماژول سلامت را از یک کارت عمومی به یک سیستم عملیاتی تبدیل می‌کند. سلامت همچنان یک **Area** است و Task، Routine و Eventهای مرتبط از منابع canonical خودشان استفاده می‌کنند؛ داده تکراری ساخته نمی‌شود.

## قابلیت‌های اضافه‌شده
- صفحه مستقل «سلامت / انرژی» در Sidebar و Command Palette.
- Daily Check-in برای خواب، انرژی، حرکت، حال عمومی و فشار ذهنی.
- شاخص‌های قابل تنظیم با Target حداقل/حداکثر و جهت «بیشتر بهتر / کمتر بهتر / داخل بازه».
- تمایز روشن بین `بدون داده` و `نیازمند توجه`؛ V11.9 درصد کلی سلامت تولید نمی‌کند.
- نمودار ۱۴ روزه کوچک برای هر شاخص و میانگین ۷ روزه.
- نمای Routineهای سلامت از همان موتور canonical Routine.
- ثبت Appointment سلامت به‌عنوان Event؛ همان رویداد در Calendar/Timeline نیز دیده می‌شود.
- تطبیق Task با Energy ثبت‌شده: High / Medium / Low و محدودیت زمانی پیشنهادی. این قابلیت صرفاً برای برنامه‌ریزی کار است و ارزیابی پزشکی نیست.
- کارت سلامت Dashboard به Energy و Attentionهای V11.9 متصل شده است.

## APIهای جدید
- `GET /api/v11.9/health-system`
- `POST /api/v11.9/checkin`
- `POST /api/v11.9/logs`
- `POST /api/v11.9/metrics`
- `PATCH /api/v11.9/metrics/:id`
- `POST /api/v11.9/appointments`
- `GET /api/v11.9/recommendations`
- `GET /api/v11.9/health`

## دیتابیس
Migration جدید:

`server/migrations/014_health_energy_system.sql`

جدول‌ها:
- `health_metric_definitions`
- `health_metric_logs`

`server/schema.sql` نیز به‌روزرسانی شده تا نصب تازه پروژه همین ساختار را ایجاد کند. حالت بدون PostgreSQL از Memory fallback پشتیبانی می‌کند.

## سناریوی تست پیشنهادی
1. پروژه را اجرا کن و از Sidebar وارد «سلامت / انرژی» شو.
2. برای امروز Sleep=7.5، Energy=7، Movement=30، Mood=7 و Stress=4 ثبت کن.
3. بررسی کن KPIها، نمودارها و Task Fit بدون Refresh کامل صفحه تغییر کنند.
4. یک شاخص سفارشی بساز و با دکمه «ثبت» برای آن مقدار وارد کن.
5. یک Appointment بساز و سپس صفحه «تقویم / Timeline» را باز کن.
6. یک Task با `energy=medium` و Duration حدود ۳۰ دقیقه داشته باش؛ در بخش تطبیق انرژی باید قابل پیشنهاد باشد.
7. اگر شاخصی داده ندارد، باید `بدون داده` دیده شود نه قرمز/شکست.

## بررسی فنی انجام‌شده
- `server/index.js` با `node --check` بررسی شد.
- هر ۸ بلوک JavaScript داخل HTML با `node --check` بررسی شد.
- فایل‌های `index.html`، `dist/index.html` و `preview-applied.html` همگام هستند.

## اجرای محلی
```bash
npm install
npm run demo
```

سپس آدرس نمایش‌داده‌شده توسط Fastify را باز کن (در تنظیم فعلی معمولاً `http://127.0.0.1:3001`).
