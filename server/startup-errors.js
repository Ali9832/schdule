const messages={
  AUTH_SECRET_MISSING:'تنظیمات ورود سایت کامل نیست؛ کلید ورود سرور در Vercel تنظیم نشده است.',
  DATABASE_URL_MISSING:'اتصال پایگاه داده برای این استقرار تنظیم نشده است؛ تنظیمات پایگاه داده در Vercel بررسی شود.',
  DATABASE_CONNECTION_FAILED:'اتصال سرور به پایگاه داده برقرار نشد؛ نشانی اتصال و وضعیت پایگاه داده بررسی شود.',
  DATABASE_SCHEMA_FAILED:'آماده‌سازی ساختار پایگاه داده انجام نشد؛ خطای پایگاه داده در لاگ سرور بررسی شود.'
};
export function startupFailure(code,message,cause){return Object.assign(new Error(message,cause?{cause}:undefined),{code});}
export function startupDiagnostic(error){const code=Object.hasOwn(messages,error?.code)?error.code:'APP_STARTUP_FAILED';return {code,error:messages[code]||'اجرای سایت آماده نیست؛ تنظیمات اتصال پایگاه داده و کلید ورود را در ورسل بررسی کنید.'};}
