# NOVA V11.12.2 — Dashboard + Master Item Bank

NOVA یک سیستم‌عامل شخصی فارسی برای مدیریت «اکنون، تسک، پروژه، حوزه‌های زندگی، روتین، جلسه، تقویم، هدف، یادگیری، سلامت، روابط، معنویت، مالی و مرور» است. این بسته خروجی **Stage 16 — Final Integration & QA** و نسخه نهایی Production در Roadmap فعلی است.

## V11.12.2 — Dashboard + Master Item Bank

بانک «کل آیتم‌ها» از یک منبع در `public/data/master-items.json` استفاده می‌کند: ۳٬۲۴۸ آیتم، ۶ حوزه مادر و ۲۳ دسته؛ داده‌ها با فایل کامل `public/data/NOVA_Master_Item_Bank_FULL_3248.xlsx` تطبیق داده شده‌اند. نمای بانک مستقیماً در صفحهٔ `items` در `index.html` قرار دارد و iframe ندارد. منطق و ظاهر آن در `public/assets/master-bank.js` و `public/assets/master-bank.css` قرار دارند؛ Vite این فایل‌ها را هنگام build در `dist` کپی می‌کند. مسیر قدیمی `all-items.html` به `/?page=items` هدایت می‌شود.

نسخه‌های HTML قدیمی و اکسل صرفاً دسته‌بندی‌ها حذف شده‌اند. وضعیت انجام و یادداشت‌ها با شناسه آیتم در localStorage همین مرورگر ذخیره می‌شوند؛ فایل اکسل اصلی تغییر نمی‌کند. دکمهٔ «خروجی تغییرات» نسخهٔ JSON تغییرات را دانلود می‌کند. برای بررسی بانک، `node scripts/check-bank.mjs` اجرا کنید.

کارت بانک در داشبورد از همین داده و وضعیت استفاده می‌کند. تسک‌هایی با شناسهٔ صریح (`master:ID` در tags) یا عنوان دقیق و یکتا به آیتم بانک متصل می‌شوند؛ پس از اتصال، شناسهٔ تسک نگه‌داری می‌شود و تغییر عنوان اتصال را قطع نمی‌کند. تیک و ویرایش عنوان تسک مرتبط در هر دو جهت همگام می‌شود. روتین روزانه، رویداد، پروژه و تراکنش صرفاً به علت شباهت نام با تسک یکی نمی‌شوند. بعد از تغییر داده، کش نماها باطل و صفحات مرتبط هنگام ورود تازه می‌شوند. `node scripts/check-interactions.mjs` گردش ثبت/تکمیل/بازکردن مجدد تسک را با یک رکورد موقت آزمایش و آن رکورد را حذف می‌کند.

در این Patch، Dashboard اصلی دوباره به «مرکز کنترل همه حوزه‌ها» تبدیل شده است: ۱۶ کارت مرکزی، تم‌های پاستلی مستقل، جستجو/فیلتر و کنترل باز/بسته‌شدن کارت‌ها. Stripهای توسعه/QA از نمای اصلی کاربر حذف شده‌اند. Backend، API، schema و migrationها بدون تغییر معماری باقی مانده‌اند.

## شروع سریع روی Windows / PowerShell

```powershell
npm install
npm run qa
npm run demo
```

سپس مرورگر را باز کنید:

```text
http://127.0.0.1:3001
```

برای تست Runtime در یک ترمینال دوم:

```powershell
npm run smoke
```

یا فایل `START_FINAL.ps1` را اجرا کنید.

## حالت ذخیره‌سازی

اگر `DATABASE_URL` خالی باشد، برنامه در حالت دمو محلی و حافظه‌ای اجرا می‌شود. برای ذخیره دائمی و چندکاربره PostgreSQL را فعال کنید و فایل `.env` را از `.env.example` بسازید:

```env
NODE_ENV=development
PORT=3001
DATABASE_URL=postgres://postgres:postgres@localhost:5432/nova_planner
AUTH_SECRET=replace-with-a-long-random-secret
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
```

در Production وجود `AUTH_SECRET` اجباری است.

## دستورات مهم

```bash
npm run qa          # QA استاتیک بدون نیاز به اجرای Server
npm run demo        # اجرای Fastify + فایل‌های dist روی پورت 3001
npm run smoke       # Smoke Test روی Server در حال اجرا
npm run dev         # Fastify + Vite dev server
npm run build       # ساخت dist
npm run build:release
```

## مسیرهای سلامت و نسخه

```text
GET /api/health
GET /api/release
GET /api/v11.12/health
```

## Roadmap تکمیل‌شده

- Research & Architecture
- V10.1 Attention Architecture
- V10.2 Execution System
- V11 Canonical Architecture
- V11.1 Reliability & Scale
- V11.2 Unified Data Loading
- V11.3 Review & Portfolio
- V11.4 Decision Support & Personalization
- V11.5 Unified Scheduling
- V11.6 Meeting Operating System
- V11.7 Goals & Area Control
- V11.8 Knowledge & Learning
- V11.9 Health & Energy
- V11.10 Relationships & Commitments
- V11.11 Spiritual & Religious Integration
- V11.12 Finance & Resource Control
- Stage 16 Final Integration & QA

## PostgreSQL محلی با Docker

```bash
docker compose up -d
```

سپس `DATABASE_URL` را در `.env` تنظیم و برنامه را دوباره اجرا کنید. `server/schema.sql` در startup اعمال می‌شود و migrationهای مرحله‌ای 011 تا 016 نیز برای ممیزی داخل `server/migrations/` نگهداری شده‌اند.

## PWA / Offline Shell

`manifest.webmanifest` و `sw.js` هم در root و هم در `public/` قرار دارند؛ بنابراین پس از `vite build` نیز به `dist/` منتقل می‌شوند. Service Worker APIها را cache نمی‌کند و فقط shell استاتیک را پوشش می‌دهد.

## وضعیت QA

گزارش کامل در `FINAL_QA_REPORT_FA.md` است. QA استاتیک این بسته پاس شده است؛ Runtime end-to-end باید یک‌بار روی سیستم مقصد با `npm run smoke` تأیید شود.


## Production verification
- Static QA: PASS
- Runtime smoke test on target Windows environment: PASS
- Release status: V11.12.2 Dashboard + Master Item Bank (Production)
- Manual UAT checklist: `FINAL_UAT_CHECKLIST_FA.md`
