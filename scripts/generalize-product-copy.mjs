import fs from 'node:fs'
import {createRequire} from 'node:module'
import assert from 'node:assert/strict'
const require=createRequire(import.meta.url),{parse}=require('@babel/parser')
const words={
 'NOW / TODAY':'اکنون و امروز','DECISION SUPPORT':'انتخاب قدم بعدی','ACTIVE PROJECTS':'برنامه‌های در جریان','CONTROL CENTER':'بخش‌های زندگی و کار','DEPENDENCIES / COMMITMENTS':'پیگیری کارها و قول‌ها','QUIET STORAGE':'بایگانی',
 'Current':'مقدار فعلی','Target':'هدف تعیین‌شده','Unit':'واحد','Linked Inspector':'جزئیات مورد','Linked records':'موارد مرتبط','Linked':'مرتبط','Inspector':'جزئیات',
 'Stale':'بی‌حرکت','Score':'اهمیت','Dashboard':'نمای کلی','Register':'فهرست','Agenda':'موضوع جلسه','Pre-read':'مطالعهٔ قبل از جلسه','Items':'موارد','Conflict':'تداخل زمانی',
 'People Directory':'فهرست افراد','Commitment':'تعهد','others':'دیگران','person':'فرد','Exception view':'موارد نیازمند پیگیری','Notes':'یادداشت‌ها','Archive':'بایگانی','Pipeline':'مسیر یادگیری','Library':'کتابخانه',
 'this cycle':'این دوره','Limit':'حداکثر هم‌زمان','Coverage':'پوشش','Next':'قدم بعدی','Snapshot':'خلاصهٔ دوره','Stop':'کنار بگذارم','Continue':'ادامه بدهم','Properties':'مشخصات','Summary':'خلاصه',
 'Next Action':'قدم بعدی','Follow-up':'پیگیری','Followup':'پیگیری','Ready to Resume':'یادداشت ادامهٔ کار','Resume here':'از اینجا ادامه بده',
 'FOCUS MODE / EXECUTION':'زمان تمرکز','Waiting / Delegated':'در انتظار پاسخ / واگذارشده',
 'Today / Week / Month / Timeline':'روزانه، هفتگی و ماهانه','Won’t':'فعلاً انجام نمی‌دهم',"Won\u0027t":'فعلاً انجام نمی‌دهم',
 'Learning Project':'برنامهٔ یادگیری','Decision Support':'پیشنهاد برای قدم بعدی','Life Areas':'حوزه‌های زندگی',
 'Review & Analytics':'مرور و گزارش‌ها','Attention + Meetings':'پیگیری‌ها و جلسات','Active Projects':'برنامه‌های در جریان',
 'Now / Today':'اکنون و امروز','OUTCOME EDITOR':'ویرایش هدف','RESOURCE EDITOR':'ویرایش منبع','MEETING WORKSPACE':'برنامهٔ جلسه',
 'Task':'کار','Tasks':'کارها','Project':'پروژه','Projects':'پروژه‌ها','Outcome':'هدف','Outcomes':'هدف‌ها','Area':'حوزه','Areas':'حوزه‌ها',
 'Resource':'منبع','Resources':'منابع','Routine':'روتین','Routines':'روتین‌ها','Event':'رویداد','Events':'رویدادها','Meeting':'جلسه','Meetings':'جلسات',
 'Context':'موقعیت انجام کار','Energy':'سطح انرژی','Duration':'مدت زمان','Due':'موعد','Priority':'اولویت','Status':'وضعیت',
 'Inbox':'یادداشت‌های ورودی','Backlog':'برای بعد','WIP':'کارهای هم‌زمان','Theme':'موضوع اصلی','Must':'ضروری','Should':'مهم','Could':'در صورت فرصت',
 'Review':'مرور','Views':'نمای کارها','Timeline':'خط زمانی','Calendar':'تقویم','Board':'نمای ستونی','List':'فهرست',
 'Capture':'ثبت اولیه','Clarify':'مشخص‌کردن قدم بعدی','Commit':'برنامه‌ریزی','Promote':'تبدیل به برنامه','Synthesis':'جمع‌بندی','Applied':'به‌کارگرفته‌شده',
 'Learning':'یادگیری','Active':'در جریان','Archived':'بایگانی‌شده','Incubating':'در حال آماده‌سازی','Someday / Explore':'شاید در آینده',
 'Waiting':'در انتظار پاسخ','Delegated':'واگذارشده','Deadline':'مهلت','Focus':'تمرکز','Attention':'نیازمند پیگیری','Takeaway':'نکتهٔ کلیدی',
 'Standard':'انتظار از این حوزه','Evidence-first':'بر اساس کارهای ثبت‌شده','Portfolio':'مجموعهٔ برنامه‌ها','Resume':'ادامهٔ کار','Open':'باز',
 'Prepare':'آماده‌سازی','Decisions':'تصمیم‌ها','Actions':'کارها','Decision':'تصمیم','Action':'قدم بعدی','Now':'اکنون','Today':'امروز',
 'Week':'هفته','Month':'ماه','Check-in':'ثبت حال روزانه','Progress':'پیشرفت','Scope':'دامنهٔ برنامه','Start':'شروع',
}
const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
const pattern=new RegExp('\\b('+Object.keys(words).sort((a,b)=>b.length-a.length).map(escape).join('|')+')\\b','g')
function translate(text){return text.replace(pattern,m=>words[m]).replaceAll('تسک','کار').replaceAll('Contextها','موقعیت‌ها')}
function walk(node,visit,parent){if(!node||typeof node!=='object')return;if(node.type)visit(node,parent);for(const [key,value] of Object.entries(node)){if(['loc','start','end','extra','comments','tokens'].includes(key))continue;if(Array.isArray(value))value.forEach(n=>walk(n,visit,node));else if(value&&typeof value==='object')walk(value,visit,node)}}
function translateScript(source){
 const ast=parse(source,{sourceType:'script'}),edits=[],identifiers=[],api=[]
 walk(ast,(node,parent)=>{
  if(node.type==='Identifier')identifiers.push(node.name)
  if(node.type==='StringLiteral'&&node.value.startsWith('/api/'))api.push(node.value)
  if(node.type==='StringLiteral'){
   if(parent?.type==='ObjectProperty'&&parent.key===node)return;
   const value=translate(node.value);if(value!==node.value)edits.push({start:node.start,end:node.end,value:JSON.stringify(value)})
  }
  if(node.type==='TemplateElement'){
   const value=translate(node.value.raw);if(value!==node.value.raw)edits.push({start:node.start,end:node.end,value})
  }
 })
 for(const edit of edits.sort((a,b)=>b.start-a.start))source=source.slice(0,edit.start)+edit.value+source.slice(edit.end)
 const after=parse(source,{sourceType:'script'}),nextIds=[],nextApi=[]
 walk(after,node=>{if(node.type==='Identifier')nextIds.push(node.name);if(node.type==='StringLiteral'&&node.value.startsWith('/api/'))nextApi.push(node.value)})
 assert.deepEqual(nextIds,identifiers,'Code identifiers must not be translated');assert.deepEqual(nextApi,api,'API paths must not change')
 return source
}
let html=fs.readFileSync('index.html','utf8')
html=html.split(/(<script\b[^>]*>[\s\S]*?<\/script>|<style\b[^>]*>[\s\S]*?<\/style>)/g).map(part=>{
 if(part.startsWith('<style'))return part;
 if(part.startsWith('<script'))return part.replace(/^(<script\b[^>]*>)([\s\S]*)(<\/script>)$/,(_,a,code,b)=>a+translateScript(code)+b)
 return translate(part)
}).join('')
html=html.replaceAll('مناسبت‌های متصل‌شده به تقویم','مناسبت‌های تقویم').replaceAll('Eventهایی با type = religious','مناسبت‌های ثبت‌شده در تقویم').replaceAll('رویدادهایی با type = religious','مناسبت‌های ثبت‌شده در تقویم').replaceAll('Calendar-linked','ثبت‌شده در تقویم')
html=html.replaceAll('موضوع اصلی هفته، تعهدات ضروری و ظرفیت پروژه‌ها در یک لایه کنترل می‌شوند.','موضوع هفته و کارهای ضروری را با توجه به وقت آزاد خود انتخاب کنید.')
for(const [from,to] of [
 ['کارها / نمای کارها','کارها'],['اهداف / هدف‌ها','هدف‌ها'],['حوزه‌ها / حوزه‌ها','حوزه‌های زندگی'],['ثبت سریع / یادداشت‌های ورودی','ثبت سریع'],['یادداشت‌های ورودی / ثبت سریع','ثبت سریع'],
 ['تقویم-linked','در تقویم'],['همان روتینها؛ فقط با فیلتر routine_type = spiritual','روتین‌های معنوی انتخاب‌شدهٔ شما'],['>Canonical<','>روتین‌های شما<'],
 ['View تخصصی، منبع داده مشترک','ثبت و پیگیری برنامهٔ روزانه'],['در Habit Matrix و صفحه معنوی هر دو دیده می‌شود.','روتین‌ها را در این صفحه یا بخش عادت‌ها پیگیری کنید.'],
 ['فقط adherence رفتار ثبت‌شده نمایش داده می‌شود.','روند انجام روتین‌های خود را ببینید.'],['اصل طراحی','راهنمای استفاده'],['نمای اختصاصی روی موتور روتین','پیگیری عادت‌های روزانهٔ انتخاب‌شده'],
 ['حوزهها','حوزه‌ها'],['پروژهها','پروژه‌ها'],['روتینها','روتین‌ها'],['قدم بعدیها','قدم‌های بعدی']
])html=html.replaceAll(from,to)
if(!html.includes('function friendlySystemText(')){
 const map={...words,high:'بالا',medium:'متوسط',low:'کم',active:'در جریان',incubating:'در حال آماده‌سازی',someday:'برای آینده',archived:'بایگانی‌شده'}
 const helper=`function friendlySystemText(value){const words=${JSON.stringify(map)};return String(value??'').replace(/\\b[A-Za-z][A-Za-z -]*[A-Za-z]\\b/g,word=>words[word]||word.split(' ').map(w=>words[w]||w).join(' '));}\n`
 html=html.replace('function v114RecCard',helper+'function v114RecCard')
}
html=html.replace(/function v114RecCard[^\n]*/g,line=>line.replace('escapeHtml(r)','escapeHtml(friendlySystemText(r))'))
html=html.replaceAll('(t.reasons||[]).map(escapeHtml)',"(t.reasons||[]).map(reason=>escapeHtml(friendlySystemText(reason)))")
html=html.replaceAll('escapeHtml(p.lifecycle_status)', 'escapeHtml(friendlySystemText(p.lifecycle_status))')
for(const [,code] of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))parse(code,{sourceType:'script'})
fs.writeFileSync('index.html',html)
let server=fs.readFileSync('server/index.js','utf8')
const starterChanges=[
 ['راه‌اندازی سایت شخصی','رسیدگی به کارهای شخصی'],['ساخت یک خانه دیجیتال آرام برای ایده‌ها و کارها.','مرتب‌کردن کارهای عقب‌افتاده و برنامه‌های این ماه.'],
 ['ارسال نسخه اولیه به سارا','هماهنگی زمان یک قرار'],['بازخورد اولیه را تا قبل از جلسه بگیر.','یک زمان مناسب برای قرار پیدا کن و با طرف مقابل هماهنگ کن.'],
 ['طراحی صفحه معرفی','مرتب‌کردن مدارک شخصی'],['نسخه مینیمال صفحه معرفی را نهایی کن.','مدارک مهم را دسته‌بندی و در جای مشخص نگهداری کن.'],
]
for(const [from,to] of starterChanges)server=server.replaceAll(from,to)
fs.writeFileSync('server/index.js',server)
console.log('General-purpose product copy applied; JavaScript identifiers and API routes preserved. Starter examples generalized; existing records untouched.')
