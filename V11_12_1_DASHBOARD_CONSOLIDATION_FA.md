# NOVA V11.12.1 — Dashboard Consolidation

این نسخه بر پایه V11.12 Final ساخته شده و Backend / Database / Canonical Data Model را تغییر نمی‌دهد.

## تغییر اصلی
- بازگرداندن «مرکز کنترل همه حوزه‌ها» به Dashboard اصلی.
- نمایش ۱۶ کارت اصلی در یک Grid واحد.
- اضافه‌شدن کارت‌های جلسات، تقویم، اهداف، Waiting، Inbox و بانک کل آیتم‌ها کنار ماژول‌های قبلی.
- تم رنگی پاستلی مستقل برای هر کارت (هدر، آیکن، حاشیه و نوار کناری).
- امکان باز/بسته‌کردن هر کارت و جمع/بازکردن همه کارت‌ها.
- جستجو و فیلتر گروه‌های اجرا / زندگی / رشد / کنترل.
- مخفی‌شدن Stage / API / Cache / QA stripها از Dashboard کاربر.
- حذف «امتیاز کلی زندگی» قدیمی از نمای اصلی.
- حفظ Today / Attention / Meetings / Active Projects / Decision Support در بالای Dashboard.
- KPI کارت‌های جلسات، تقویم، اهداف و Waiting از همان داده زنده موجود Mirror می‌شوند؛ منبع داده جدید ساخته نشده است.

## بدون تغییر
- API routeها
- Migrationها
- Database schema
- Entity model
- صفحات تخصصی ماژول‌ها
