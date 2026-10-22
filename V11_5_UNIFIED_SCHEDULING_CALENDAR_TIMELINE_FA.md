# NOVA V11.5 — Unified Scheduling / Calendar / Timeline

این مرحله لایه زمانی NOVA را یکپارچه می‌کند. هدف این است که Task، Meeting، Focus Block، Deadline و Event در یک خط زمانی دیده شوند بدون اینکه رکوردها در چند ماژول کپی شوند.

## قابلیت‌های اصلی
- صفحه جدید «تقویم / Timeline» با چهار نمای امروز، هفته، ماه و Timeline
- API سبک `/api/v11.5/schedule?from=YYYY-MM-DD&to=YYYY-MM-DD`
- ترکیب رویدادهای واقعی با Deadline تسک‌ها، پروژه‌ها و Outcomes
- تشخیص تداخل زمانی برای رویدادهای ساعت‌دار
- نمایش تسک‌های بدون زمان مشخص در پنل Unscheduled
- Time-block کردن Task با `POST /api/v11.5/schedule/task/:id` بدون ساخت Task دوم
- ثبت Event/Meeting/Religious/Appointment/Review/Focus از صفحه تقویم
- خلاصه زمان‌بندی روی Dashboard اصلی

## تست پیشنهادی
1. `npm install`
2. `npm run demo`
3. مرورگر: `http://127.0.0.1:3001`
4. از منو «تقویم / Timeline» را باز کنید.
5. بین Today / Week / Month / Timeline جابه‌جا شوید.
6. یک رویداد جدید ثبت کنید و بررسی کنید که در نمای هفته و Timeline دیده شود.
7. یک Task بدون موعد را از ستون «بدون زمان مشخص» Time-block کنید.

## APIهای جدید
- `GET /api/v11.5/schedule`
- `POST /api/v11.5/schedule/events`
- `POST /api/v11.5/schedule/task/:id`
- `GET /api/v11.5/health`

## سازگاری
V11.5 بر روی V11.4 ساخته شده و APIهای V10/V11 قبلی حذف نشده‌اند. Event typeهای `religious`، `appointment` و `deadline` نیز به مدل رویداد افزوده شده‌اند.
