# NOVA V10.1 — Attention Architecture

این مرحله مستقیماً از گزارش پژوهش Deep Research استخراج شده است.

## تغییرات اجرایی
- بازچینی Dashboard بر اساس Now → Attention → Active Projects → Areas → Routines → Review.
- Quick Capture / Inbox با حداقل فیلد (عنوان) و ذخیره در Tasks با دسته Inbox.
- حذف «درصد کلی زندگی» از لایه تصمیم‌گیری اصلی و انتقال تحلیل‌های قدیمی به حالت اختیاری.
- نمایش سه اقدام بعدی، تعهد فعلی، انرژی، کار باز امروز.
- Attention Needed برای overdue / high priority / پروژه بدون next action.
- خلاصه جلسات و جلسه بعدی.
- کارت پروژه‌های فعال با next action.
- Life Areas به صورت collapsed و با شاخص‌های معنی‌دار، نه یک درصد کلی مبهم.
- خلاصه روتین‌ها.
- Review & Analytics به صورت collapsed.
- رنگ‌ها معنایی‌تر شده‌اند.
- وضعیت باز/بسته Area و Review در localStorage باقی می‌ماند.

## Backend
در V10.1 بازنویسی Backend انجام نشده است. Quick Capture از API اصلی Tasks استفاده می‌کند. این مطابق roadmap پژوهش است.

## مرحله بعد
V10.2 — Execution System: Context، Energy، Duration، Waiting/Delegated، Focus Mode، Ready-to-Resume و Meeting Action → Task.
