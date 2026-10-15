# NOVA V11.3 — Review, Planning Cycles & Portfolio Control

این مرحله پس از V11.2 روی «کنترل تعهد، ظرفیت و بازنگری» تمرکز دارد.

## قابلیت‌های اضافه‌شده

- Weekly Cycle واقعی با Theme / Outcome هفته
- ظرفیت هفتگی بر حسب ساعت
- WIP Limit قابل تنظیم برای پروژه‌های Active
- دامنه MoSCoW: Must / Should / Could / Won’t this cycle
- کنترل پورتفولیو با وضعیت‌های Active / Incubating / Someday / Archived
- تشخیص پروژه‌های Stale و پروژه‌های بدون Next Action
- Review Snapshot شامل Inbox، Waiting، Overdue، Meeting Actions و Routine Attention
- Reviewهای Daily / Weekly / Monthly / Seasonal
- تاریخچه Review
- ذخیره Cycle و Review در `user_life_data.execution.planning`
- APIهای سبک جدید `/api/v11.3/*`

## APIهای مرحله

- `GET /api/v11.3/planning`
- `PUT /api/v11.3/cycle`
- `POST /api/v11.3/reviews`
- `GET /api/v11.3/health`

## سناریوی تست

1. پروژه را اجرا کنید: `npm install` سپس `npm run demo`.
2. وارد «چرخه / برنامه هفتگی» شوید.
3. Theme، ظرفیت، WIP Limit و Must/Should/Could/Won’t را ثبت کنید.
4. Lifecycle یک پروژه را بین Active / Incubating / Someday / Archived جابه‌جا کنید.
5. وارد «مرور و گزارش‌ها» شوید.
6. Snapshot را مرور و یک Weekly Review ثبت کنید.
7. صفحه را Refresh کنید و ماندگاری Cycle/Review را بررسی کنید.

## نکته معماری

عدد WIP Limit یک قانون ثابت علمی نیست و عمداً قابل تنظیم است. هدف آن کنترل تعداد پروژه‌های هم‌زمان Active بر اساس ظرفیت واقعی کاربر است.
