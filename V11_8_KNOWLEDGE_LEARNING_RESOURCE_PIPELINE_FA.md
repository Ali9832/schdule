# NOVA V11.8 — Knowledge, Learning & Resource Pipeline

## هدف
جدا کردن «چیزهای جالب برای یادگیری» از «تعهدهای اجرایی». هر ورودی ابتدا Resource است و فقط با تصمیم صریح به Project، Task یا Outcome متصل می‌شود.

## جریان
Capture → Backlog → Learning Active → Notes/Synthesis → Applied → Archive

## قابلیت‌ها
- Capture سریع برای کتاب، دوره، مقاله، پژوهش، ویدئو، پادکست، ایده، سؤال، ابزار و یادداشت.
- Pipeline Board + Active Learning + Attention + Library.
- Progress، Next Action، Key Takeaways، Learning Output، Rating و تاریخ مرور.
- تبدیل یک‌کلیکی Resource به Learning Project.
- ساخت Task از Resource بدون کپی‌کردن منبع.
- اتصال Resource به Outcome با Entity Link.
- Attention Rule شفاف: Active بدون Next Action، منبع فعال Stale، Synthesis بدون خروجی و منبع نیمه‌تمام بدون Takeaway.
- Archive بدون حذف.

## APIهای جدید
- GET /api/v11.8/learning
- POST /api/v11.8/resources
- PATCH /api/v11.8/resources/:id
- POST /api/v11.8/resources/:id/promote-project
- POST /api/v11.8/resources/:id/create-action
- POST /api/v11.8/resources/:id/outcomes/:outcomeId
- POST /api/v11.8/resources/:id/archive
- GET /api/v11.8/health

## Migration
`server/migrations/013_resource_learning_pipeline.sql`

## سناریوی تست
1. صفحه «دانش / یادگیری» را باز کن.
2. Capture سریع بساز و آن را در Backlog قرار بده.
3. Resource را باز کن، Next Action و Progress بده و به Active منتقل کن.
4. از همان پنل Learning Project بساز؛ Project باید لینک شود.
5. یک Task از Resource بساز.
6. Resource را به Outcome متصل کن.
7. Key Takeaways و Learning Output را ثبت کن و به Applied ببر.
8. Archive کن؛ رکورد حذف نمی‌شود.

## نکته سازگاری
V11.8 روی موجودیت `resources` و `entity_links` نسخه V11 سوار شده و Endpointهای نسخه‌های قبل حفظ شده‌اند.
