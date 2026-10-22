# اعمال preview.html روی بیس اصلی NOVA

این نسخه از همان پروژه `schdule (2)` به عنوان بیس استفاده می‌کند. ظاهر اصلی وب از `preview.html` اعمال شده و Backend اصلی Fastify پروژه حفظ شده است.

## تست سریع
```bash
npm install
npm run demo
```
سپس: `http://127.0.0.1:3001`

در حالت بدون `DATABASE_URL`، پروژه با Workspace محلی مشترک اجرا می‌شود تا Front/Back بدون PostgreSQL قابل تست باشد. در محیط Production، احراز هویت PostgreSQL همچنان مبناست.

## اتصال‌های واقعی
- داشبورد: `/api/bootstrap`
- تسک‌ها: `/api/tasks`
- پروژه‌ها: `/api/projects`
- اهداف: `/api/goals`
- عادت‌ها: `/api/habits` و `/api/habits/matrix`
- مالی: `/api/finance/*`
- ماژول‌های عادات معنوی، مناسبات، سلامت، یادگیری، روابط و بازنگری: `/api/modules/*`

ساختار React قبلی در `src/` حذف نشده و برای رجوع/مهاجرت مرحله بعد باقی مانده است؛ ورودی فعلی پروژه همان HTML تأییدشده است.
