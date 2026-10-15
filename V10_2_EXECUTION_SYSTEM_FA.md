# NOVA V10.2 — Execution System

این مرحله بر اساس خروجی Research Report بعد از V10.1 پیاده‌سازی شده است. هدف V10.2 این است که NOVA از «تشخیص اینکه چه چیزی مهم است» به «انتخاب و اجرای اقدام مناسب در Context فعلی» برسد.

## قابلیت‌های اضافه‌شده

- Context برای هر تسک: کامپیوتر، تلفن، جلسه، بیرون، خانه، دانشگاه، فکر عمیق
- Energy برای هر تسک: بالا، متوسط، پایین
- Duration از همان estimate_minutes تسک
- Waiting / Delegated به‌عنوان View مستقل و قابل ویرایش
- Focus Mode با انتخاب تسک، زمان برنامه‌ریزی‌شده و تایمر زنده
- Ready-to-Resume هنگام پایان یا تغییر Context:
  - چه چیزی تمام شد؟
  - وقتی برگشتم از کجا ادامه بدهم؟
  - Blocked / Waiting for
- ذخیره تاریخچه جلسات Focus
- پیشنهاد سه اقدام بعدی با فیلتر Context و Energy در Dashboard
- نمایش تعداد Waiting و Actionهای باز جلسه در Dashboard
- Task Table ارتقایافته با ستون‌های Project / Area / Context / Energy / Duration / Due / Waiting on
- Meetings ارتقایافته با Agenda / Decisions / Action Items
- تبدیل هر Action Item جلسه به Task با یک کلیک

## Backend

بدون تغییر جدول PostgreSQL اصلی، متادیتای اجرایی V10.2 داخل user_life_data JSONB در کلید execution ذخیره می‌شود:

- execution.task_meta
- execution.current_focus
- execution.focus_sessions

APIهای جدید:

- GET /api/execution
- PATCH /api/execution/tasks/:id
- POST /api/execution/focus/start
- POST /api/execution/focus/stop

این انتخاب برای V10.2 عمدی است تا مرحله Execution System بدون مهاجرت سنگین دیتابیس قابل تست باشد. نرمال‌سازی نهایی موجودیت‌ها برای V11 باقی می‌ماند.

## تست محلی

```bash
npm install
npm run demo
```

سپس:

```text
http://127.0.0.1:3001
```

## سناریوی تست پیشنهادی

1. وارد سربرگ «تسک‌ها» شو.
2. برای یک تسک Context و Energy انتخاب کن.
3. در Waiting on نام یک فرد/واحد را وارد کن؛ تسک باید در سربرگ «در انتظار / واگذارشده» ظاهر شود.
4. روی دکمه ▶ همان تسک کلیک کن.
5. Focus را شروع کن و سپس «پایان / تغییر Context» را بزن.
6. Resume here و Blocked را ثبت کن؛ بار بعدی بازکردن همان تسک در Focus، نقطه بازگشت نمایش داده می‌شود.
7. در جلسات چند Action Item خط‌به‌خط ثبت کن و از جدول با دکمه + Task آن‌ها را به تسک تبدیل کن.

## وضعیت Roadmap

- Stage 0 — Research & Architecture: تکمیل
- Stage 1 — V10.1 Attention Architecture: تکمیل
- Stage 2 — V10.2 Execution System: این نسخه
- Stage 3 — V11 Core Architecture: مرحله بعد
