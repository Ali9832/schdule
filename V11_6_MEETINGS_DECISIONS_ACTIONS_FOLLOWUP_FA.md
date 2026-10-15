# NOVA V11.6 — Meetings → Decisions → Actions → Follow-up

## هدف مرحله
در V11.6 ماژول جلسات از «ثبت گزارش» به یک جریان اجرایی کامل تبدیل شد. جلسه همچنان یک Event canonical است، اما خروجی‌های آن به صورت ساختاریافته در `meeting_details` و متادیتای `NOVA_MEETING` نگهداری می‌شوند.

## جریان اصلی
Prepare → Agenda / Pre-read → Meeting → Decisions → Action Items → Waiting / Follow-up → Next Meeting

## امکانات رابط
- KPIهای جلسات امروز، جلسات پیش‌رو، Actionهای باز، Actionهای عقب‌افتاده، تصمیم‌های باز و Waitingها
- چهار نمای مستقل: فضای جلسات، Action Register، Decision Register و Follow-up
- فرم جلسه با Project، Area، Unit، Organizer، Location، Participants، Agenda، Pre-read و Summary
- تصمیم‌های ساختاریافته با Owner و Status
- Action Item ساختاریافته با Owner، Due Date، Priority، Status و لینک به Task
- Waiting Item با شخص/واحد منتظر، Due Date و وضعیت پیگیری
- Next Meeting و Follow-up Note
- تبدیل Action → Task با یک کلیک
- همگام‌سازی وضعیت Action لینک‌شده با Task در Backend

## APIهای جدید
- `GET /api/v11.6/meetings`
- `POST /api/v11.6/meetings`
- `PUT /api/v11.6/meetings/:id`
- `POST /api/v11.6/meetings/:id/actions/:actionId/task`
- `PATCH /api/v11.6/meetings/:id/actions/:actionId`
- `PATCH /api/v11.6/meetings/:id/decisions/:decisionId`
- `PATCH /api/v11.6/meetings/:id/waiting/:waitingId`
- `GET /api/v11.6/health`

## سازگاری
APIها و قابلیت‌های V10.x تا V11.5 حذف نشده‌اند. تقویم V11.5 همچنان Meeting را همان Event اصلی می‌بیند و V11.6 فقط جزئیات اجرایی آن را عمیق‌تر می‌کند.

## تست پیشنهادی
1. `npm install`
2. `npm run demo`
3. مرورگر: `http://127.0.0.1:3001`
4. وارد «جلسات» شوید.
5. یک جلسه بسازید و برای آن Project/Area تعیین کنید.
6. حداقل یک Decision، یک Action با Owner/Due و یک Waiting ثبت کنید.
7. در Action Register، Action را به Task تبدیل کنید.
8. Task ساخته‌شده را Done کنید و وضعیت Action را بررسی کنید.
9. Decision را تثبیت و Waiting را Resolve کنید.
10. تقویم V11.5 را باز کنید و وجود همان جلسه را در Timeline بررسی کنید.

## بررسی ساخت
- `server/index.js` با `node --check` بررسی شده است.
- تمام اسکریپت‌های inline فایل HTML با `node --check` بررسی شده‌اند.
- Runtime کامل Fastify در محیط ساخت اجرا نشده، چون `node_modules` در بسته کاری حاضر نبود.
