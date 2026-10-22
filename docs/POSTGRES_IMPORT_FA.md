# انتقال داده‌های محلی NOVA به PostgreSQL

## روش پیشنهادی

داده‌ها را یک‌بار به یک حساب تازهٔ NOVA در PostgreSQL منتقل کنید. اسکریپت شناسه‌ها را حفظ می‌کند و پروژه، تسک، رویداد، هدف، عادت و لاگ‌های آن، منابع، سلامت، روابط، جلسات و جزئیات معنوی/مذهبی را در جداول واقعی برنامه می‌نویسد. مالی، برنامهٔ هفتگی، یادداشت‌ها، مرور، تمرکز و تنظیمات در جداول JSONB کاربر منتقل می‌شوند.

این انتقال یک‌باره است؛ همگام‌سازی خودکار و دائمی بین نسخهٔ محلی و سرور نیست. پس از انتقال، نسخهٔ متصل به PostgreSQL را منبع اصلی داده در نظر بگیرید.

برای بانک پایهٔ ۳٬۲۴۸ آیتم، فایل `public/data/master-items.json` همراه پروژه روی سرور منتشر می‌شود. اسکریپت یک نسخهٔ کامل بانک و snapshot اصلی را نیز در جدول خصوصی `nova_local_imports` نگه می‌دارد، ولی آیتم‌های بانک را به تسک تبدیل نمی‌کند. برنامه فعلاً بانک پایه را از فایل می‌خواند؛ این جدول نسخهٔ بازیابی است.

## پیش از انتقال

- از PostgreSQL مقصد پشتیبان بگیرید؛ برای نمونه با `pg_dump -Fc -f nova-before-import.dump` و پارامترهای اتصال معمول سرورتان. فایل را خارج از مسیر عمومی وب نگه دارید.
- تغییر داده در نسخهٔ محلی و نسخهٔ سرور را تا پایان انتقال متوقف کنید. فایل محلی به شکل اتمی نوشته می‌شود؛ برای نسخهٔ ثابت انتقال از حالت export استفاده کنید.
- Node.js و وابستگی‌های همین پروژه باید موجود باشند (`npm ci`؛ در PowerShell ویندوز `npm.cmd ci`).
- مقصد باید دیتابیس NOVA با همین ساختار باشد. برای ساخت دیتابیس تازه، خود دیتابیس را در PostgreSQL ایجاد کنید؛ `--init-schema` فقط جدول‌های برنامه را می‌سازد.
- بهتر است یک حساب تازه با `--create-user` بسازید. اگر حساب موجود داده داشته باشد، اسکریپت متوقف می‌شود و داده‌ای جایگزین نمی‌کند. برای ادغام با حساب دارای داده، باید قواعد ادغام جداگانه تعیین شوند.

## ۱. بررسی و ساخت بستهٔ انتقال

**راه ساده در ویندوز:** از داخل پوشهٔ پروژه، `powershell -NoProfile -ExecutionPolicy Bypass -File .\IMPORT_POSTGRES.ps1` را اجرا کنید. این راهنما ایمیل، URL دیتابیس و رمز حساب جدید را می‌پرسد، ابتدا dry-run می‌کند و فقط پس از تایپ `IMPORT` ایمپورت نهایی می‌کند. برای فایل منتقل‌شده به رایانهٔ دیگر، `-Source .local\nova-transfer.json` را اضافه کنید. اگر تغییرات مرورگر را هم می‌خواهید، ابتدا بسته را مطابق بخش آخر راهنما بسازید و همان فایل را به `-Source` بدهید.

در پوشهٔ پروژه اجرا کنید:

```powershell
node scripts/import-local-to-postgres.mjs
node scripts/import-local-to-postgres.mjs --export .local/nova-transfer.json
```

دستور اول هیچ اتصال یا تغییری در دیتابیس ندارد و فقط تعداد رکوردها و صحت ارتباط‌ها را بررسی می‌کند. دستور دوم بستهٔ شخصی انتقال را می‌سازد؛ فایل موجود را بازنویسی نمی‌کند. `.local/nova-transfer.json` را همراه پروژه یا به‌صورت جدا و امن به سرور انتقال دهید. داده‌های شخصی در ZIP عمومی پروژه نیستند.

## ۲. اتصال و رمز حساب

در PowerShell، اتصال و رمز را بدون نوشتن رمز در فرمان وارد کنید:

```powershell
$dbSecret = Read-Host 'PostgreSQL connection URL' -AsSecureString
$env:NOVA_IMPORT_DATABASE_URL = [System.Net.NetworkCredential]::new('', $dbSecret).Password
$accountSecret = Read-Host 'Password for the new NOVA account (8+ characters)' -AsSecureString
$env:NOVA_IMPORT_PASSWORD = [System.Net.NetworkCredential]::new('', $accountSecret).Password
```

شکل URL: `postgresql://USER:PASSWORD@HOST:5432/DATABASE`. اگر نام یا رمز شامل کاراکتر خاص باشد، باید در URL کدگذاری شود. TLS را مطابق تنظیمات میزبان دیتابیس در URL/محیط اتصال تنظیم کنید؛ اسکریپت اعتبارسنجی گواهی را خاموش نمی‌کند. اطلاعات اتصال را در چت یا فایل عمومی قرار ندهید.

روی لینوکس:

```bash
read -rsp 'PostgreSQL URL: ' NOVA_IMPORT_DATABASE_URL; echo
export NOVA_IMPORT_DATABASE_URL
read -rsp 'New NOVA account password: ' NOVA_IMPORT_PASSWORD; echo
export NOVA_IMPORT_PASSWORD
```

## ۳. اجرای آزمایشی روی دیتابیس

ایمیل نمونه را با ایمیل حساب مقصد خود جایگزین کنید:

```powershell
node scripts/import-local-to-postgres.mjs --source .local/nova-transfer.json --email you@example.com --create-user --init-schema --dry-run
```

تمام درج‌ها و شمارش‌ها واقعاً در یک تراکنش اجرا می‌شوند، سپس ROLLBACK می‌شوند. حساب ساخته‌شده و حتی جدول‌های تازه نیز باقی نمی‌مانند. پیام `DRY RUN PASSED` باید دیده شود. اگر ساختار قبلاً موجود است، `--init-schema` لازم نیست؛ اگر حساب خالی را قبلاً ساخته‌اید، `--create-user` لازم نیست.

## ۴. ایمپورت نهایی

```powershell
node scripts/import-local-to-postgres.mjs --source .local/nova-transfer.json --email you@example.com --create-user --init-schema --apply
```

فقط در صورت موفقیت همهٔ درج‌ها و برابر بودن شمارش رکوردها، COMMIT انجام می‌شود. خطای UUID، ارتباط ناقص، تداخل شناسه یا حساب دارای داده باعث بازگشت کامل تراکنش می‌شود. اجرای مجدد همین بسته برای همین حساب با رسید SHA-256 تشخیص داده می‌شود و اطلاعات سرور را بازنویسی نمی‌کند. بستهٔ متفاوت نیز روی حساب دارای داده خودکار ادغام نمی‌شود.

پس از انتقال، `DATABASE_URL` برنامهٔ روی سرور را برای همین دیتابیس و `AUTH_SECRET` را با یک مقدار ثابت امن تنظیم کنید؛ برنامه را اجرا کنید و با ایمیل/رمز حساب مقصد وارد شوید. شناسه‌های قبلی حفظ شده‌اند، بنابراین اتصال تسک‌ها، پروژه‌ها و سایر بخش‌ها برقرار می‌ماند.

بعد از کار، متغیرهای موقت را پاک کنید:

```powershell
Remove-Item Env:NOVA_IMPORT_DATABASE_URL, Env:NOVA_IMPORT_PASSWORD
```

لینوکس: `unset NOVA_IMPORT_DATABASE_URL NOVA_IMPORT_PASSWORD`.

## تغییرات بانک که در مرورگر ذخیره‌اند

فایل `.local/memory-3001.json` شامل localStorage مرورگر نیست. برای انتقال تیک، عنوان، یادداشت و حذف‌های مستقل بانک، در همان مرورگری که تغییرات را انجام داده‌اید، صفحهٔ NOVA را باز کنید و در Console اجرا کنید:

```javascript
const edits = localStorage.getItem('nova-master-items-edits-v1') || '{}';
const url = URL.createObjectURL(new Blob([edits], { type: 'application/json' }));
const a = document.createElement('a');
a.href = url; a.download = 'nova-bank-edits.json'; a.click();
setTimeout(() => URL.revokeObjectURL(url), 1000);
```

هنگام ساخت بسته، فایل دانلودشده را اضافه کنید:

```powershell
node scripts/import-local-to-postgres.mjs --bank-edits 'C:\path\nova-bank-edits.json' --export .local/nova-transfer-with-edits.json
```

در دو دستور dry-run و apply از همین بستهٔ جدید استفاده کنید. اسکریپت تغییرات مرورگر را داخل نسخهٔ بازیابی دیتابیس نگه می‌دارد. **رابط بانک فعلی هنوز تغییرات مستقل را از localStorage می‌خواند؛ درج نسخهٔ بازیابی در دیتابیس، آن‌ها را خودکار روی دستگاه دیگر نمایش نمی‌دهد.** برای نمایش روی دامنهٔ جدید، در Console همان دامنه اجرا کنید و فایل `nova-bank-edits.json` را انتخاب کنید:

```javascript
const picker = document.createElement('input');
picker.type = 'file'; picker.accept = '.json';
picker.onchange = async () => {
  const value = JSON.parse(await picker.files[0].text());
  if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error('Invalid bank edits');
  const previous = JSON.parse(localStorage.getItem('nova-master-items-edits-v1') || '{}');
  localStorage.setItem('nova-master-items-edits-backup', JSON.stringify(previous));
  localStorage.setItem('nova-master-items-edits-v1', JSON.stringify({ ...value, ...previous }));
  location.reload();
};
picker.click();
```

در تداخل شناسه، تغییر موجود مرورگر مقصد حفظ می‌شود. برای ذخیره و همگام‌سازی خودکار بانک در PostgreSQL، باید مسیرهای API و خواندن/نوشتن بانک در رابط نیز تغییر کنند؛ این اسکریپت انتقال یک‌باره چنین تغییری نمی‌دهد.

## اعتبارسنجی

بررسی آفلاین نگاشت داده و آزمون‌های اسکریپت با `node scripts/check-postgres-import.mjs` انجام می‌شود. اتصال واقعی به PostgreSQL شما هنوز اجرا نشده است؛ dry-run روی مقصد، ساختار و محدودیت‌های واقعی آن را بررسی می‌کند. ابزار اتصال نیازی به psql یا pgAdmin ندارد و از وابستگی `pg` همین پروژه استفاده می‌کند.

پشتیبان‌گیری: [مستندات pg_dump](https://www.postgresql.org/docs/18/app-pgdump.html). رفتار تراکنش: [مستندات PostgreSQL](https://www.postgresql.org/docs/current/tutorial-transactions.html).
