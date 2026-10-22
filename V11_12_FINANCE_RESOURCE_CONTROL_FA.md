# NOVA V11.12 — Finance & Personal Resource Control

## هدف مرحله
تبدیل مالی از یک کارت درآمد/هزینه به یک لایه عملیاتی برای حساب‌ها، بودجه، جریان نقدی، بدهی و تعهدهای مالی. این نسخه عمداً «امتیاز کلی مالی» تولید نمی‌کند.

## قابلیت‌ها
- خلاصه نقدینگی، درآمد/هزینه ماه و جریان نقدی
- حساب‌ها و مانده
- بودجه ماه با مصرف واقعی دسته‌بندی‌شده
- تعهدهای مالی پرداخت/دریافت با موعد
- تبدیل تعهد مالی به Task canonical
- افزودن تعهد مالی به Calendar canonical
- ثبت تراکنش از صفحه مالی
- Debt register و موعد قسط
- خلاصه مالی روی کارت Area در Dashboard

## APIهای V11.12
- GET /api/v11.12/finance
- POST /api/v11.12/transactions
- POST /api/v11.12/budgets
- PATCH /api/v11.12/budgets/:id
- POST /api/v11.12/commitments
- PATCH /api/v11.12/commitments/:id
- POST /api/v11.12/commitments/:id/create-task
- POST /api/v11.12/commitments/:id/create-event
- GET /api/v11.12/health

## ذخیره‌سازی
برای حفظ سازگاری این Release، budgets و commitments در همان finance object داخل user_life_data ذخیره می‌شوند. Migration سنگین جدید عمداً به Final Integration موکول شده است.

## تست دستی
1. npm install
2. npm run demo
3. صفحه «مالی» را باز کن.
4. یک بودجه و یک تعهد مالی بساز.
5. از روی تعهد، Task و Calendar event بساز.
6. یک تراکنش ثبت کن و تغییر Cash Flow و Budget usage را بررسی کن.
7. Refresh کن و ماندگاری داده را بررسی کن.
