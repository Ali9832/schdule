import fs from 'node:fs'
import assert from 'node:assert/strict'
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''))
const file='public/data/master-items.json',backup='docs/master-items.before-user-merge.json'
if(!fs.existsSync(backup))fs.copyFileSync(file,backup)
const previous=read(backup),data=structuredClone(previous),rows=read('docs/user-bank-review.json')
const byId=new Map(rows.map(r=>[r.B,r]))
assert.equal(rows.length,3248);assert.equal(byId.size,3248)
assert.equal(previous.items.length,rows.length)
for(const item of previous.items)assert.ok(byId.has(item.id),`Missing ID ${item.id}`)
const categories=new Map(),macroTitles={}
for(const r of rows){assert.match(r.D,/^[A-Z]\d{2}$/);assert.match(r.C,/^M\d+ — /);const known=categories.get(r.D);if(known){assert.equal(known.title,r.E);assert.equal(known.macro,r.C)}else categories.set(r.D,{h:r.D,title:r.E,macro:r.C,count:0});macroTitles[r.C.split(' — ')[0]]=r.C}
const overrides={
 'MI-0066':['B02','روانشناسی فروش، مهارت تجاری است؛ عنوان به سلامت فردی اشاره ندارد'],
 'MI-1007':['U04','دسترسی علمی و نرم‌افزاری دانشجویان، بافت دانشگاهی دارد'],
 'MI-0179':['I06','عنوان شهرسازی در نسخه اصلی حفظ شد؛ سلول عنوان اکسل خالی بود'],
 'MI-1451':['P04','عنوان اصلی خرید ایرپاد است؛ شهرسازی به شناسه دیگری تعلق دارد'],
 'MI-2584':['B03','متن اصلی حفظ شد؛ خطای سلولی #NAME? عنوان معتبر نیست'],
 'MI-0113':['T01','Flask چارچوب توسعه وب است؛ عنوان کوتاه اما موضوع روشن است'],
 'MI-0117':['T06','ETAP ابزار مهندسی برق است'],
 'MI-0162':['T06','Simulink ابزار مدل‌سازی و کنترل است'],
 'MI-1476':['T01','Elementor Pro ابزار توسعه وب است'],
 'MI-1480':['S06','Corel Video Studio ابزار تولید و ویرایش ویدئو است'],
 'MI-1491':['T04','تایپ ده‌انگشتی مهارت کار با ابزار دیجیتال است'],
 'MI-1438':['S01','معنویات موضوع دینی مشخصی دارد؛ کوتاه بودن به تنهایی ابهام نیست'],
 'MI-1440':['S01','مسائل شرعی موضوع دینی روشن دارند'],
 'MI-1447':['S01','صدقه عمل دینی مشخص است'],
 'MI-1446':['S01','ثبت صدقه پاسخ مصاحبه محسوب نمی‌شود'],
 'MI-1444':['S01','مصلی بافت فعالیت دینی دارد'],
 'MI-1460':['P02','صبر و تحمل به تنظیم هیجان مربوط‌اند'],
 'MI-1455':['P02','افزایش صبر و تحمل به سلامت روان و تنظیم هیجان مربوط است'],
 'MI-0050':['E05','گواهینامه پایه یک مدرک مهارت حرفه‌ای رانندگی است'],
 'MI-1514':['B04','بورس موضوع سرمایه‌گذاری است، نه مفهوم عمومی نامشخص'],
 'MI-0723':['U03','توسعه بستر اینترنت از مطالبات زیرساخت دانشگاه است'],
 'MI-0748':['U02','جابه‌جایی دمپایی‌ها در بخش امور خوابگاه آمده است'],
 'MI-0792':['U01','کمبود و کیفیت میوه مربوط به تغذیه دانشجویی است'],
 'MI-0690':['U09','بازسازی زمین والیبال خدمت ورزشی دانشگاه است'],
 'MI-1570':['S07','نیازمندان موضوع خدمات اجتماعی است؛ اقدام هنوز نیازمند تعریف است'],
 'MI-1644':['B03','استفاده از مزیت منطقه آزاد موضوع تجارت است'],
 'MI-2471':['B03','استفاده از مزیت منطقه آزاد موضوع تجارت است'],
 'MI-2579':['B03','مزیت منطقه آزاد موضوع تجارت است'],
 'MI-0520':['Z05','نام دو شخص بدون شرح ارتباط، خوداظهاری مصاحبه نیست'],
 'MI-0422':['S03','مناظره سیاسی، پاسخ مصاحبه خودشناسی نیست'],
 'MI-0360':['B02','فومو و تحریک هیجان مخاطب به بازاریابی مربوط‌اند'],
 'MI-0428':['S01','ارجاع به آیه قرآن موضوع دینی است'],
 'MI-0461':['S02','عنوان تاریخی در بانک مطالعاتی آمده است، نه مصاحبه شخصی'],
 'MI-0556':['R01','تکه‌هایی از یک کل منسجم نام منبع مطالعاتی است'],
 'MI-2259':['S06','انتشار داستان موضوع تولید محتواست'],
 'MI-1060':['U04','مشروطی ترم اول، مقررات آموزشی دانشگاه است'],
 'MI-0747':['U03','درختان استیجاری در بافت فضای فیزیکی دانشگاه قرار دارند'],
 'MI-0752':['Z04','پرسش بدون بافت، مصاحبه خودشناسی محسوب نمی‌شود'],
 'MI-1103':['Z04','عبارت کلی کیفیت بدون زمینه کافی است'],
 'MI-0341':['Z04','گزاره کلی بدون مرجع و زمینه کافی است'],
 'MI-0470':['Z04','عبارت کنایی بدون زمینه کافی است'],
 'MI-0668':['Z04','متن خطابی بدون اقدام و زمینه روشن است'],
 'MI-0925':['U02','طناب رخت‌آویز مربوط به امکانات خوابگاه است'],
 'MI-0906':['U02','چک‌لیست اتاق و پشه‌بند مربوط به خوابگاه است'],
 'MI-0982':['U02','رختشورخانه خدمت خوابگاهی است'],
 'MI-0994':['U03','تغییر پروتکل شبکه در بافت اینترنت دانشگاه است'],
 'MI-0696':['U03','اتصال وای‌فای در بافت اینترنت دانشگاه است'],
 'MI-0999':['U03','ارتقای پهنای باند، زیرساخت اینترنت دانشگاه است'],
 'MI-1005':['U03','سرعت اینترنت از مطالبات زیرساخت دانشگاه است'],
 'MI-1006':['U03','تعداد نقاط وای‌فای از مطالبات زیرساخت دانشگاه است'],
 'MI-0991':['U03','سهم ترافیک شبکه از خدمات زیرساخت دانشگاه است'],
 'MI-1196':['U08','تعیین ساعت و نحوه اداره گمشدگان، خدمت اداری دانشگاه است'],
 'MI-2107':['T07','دفتر انتقال فناوری و تجاری‌سازی با ابزار دیجیتال تفاوت دارد'],
 'MI-0620':['P01','بیمه لپ‌تاپ، مدیریت دارایی شخصی است و مهندسی الکترونیک نیست'],
}
const questionIds=new Set([3058,3060,3062,3064,3067,3069,3071,3073,3076,3078,3086,3088,3090,3092,3094,3096,3098,3100,3102,3104,3106,3108,3110,3112,3114,3117])
for(let n=3058;n<=3118;n++)overrides[`MI-${n}`]=[questionIds.has(n)?'Z01':'Z02','حفظ پیوستگی بخش مصاحبه اصلی؛ پرسش/پاسخ شخصی با موضوع ذکرشده در پاسخ یکی نیست']
for(let n=3119;n<=3150;n++)overrides[`MI-${n}`]=['Z03','نتایج آزمون و ارزش‌های شخصی در بخش سنجش خودشناسی باقی می‌مانند']
const legacy={H1:'P01',H2:'E01',H3:'E05',H4:'E04',H5:'E03',H6:'T05',H7:'T01',H8:'B02',H9:'T07',H10:'X01',H11:'U05',H12:'I05',H13:'S07',H14:'X03',H15:'S01',H16:'S03',H17:'P04',H18:'R01',H19:'B04',H20:'Z04',H21:'Z02',H22:'Z03',H23:'Z04'}
const comparison=[],textConflicts=[]
for(const item of data.items){
 const r=byId.get(item.id),before={h:item.h,category:item.category,macro:item.macro,subcategory:item.subcategory};
 const override=overrides[item.id],h=override?.[0]||r.D,category=categories.get(h);assert.ok(category,h)
 if(item.text!==r.H)textConflicts.push({id:item.id,retained:item.text,workbook:r.H,reason:'حفظ عنوان نسخه اصلی؛ تغییر متن خارج از مقایسه دسته‌بندی است'})
 const reason=override?.[1]||r.T||'تفکیک موضوعی فایل بازبینی‌شده کاربر'
 const needsReview=['Z04','Z05','Z07'].includes(h)||(!override&&r.R==='نیازمند بررسی')
 const keepTopic=legacy[before.h]===h&&before.subcategory&&!before.subcategory.startsWith('سایر موضوعات ')
 item.h=h;item.category=category.title;item.macro=category.macro;item.subcategory=keepTopic?before.subcategory:category.title
 item.classification={...item.classification,version:3,previous:before,workbook:{h:r.D,category:r.E,macro:r.C,confidence:r.R,reason:r.T},reason,needsReview,decision:override?'ادغام و اصلاح':'پذیرش ساختار کاربر'}
 comparison.push({id:item.id,text:item.text,previous:before,workbook:{h:r.D,category:r.E,confidence:r.R},final:{h,category:category.title},reason,needsReview,correctedWorkbook:h!==r.D})
}
data.categories=[...categories.values()];data.macroTitles=macroTitles;data.legacyCategoryMap=legacy
data.classificationVersion=3
const palette=[['#eaf7f4','#168575'],['#edf5fc','#367bb8'],['#f3eefa','#8060b0'],['#fff1e9','#bc7448'],['#e9f5f4','#218b86'],['#edf3fb','#567ba9'],['#eff6e6','#63893d'],['#fceef1','#b6617b'],['#f6f1e8','#9f814b'],['#f2f5f7','#6f8790']]
data.styles={}
for(const c of data.categories){c.count=data.items.filter(i=>i.h===c.h).length;const index=Number(c.macro.match(/^M(\d+)/)[1])-1;const [tint,accent]=palette[index];data.styles[c.h]={tint,accent,line:'#dfe7ea'}}
data.macroCounts=Object.fromEntries(Object.keys(macroTitles).map(code=>[code,data.items.filter(i=>i.macro.startsWith(code+' — ')).length]))
data.comparisonSummary={previousCategories:previous.categories.length,previousMacros:Object.keys(previous.macroTitles).length,categories:data.categories.length,macros:Object.keys(macroTitles).length,workbookCorrections:comparison.filter(i=>i.correctedWorkbook).length,needsReview:comparison.filter(i=>i.needsReview).length,textConflicts:textConflicts.length}
const report={summary:data.comparisonSummary,decision:'مبنای ساختار: فایل کاربر؛ ادغام با اصلاحات بافتی و حفظ محتوای اصلی و ویرایش‌های دستی',textConflicts,items:comparison}
fs.writeFileSync(file,JSON.stringify(data))
fs.writeFileSync('docs/bank-user-comparison.json',JSON.stringify(report,null,2))
fs.writeFileSync('public/data/bank-comparison.json',JSON.stringify(report))
const markdown=`# مقایسه و ادغام دسته‌بندی آیتم‌ها\n\nساختار کاربر مبنای نسخه نهایی است: ${data.categories.length} دسته در ${Object.keys(macroTitles).length} حوزه، در برابر ${previous.categories.length} دسته در ${Object.keys(previous.macroTitles).length} حوزه نسخه قبلی.\n\n- مزیت فایل کاربر: تفکیک تخصصی دانشگاه، صنعت، فناوری، کسب‌وکار و زیست‌بوم؛ جداسازی متن ناقص و حاشیه‌های گفتگو.\n- مزیت نسخه قبلی: تشخیص برخی ابزارهای کوتاه‌نام و حفظ بافت پیوسته مصاحبه؛ این بخش‌ها در ادغام حفظ شده‌اند.\n- در ${data.comparisonSummary.workbookCorrections} ردیف، دسته فایل کاربر پس از بررسی بافت اصلاح شد.\n- ${data.comparisonSummary.needsReview} ردیف هنوز نیازمند بازبینی‌اند؛ این علامت به معنای اشتباه قطعی نیست.\n- همهٔ ${data.items.length} شناسه، متن، وضعیت، یادداشت و مرجع اصلی حفظ شده‌اند. ویرایش‌های دستی مرورگر بر داده پیش‌فرض اولویت دارند.\n- این بررسی شامل تطبیق همه شناسه‌ها و دسته‌ها، کنترل بافت مصاحبه و نمونه‌های تعارض است؛ تأیید معنایی دستی تک‌تک آیتم‌ها نیست.\n\n## اختلاف محتوای اکسل\n\n${textConflicts.map(c=>`- ${c.id}: عنوان اصلی «${c.retained}» حفظ شد؛ مقدار فایل کاربر: «${c.workbook||'(خالی)'}».`).join('\n')}\n\n## نمونه اصلاحات\n\n${comparison.filter(c=>c.correctedWorkbook).slice(0,20).map(c=>`- ${c.id}: ${c.workbook.category} ← ${c.final.category}؛ ${c.reason}`).join('\n')}\n\n## دسته‌های نهایی\n\n${data.categories.map(c=>`- ${c.h} — ${c.title}: ${c.count} آیتم`).join('\n')}\n`
fs.writeFileSync('docs/BANK_USER_COMPARISON_FA.md',markdown)
fs.writeFileSync('public/data/NOVA_Categories_Comparison.md',markdown)
console.log(JSON.stringify(data.comparisonSummary))
