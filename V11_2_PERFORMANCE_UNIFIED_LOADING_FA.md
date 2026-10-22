# NOVA V11.2 — Performance & Unified Data Loading

این مرحله وابستگی مسیر اولیه داشبورد به `/api/bootstrap` را حذف می‌کند.

## تغییرات اصلی
- endpoint سبک `/api/v11.2/dashboard` برای Now، Attention، Meetings، Active Projects، Areas، Routines و Review.
- endpointهای view-specific برای Today، Areas، Meetings، References، Projects، Outcomes و Resources.
- cache کوتاه‌مدت سمت Client با TTL و deduplication درخواست‌های هم‌زمان.
- Bootstrap قدیمی به‌صورت Lazy فقط برای صفحات سازگاری V10 بارگذاری می‌شود.
- Workspace تسک همچنان از pagination + virtualization مرحله V11.1 استفاده می‌کند.
- صفحه‌های V11 از endpointهای مستقل استفاده می‌کنند و برای تغییر View نیاز به Bootstrap کامل ندارند.
- Dashboard یک نوار کوچک Performance دارد که زمان بارگذاری، حجم Payload، Cache و وضعیت Legacy را نشان می‌دهد.

## مسیرهای جدید
- `GET /api/v11.2/dashboard`
- `GET /api/v11.2/today`
- `GET /api/v11.2/areas`
- `GET /api/v11.2/meetings`
- `GET /api/v11.2/references`
- `GET /api/v11.2/projects`
- `GET /api/v11.2/outcomes`
- `GET /api/v11.2/resources`
- `GET /api/v11.2/health`

## اصل معماری
Dashboard فقط Aggregate و خلاصه‌های لازم را می‌گیرد. جدول Task داده صفحه‌بندی‌شده می‌گیرد. جزئیات قدیمی فقط هنگام ورود به صفحات سازگاری دریافت می‌شوند.
