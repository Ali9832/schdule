import fs from 'node:fs'
let html=fs.readFileSync('index.html','utf8')
function removeBlock(marker,tag='div'){
 const start=html.indexOf(marker);if(start<0)return;
 const tokens=new RegExp(`<\\/?${tag}\\b[^>]*>`,'g');tokens.lastIndex=start;let depth=0;
 for(let match;(match=tokens.exec(html));){depth+=match[0].startsWith('</')?-1:1;if(depth===0){html=html.slice(0,start)+html.slice(tokens.lastIndex);return}}
 throw new Error('Unclosed UI block: '+marker)
}
for(const marker of ['<div class="db-mini">','<div class="db-pills">','<div class="habit-db-state">','<div class="final-release-strip"','<div class="v11-arch-strip"','<div class="v112-data-strip"','<div class="v111-reliability-bar">'])removeBlock(marker)
html=html.replace(/<span id="backendBadge"[\s\S]*?<\/span>/,'')
html=html.replace(/<p id="bank-comparison-summary"[\s\S]*?<\/p>/,'')
html=html.replace(/<a\b[^>]*href="data\/(?:NOVA_[^"]+|master-items\.json)"[^>]*>[\s\S]*?<\/a>(?:\s*•\s*)?/g,'')
const replacements=new Map([
 ['مهسا رضایی','molibden'],['Workspace Owner','فضای شخصی'],
 ['<title>NOVA V11.12.2 — Dashboard + Master Bank</title>','<title>نوا — فضای شخصی molibden</title>'],
 ['رویداد تقویمی canonical؛ در Calendar هم دیده می‌شود','قرارهای ثبت‌شده در تقویم شما'],
 ['People Directory + cadence + آخرین تماس','فهرست افراد و زمان پیگیری ارتباط'],
 ['کنترل منابع شخصی • V11.12','مدیریت منابع شخصی'],
 ['V11.8 • RESOURCE EDITOR','ویرایش منبع'],
 ['V11.7 • OUTCOME EDITOR','ویرایش هدف'],
 ['V11.4 — قواعد شخصی سیستم','تنظیمات شخصی'],
 ['<span class="v111-stage-pill">V11.2</span><b>نمای پنجره‌ای</b><span>فقط ردیف‌های قابل‌دیدن در DOM رندر می‌شوند.</span>','<b>فهرست کارها</b>'],
 ['Routine canonical','روتین روزانه'],['Event canonical','مناسبت‌های تقویم'],
 ['Adherence امروز','پایبندی امروز'],['نه امتیاز معنویت','نسبت انجام به برنامه'],['Task لینک‌شده','کارهای مرتبط'],
 ['Task • Meeting • Deadline • Focus Block • Event در یک خط زمانی، بدون کپی رکوردها.','رویدادها، جلسات و موعدها در یک تقویم'],
 ['Areaها با «استثنا و تعهد» کنترل می‌شوند، نه درصد مصنوعی؛ Projectها به Outcomeهای واقعی لینک می‌شوند.','اهداف، پروژه‌ها و مسئولیت‌های جاری خود را مرور کنید.'],
 ['Theme، ظرفیت، WIP پروژه‌ها و دامنه Must / Should / Could / Won’t برای این چرخه.','موضوع هفته، ظرفیت انجام کارها و اولویت‌های این دوره را مشخص کنید.'],
 ['grid-template-columns:190px 190px 1fr auto','grid-template-columns:190px 190px auto'],
 ['NOVA V11.12.2 • Dashboard + Master Bank • Production Release','نوا • مدیریت زندگی و کار'],
 ['NOVA V11.12.2 • Dashboard + Master Bank','نوا • فضای شخصی'],
 ['ساختار پیشنهادی شما با اصلاحات موضوعی و بافتی ادغام شده است. عنوان‌های اصلی و ویرایش‌های دستی حفظ می‌شوند؛ موارد مبهم با نشان «نیازمند بازبینی دسته‌بندی» مشخص‌اند.','آیتم‌ها را بر اساس موضوع پیدا کنید و عنوان، دسته و وضعیت آن‌ها را مدیریت کنید.'],
 ['ساختار موضوعی تلفیقی؛ برای فیلتر سریع دسته‌ها و آیتم‌ها','برای دیدن آیتم‌های هر حوزه، آن را انتخاب کنید.'],
 ['<div class="kpi"><span>منبع</span><b>فهرست مادر Excel</b></div>','<div class="kpi"><span>انجام‌شده</span><b id="bank-completedCount">—</b></div>'],
 ['خلاصه DB_Habits / DB_Habit_Log','روند انجام روتین‌های روزانه'],
 ['DB_Habits + DB_Habit_Log','عادت‌های روزانه'],
 ['نمای ماتریسی ماهانه با درصد موفقیت هر روز و هر عادت؛ الهام‌گرفته از Habit Tracker و منطبق با طراحی NOVA','انجام روتین‌ها را ثبت کنید و روند روزانه و ماهانهٔ خود را ببینید.'],
 ['در حال دریافت اطلاعات روتین از دیتابیس…','در حال بارگذاری روتین‌ها…'],
 ['پاسخ دیتابیس روتین ناقص است.','اطلاعات روتین‌ها کامل دریافت نشد.'],
 ['اتصال برقرار است؛ هنوز عادتی ثبت نشده است.','هنوز روتینی ثبت نشده است.'],
 ['ارتباط با API ماتریس برقرار نشد؛ داده‌های روتین موجود در Bootstrap به‌صورت پشتیبان نمایش داده شدند.','به‌روزرسانی انجام نشد؛ آخرین اطلاعات موجود نمایش داده می‌شود.'],
 ['داده روتین دریافت نشد. Backend را اجرا کنید یا یک عادت جدید اضافه کنید.','بارگذاری روتین‌ها انجام نشد؛ دوباره تلاش کنید.'],
 ['نمای سبک V11.2 • بدون Bootstrap کامل','خلاصهٔ برنامه و پیشرفت امروز'],
 ['مورد در Backend اصلی','مورد ثبت‌شده'],
 ['جدول عملیاتی V10.2','جدول کارها'],
 ['معنویت، بدون موتور جداگانه','روتین‌های معنوی'],
 ['این صفحه یک نمای تخصصی روی همان Routine canonical است؛ ثبت امروز، هدف هفتگی و یادداشت‌های نیت/حداقل اقدام بدون ایجاد دیتابیس تکراری.','روتین‌های معنوی، هدف هفتگی و یادداشت‌های خود را مدیریت کنید.'],
 ['مناسبت مذهبی = Event، نه ماژول جدا','مناسبت‌های مذهبی'],
 ['مناسبت‌ها در Calendar canonical ذخیره می‌شوند، اما این صفحه متادیتای تخصصی، شمارش روز و آمادگی‌های مرتبط را نشان می‌دهد.','مناسبت‌ها را در تقویم ثبت کنید و برای آن‌ها یادآوری و کارهای آمادگی تعیین کنید.'],
 ['همان Routineهای canonical؛ دیتابیس جدا ساخته نمی‌شود','روتین‌هایی برای مراقبت از سلامت و انرژی'],
 ['یک Task، یک رکورد؛ نمایش در List / Board / Calendar بدون کپی‌کردن داده.','کارهای خود را به‌صورت فهرست، برد یا تقویم مدیریت کنید.'],
 ['رویدادها، جلسات، موعد تسک‌ها، Focus Blockها و نقاط زمانی پروژه‌ها در یک نمای واحد؛ رکورد اصلی فقط یک‌بار ذخیره می‌شود.','رویدادها، جلسات، موعد کارها و زمان‌های تمرکز را در یک تقویم ببینید.'],
 ['خطا در Backend','ذخیره انجام نشد؛ دوباره تلاش کنید.'],
 ['Task نمایشی ایجاد شد؛ برای ذخیره واقعی Backend را اجرا کن.','ذخیرهٔ کار انجام نشد؛ دوباره تلاش کنید.'],
 ['لینک Task داخل HTML شبیه‌سازی شد.','ثبت ارتباط انجام نشد؛ دوباره تلاش کنید.'],
 ['در پروژه واقعی Task canonical ساخته می‌شود.','برای ثبت کار، ابتدا اطلاعات را بارگذاری کنید.'],
])
for(const [from,to] of replacements)html=html.replaceAll(from,to)
removeBlock('<div class="v118-preview-note">')
html=html.replace(/function renderSettingsBase\(\)\{[^\n]+\}/,"function renderSettingsBase(){const root=document.getElementById('settingsPageBody');if(!root)return;root.innerHTML=cardsHtml([{title:'فضای کاری',value:escapeHtml(BASE_DATA?.settings?.workspace_name||'نوا'),sub:'مدیریت برنامه‌های شخصی'},{title:'نام نمایشی',value:escapeHtml(BASE_DATA?.settings?.display_name||'molibden'),sub:'حساب شما'}])}")
// Remove implementation labels from markup; script identifiers and data stay intact.
html=html.split(/(<script\b[^>]*>[\s\S]*?<\/script>)/g).map(part=>part.startsWith('<script')?part:part
 .replace(/<div class="(?:v\d+-kicker|eyebrow)">(?:<span class="dot"><\/span>)?V\d[^<]*<\/div>/g,'')
 .replace(/V\d+(?:\.\d+)*\s*[•/]\s*/g,'')
 .replace(/<div class="v117-info-note">[\s\S]*?<\/div>/g,'')) .join('')
for(const [,script] of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))new Function(script)
fs.writeFileSync('index.html',html)
let server=fs.readFileSync('server/index.js','utf8').replaceAll("display_name: 'مهسا رضایی'","display_name: 'molibden'").replace("display_name: 'کاربر NOVA'","display_name: 'molibden'")
fs.writeFileSync('server/index.js',server)
console.log('Removed diagnostic panels, comparison/download links and placeholder identity; simplified product copy.')
