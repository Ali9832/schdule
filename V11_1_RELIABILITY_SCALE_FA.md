# NOVA V11.1 — Reliability & Scale

این مرحله روی پایداری تعامل و مقیاس ۳۰۰۰+ آیتم تمرکز دارد.

## تغییرات اصلی
- API صفحه‌بندی‌شده `GET /api/v11/tasks/paged` با limit/cursor و فیلترهای q/status/area/project/waiting.
- Endpoint سبک `GET /api/v11/summary` و health اختصاصی V11.1.
- جدول Task در Workspace با windowing/virtualization؛ فقط ردیف‌های قابل‌دیدن در DOM هستند.
- بارگذاری مرحله‌ای با دکمه «بارگذاری بیشتر».
- تغییر Status تسک به‌صورت Optimistic و rollback در خطا.
- Habit checkbox به‌صورت Optimistic؛ فقط ماتریس و aggregateهای مربوط بازترسیم می‌شوند.
- IndexedDB Outbox برای mutationهای زمان آفلاین و retry هنگام برگشت اتصال.
- PWA shell اولیه با `manifest.webmanifest` و `sw.js` برای cache پوسته سایت.
- وضعیت Sync/Outbox/Loaded/Total در Workspace نمایش داده می‌شود.
- احترام به `prefers-reduced-motion` برای کاهش پرش و حرکت اضافه.

## نکته معماری
این نسخه «پل مقیاس‌پذیری» است. برخی صفحات قدیمی V10 هنوز برای سازگاری از `/api/bootstrap` استفاده می‌کنند؛ Workspace canonical از endpoint صفحه‌بندی‌شده استفاده می‌کند. حذف کامل bootstrap سنگین می‌تواند در V11.2 انجام شود.

## تست
1. `npm install`
2. `npm run demo`
3. `http://127.0.0.1:3001`
4. وارد «کارها و نماهای لینک‌شده» شوید.
5. Status یک Task را عوض کنید؛ باید بدون Refresh کامل UI تغییر کند.
6. DevTools > Network را Offline کنید؛ تغییرات باید در Outbox بروند و بعد از Online شدن retry شوند.
7. در جدول بزرگ Scroll کنید؛ فقط بازه قابل‌دیدن باید رندر شود.
