# NOVA V11.4 — Decision Support & Personalization

## هدف
تبدیل داشبورد از نمایش صرف وضعیت به یک تصمیم‌یار شفاف، بدون ساختن «امتیاز جادویی».

## تغییرات
- Decision Support روی Dashboard با Context / Energy / زمان آزاد.
- دلیل هر پیشنهاد به‌صورت قابل مشاهده: موعد گذشته، امروز، اولویت بالا، پروژه Active، Context، Energy و مدت.
- تنظیم قواعد Attention برای Stale Project و Waiting طولانی.
- شخصی‌سازی نمایش بخش‌های Dashboard.
- Saved Views در Task Workspace.
- فیلتر Context / Energy / Duration به API صفحه‌بندی Tasks.

## APIهای جدید
- GET /api/v11.4/preferences
- PUT /api/v11.4/preferences
- GET /api/v11.4/recommendations
- POST /api/v11.4/saved-views
- DELETE /api/v11.4/saved-views/:id
- GET /api/v11.4/health

## اصل تصمیم‌گیری
اول hard-date / overdue، سپس اولویت بالا، سپس Next Action پروژه Active؛ بعد Context، Energy و Duration برای محدودکردن انتخاب‌ها استفاده می‌شوند. نتیجه به‌همراه «دلیل» نمایش داده می‌شود و کاربر تصمیم نهایی را می‌گیرد.
