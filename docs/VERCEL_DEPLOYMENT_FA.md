# استقرار GitHub و Vercel

این مخزن شامل کد نسخهٔ کاری است؛ انتشار نهایی ۱.۲ یا آرشیو قفل‌شدهٔ ۱.۱ محسوب نمی‌شود.

## تنظیمات پروژه در Vercel

- Repository: `Ali9832/schdule`
- Production Branch: `main`
- Root Directory: ریشهٔ مخزن (`.`)، جایی که `package.json` و `vercel.json` هستند.
- Framework: Vite
- Install: `npm ci`
- Build: `npm run build`
- Output: `dist`
- Node.js: 22.x

فایل `vercel.json` مسیرهای `/api/*` را به یک Function با Fastify می‌فرستد. فایل‌های رابط از `dist` روی CDN ارائه می‌شوند و فایل SQL موردنیاز راه‌اندازی سرور در بستهٔ Function قرار می‌گیرد.

## متغیرهای ضروری

در Settings → Environment Variables برای Production و Preview:

1. `DATABASE_URL`: رشتهٔ اتصال PostgreSQL با تنظیمات TLS پیشنهادی سرویس پایگاه داده. از اتصال مناسب محیط سرورلس/pooled استفاده کنید.
2. `AUTH_SECRET`: مقدار تصادفی طولانی و ثابت برای امضای نشست‌ها.

در اتصال Prisma این پروژه، `scdule_DATABASE_URL` نیز پشتیبانی می‌شود. اگر `DATABASE_URL` از قبل موجود باشد، اولویت با آن است؛ مقدار آن باید آدرس PostgreSQL همین دیتابیس جدید باشد، نه آدرس قدیمی. برای کلاینت `pg` از آدرس `postgres://` یا `postgresql://` استفاده کنید، نه آدرس Prisma Accelerate.

روی Vercel، هر نمونهٔ Function حداکثر یک اتصال هم‌زمان نگه می‌دارد. تاریخ‌های PostgreSQL به قالب رشته‌ای موردانتظار آمار و تقویم تبدیل می‌شوند. تست این رفتار در QA عمومی و با `node scripts/check-postgres-config.mjs` اجرا می‌شود.

برای ساخت فایل محلیِ مقدارهای لازم:

```powershell
node scripts/prepare-vercel-env.mjs
```

فایل `.local/vercel.env` در Git و Vercel نادیده گرفته می‌شود و نباید ارسال شود. مقدار `DATABASE_URL` را محلی وارد کنید و هر دو مقدار را در تنظیمات ورسل قرار دهید. رمز یا توکن را در چت و کد نگذارید.

`OPENAI_API_KEY` اختیاری است. `CLIENT_ORIGIN` برای رابط و API هم‌دامنه لازم نیست؛ اگر تنظیم می‌کنید باید دامنهٔ آنلاین باشد، نه localhost. پس از تغییر متغیرها Redeploy انجام دهید.

## حساب کاربری و داده‌ها

نسخهٔ دارای PostgreSQL فرم ورود و ساخت حساب دارد و درخواست‌ها را با نشست همان حساب می‌فرستد. در محیط محلی بدون PostgreSQL، رفتار محلی فعلی حفظ می‌شود. نسخهٔ آنلاین بدون پایگاه داده یا کلید نشست راه‌اندازی نمی‌شود و در خرابی اتصال به حافظهٔ موقت تغییر وضعیت نمی‌دهد.

داده‌های `.local/development.json`، ویرایش‌های ذخیره‌شده در مرورگر و آرشیو ۱.۱ به GitHub منتقل نمی‌شوند. برای مهاجرت دادهٔ محلی، مسیر مستقل `db:import` و راهنمای PostgreSQL پروژه را بعد از ساخت حساب مقصد استفاده کنید.

## بررسی پس از پوش

در GitHub وضعیت commit و بررسی Vercel را ببینید. سپس در Deployments باید وضعیت Ready ثبت شود. `/api/health` باید `storage: postgresql` برگرداند. ورود، ساخت یک کار، نوسازی صفحه و مشاهدهٔ دوبارهٔ آن را آزمایش کنید.

تنظیمات بر اساس مستندات رسمی Vercel برای Vite و راهنمای serverless خود Fastify آماده شده‌اند:

- https://vercel.com/docs/frameworks/frontend/vite
- https://fastify.dev/docs/latest/Guides/Serverless/
