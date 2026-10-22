# چک‌لیست UAT نهایی — NOVA V11.12 Final

این چک‌لیست برای تست دستی نسخه نهایی روی مرورگر و سیستم واقعی است. هر مورد را با ✅ Pass، ❌ Fail یا ⚠️ Needs Fix علامت بزن.

## 1) شروع و سلامت سیستم
- [ ] `npm run demo` بدون خطای بحرانی اجرا می‌شود.
- [ ] صفحه اصلی در `http://127.0.0.1:3001` باز می‌شود.
- [ ] `/api/health` و `/api/release` پاسخ صحیح Final می‌دهند.
- [ ] Refresh صفحه باعث صفحه سفید یا از دست رفتن مسیر نمی‌شود.

## 2) Dashboard / Attention
- [ ] Quick Capture یک آیتم جدید ثبت می‌کند.
- [ ] Now/Today اطلاعات اصلی را نمایش می‌دهد.
- [ ] Attention Needed موارد overdue/blocked/waiting را نشان می‌دهد.
- [ ] کارت‌های Areas باز و بسته می‌شوند و وضعیت آن‌ها حفظ می‌شود.
- [ ] Dashboard بدون لرزش محسوس پس از تغییر checkbox/update باقی می‌ماند.

## 3) Tasks / Execution
- [ ] ایجاد Task جدید موفق است.
- [ ] ویرایش Status/Priority/Project/Area/Context/Energy/Duration ذخیره می‌شود.
- [ ] تکمیل Task بدون reload کامل صفحه انجام می‌شود.
- [ ] فیلترها و Saved Viewها درست عمل می‌کنند.
- [ ] Waiting/Delegated آیتم‌های مرتبط را درست نشان می‌دهد.
- [ ] Focus Mode شروع/توقف می‌شود.
- [ ] Ready-to-Resume پس از پایان Focus ذخیره و بازیابی می‌شود.

## 4) Projects / Goals / Areas
- [ ] Project بین Active/Incubating/Someday/Archived جابه‌جا می‌شود.
- [ ] Project به Outcome متصل می‌شود.
- [ ] Next Action Coverage به‌درستی تغییر می‌کند.
- [ ] Area به‌جای درصد مبهم، وضعیت و دلایل عملیاتی نشان می‌دهد.

## 5) Calendar / Scheduling
- [ ] نماهای Today/Week/Month/Timeline باز می‌شوند.
- [ ] Task به Time Block تبدیل می‌شود.
- [ ] Event جدید ثبت می‌شود.
- [ ] Conflict Detection در همپوشانی زمانی هشدار می‌دهد.

## 6) Meetings
- [ ] Meeting جدید ثبت می‌شود.
- [ ] Agenda، Notes، Decisions و Actions ذخیره می‌شوند.
- [ ] Action جلسه به Task تبدیل می‌شود.
- [ ] Owner و Due Date Action حفظ می‌شوند.
- [ ] Waiting/Follow-up جلسه در Dashboard/Meeting workspace دیده می‌شود.

## 7) Routines / Habits
- [ ] Habit Matrix بارگذاری می‌شود.
- [ ] تیک روزانه بدون reload کل صفحه اعمال می‌شود.
- [ ] درصد روز و ردیف پس از تغییر به‌روز می‌شود.
- [ ] اسکرول مشترک chart/matrix درست باقی می‌ماند.

## 8) Knowledge / Learning
- [ ] Resource جدید ثبت می‌شود.
- [ ] Resource به Learning Project تبدیل می‌شود.
- [ ] Resource به Task و Outcome متصل می‌شود.
- [ ] Archive باعث حذف دائمی داده نمی‌شود.

## 9) Health / Energy
- [ ] Check-in روزانه ثبت می‌شود.
- [ ] Metric سفارشی و Log آن ثبت می‌شود.
- [ ] Energy-aware recommendations با تغییر Energy به‌روزرسانی می‌شوند.
- [ ] Appointment وارد Calendar می‌شود.

## 10) Relationships
- [ ] Person جدید ثبت می‌شود.
- [ ] Touch/Contact تاریخ آخرین ارتباط را به‌روز می‌کند.
- [ ] Commitment جدید ثبت می‌شود.
- [ ] Commitment به Task تبدیل می‌شود.
- [ ] Important Date وارد Calendar می‌شود.

## 11) Spiritual / Religious
- [ ] Routine معنوی در موتور Routine و نمای اختصاصی دیده می‌شود.
- [ ] Religious Event در Calendar نیز دیده می‌شود.
- [ ] Preparation Task از مناسبت ساخته می‌شود.

## 12) Finance
- [ ] Transaction درآمد/هزینه ثبت می‌شود.
- [ ] Budget ثبت و مصرف آن نمایش داده می‌شود.
- [ ] Financial Commitment ثبت می‌شود.
- [ ] Commitment به Task و Calendar Event تبدیل می‌شود.
- [ ] خلاصه Cash Flow و تعهدهای باز صحیح تغییر می‌کند.

## 13) Offline / PWA
- [ ] manifest و Service Worker بدون خطای Console ثبت می‌شوند.
- [ ] پس از یک بار بارگذاری، shell سایت در حالت offline قابل باز شدن است.
- [ ] Mutation آفلاین در outbox صف می‌شود.
- [ ] پس از برگشت اینترنت، صف sync می‌شود یا خطای قابل‌فهم نمایش داده می‌شود.

## 14) UI / Accessibility / Regression
- [ ] Dark Mode درست عمل می‌کند.
- [ ] Sidebar collapse و Command Palette کار می‌کنند.
- [ ] Ctrl/Cmd+K باز می‌شود.
- [ ] در اندازه Desktop هیچ overlap اصلی وجود ندارد.
- [ ] در موبایل/عرض کم، محتوای اصلی قابل استفاده است.
- [ ] رنگ‌های خطا/هشدار/موفقیت معنی ثابت دارند.
- [ ] خطای Console بحرانی مشاهده نمی‌شود.

## معیار پذیرش نهایی
- هیچ Fail بحرانی در ایجاد/ویرایش/ذخیره داده وجود نداشته باشد.
- هیچ صفحه اصلی سفید یا غیرقابل‌استفاده نباشد.
- Routeهای اصلی 2xx باشند.
- خطاهای جزئی UI می‌توانند در Patch Release بعدی اصلاح شوند.
