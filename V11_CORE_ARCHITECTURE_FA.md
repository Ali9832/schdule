# NOVA V11 — Core / Canonical Architecture

این نسخه مرحله سوم نقشه راه پژوهش است و هدفش جداکردن «مدل داده» از «صفحه‌های UI» است. در V11 یک Task، Project، Area، Outcome، Routine، Event/Meeting و Resource موجودیت مستقل است و صفحات مختلف فقط Viewهای متفاوتی از همان داده هستند.

## تغییرات اصلی

- جدول‌های canonical جدید در PostgreSQL: `areas`, `outcomes`, `routines`, `routine_logs`, `resources`, `meeting_details`, `entity_links`.
- ستون‌های canonical برای `tasks`, `projects`, `planner_events` اضافه شده‌اند.
- فایل migration مستقل: `server/migrations/011_canonical_entities.sql`.
- API جدید `/api/v11/bootstrap` برای دریافت مدل لینک‌شده و `/api/v11/dashboard` برای خلاصه مدیریتی.
- CRUD پایه برای Area، Resource و Entity Link.
- ویرایش metadata canonical برای Task و Project.
- Linked Inspector: انتخاب یک رکورد بدون خروج از View، همراه با Propertyها و رکوردهای مرتبط.
- Task Views: یک دیتاست با سه View مجزا: List / Board / Calendar.
- Project Portfolio: Active / Incubating / Someday-Explore / Archived.
- صفحات جدید: Areas، Knowledge/Resources و Archive.
- Goals در UI V11 به‌صورت Outcomeهای لینک‌شده نمایش داده می‌شوند.
- سازگاری با endpointهای V10.2 حفظ شده تا مهاجرت تدریجی باشد.

## مدل رابطه‌ای پیشنهادی

`Task -> Project -> Area`

`Task -> Meeting (source)`

`Project -> Area`

`Outcome -> Area`

`Routine -> Area`

`Meeting/Event -> Project / Area`

`Resource -> Area`

`EntityLink` برای رابطه‌های اضافی که در FKهای اصلی جا نمی‌گیرند.

## اجرای محلی

```bash
npm install
npm run demo
```

سپس:

```text
http://127.0.0.1:3001
```

بدون PostgreSQL، پروژه در حالت Memory Demo اجرا می‌شود. با PostgreSQL، `server/schema.sql` هنگام startup اجرا می‌شود و migrationهای V11 نیز در همان schema لحاظ شده‌اند.

## سناریوی تست پیشنهادی

1. وارد `کارها / Views` شوید و بین List / Board / Calendar جابه‌جا شوید.
2. روی یک Task کلیک کنید؛ Linked Inspector باید بدون ترک صفحه باز شود.
3. روی Project یا Area لینک‌شده در Inspector کلیک کنید.
4. وارد `حوزه‌ها / Areas` شوید و تعداد Task / Project / Outcome / Routine هر حوزه را ببینید.
5. وارد `دانش / منابع` شوید و یک Resource جدید ثبت کنید.
6. در صفحه Projects، lifecycle پروژه را از Inspector به Active / Incubating / Someday / Archived تغییر دهید.
7. Dashboard باید KPIهای Next Action Coverage، Stale Projects، Areaها و Resource Backlog را نشان دهد.

## وضعیت تست این بسته

- `server/index.js` با `node --check` بررسی شده است.
- هر دو بلوک JavaScript داخل `index.html` با `node --check` بررسی شده‌اند.
- نصب dependencyها در محیط ساخت به‌صورت offline ممکن نبود، بنابراین اجرای کامل Fastify در این محیط انجام نشده است. برای Runtime Test روی سیستم مقصد `npm install` اجرا شود.
