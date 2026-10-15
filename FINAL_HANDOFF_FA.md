# تحویل نهایی NOVA V11.12 Final

## اجرای استاندارد
```powershell
npm install
npm run qa
npm run demo
```

در PowerShell دوم:
```powershell
npm run smoke
```

## وضعیت فعلی
Smoke Test روی سیستم مقصد با موفقیت کامل انجام شده است. ساختار پروژه از RC1 به Final تغییر معماری نکرده و فقط بسته‌بندی/برند Release نهایی شده است.

## مرحله باقی‌مانده برای کاربر
اجرای چک‌لیست `FINAL_UAT_CHECKLIST_FA.md`. در صورت شکست یک سناریو، مورد را به‌عنوان Bug Report با نام صفحه، عملیات، نتیجه مورد انتظار، نتیجه واقعی و متن Console ثبت کن.
