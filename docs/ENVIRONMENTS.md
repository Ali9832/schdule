# محیط‌های اجرای NOVA

## Development

- `NODE_ENV=development`
- اجرای محلی با `npm run dev`
- در صورت خالی‌بودن `DATABASE_URL`، برنامه با دادهٔ حافظه‌ای و نمونه اجرا می‌شود.
- این حالت برای توسعه مناسب است؛ داده‌ها با restart سرور ماندگار نمی‌مانند.

## Staging

- `NODE_ENV=staging`
- PostgreSQL جداگانه و `DATABASE_URL` معتبر الزامی است.
- `CLIENT_ORIGIN` باید فقط آدرس رابط staging باشد.
- کلید OpenAI فقط در secret manager یا متغیر محیطی staging قرار می‌گیرد.
- build، migration و تست integration باید پیش از استقرار اجرا شوند.

## Production

- `NODE_ENV=production`
- PostgreSQL پایدار، backup و آزمایش restore الزامی است.
- `.env` نباید به Git وارد شود؛ secretها فقط در سرویس استقرار نگه‌داری می‌شوند.
- `CLIENT_ORIGIN` باید به دامنهٔ HTTPS واقعی محدود شود.
- در نسخهٔ فعلی، fail-fast برای قطع PostgreSQL و احراز هویت هنوز پیاده‌سازی نشده‌اند؛ بنابراین انتشار عمومی پیش از تکمیل فازهای ۲، ۳ و ۱۰ مجاز نیست.

