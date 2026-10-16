import fs from 'node:fs'
const file='public/data/master-items.json'
const backup='public/data/master-items.original.json'
if(!fs.existsSync(backup))fs.copyFileSync(file,backup)
const data=JSON.parse(fs.readFileSync(backup,'utf8'))
const normalize=s=>String(s).toLowerCase().replace(/[يى]/g,'ی').replace(/ك/g,'ک').replace(/[\u200c\u200d]/g,' ').replace(/\s+/g,' ').trim()
// Topic phrases, rather than source sheet, priority or action type, determine placement.
const rules=[]
function rule(h,topic,phrases){rules.push({h,topic,phrases:phrases.split('|').map(normalize)})}
rule('H1','خودمدیریتی و عادت‌های شخصی','مدیریت زمان|خودمدیریتی|توسعه فردی|سبک زندگی|ایرپاد|گواهینامه پایه|گواهی نامه|تحمل و صبر')
rule('H2','تحصیل و آزمون‌های دانشگاهی','دروس دانشگاه|برنامه ریزی تحصیلی|تحصیلات دانشگاهی|تحصیلات و یادگیری|کنکور|آزمون ارشد|پایان نامه|رساله|جزوه درس|جزوه ریاضی|جزوه فیزیک|تدریس ریاضی|تدریس فیزیک|تربیت مدرس|مدرک کارشناسی|هیأت علمی|هیات علمی|هییت علمی')
rule('H3','مسیر شغلی و رزومه','رزومه|فرصت شغلی|بازار کار|استخدام شدن|محدودیت شغلی|بهترین شغل|گواهی حرفه ای|مسیر شغلی|نیازهای شغلی|نیاز های شغلی')
rule('H4','مذاکره و ارتباط مؤثر','مذاکره|فن بیان|سخنوری|مهارت های ارتباطی|مهارت های نرم|هوش هیجانی|تعامل با افراد|زبان بدن|گوش دادن فعال|soft skills')
rule('H4','رهبری و مدیریت تیم','رهبری تیم|رهبری:|مدیریت و رهبری|انگیزش کارکنان|مدیریت منابع انسانی|مهارت تیم سازی')
rule('H5','زبان انگلیسی','زبان انگلیسی|لغات انگلیسی|کتب انگلیسی|دیکشنری|آیلتس|ielts|تایپ ده انگشتی انگلیسی|کنکور زبان')
rule('H5','سایر زبان‌ها','یادگیری عربی|یادگیری ترکی|زبان عربی|زبان آلمانی|زبان فرانسه|یادگیری زبان|فارسی و عربی')
rule('H6','طراحی و نرم‌افزار مهندسی','solidworks|catia|ansys|autocad|simulink|matlab|کامسول|comsol|etap|verilog|مهارت های فنی|ابزارهای مهندسی')
rule('H6','مکانیک، ساخت و مدیریت تولید','مهندسی مکانیک|مکاترونیک|ارتعاشات|اتومکانیک|تهویه|مدرک cnc|ریزپرنده|الک سه فازی|برنامه ریزی تولید|مدیریت پروژه|مهندسی صنایع|صنایع سیستم')
rule('H7','برنامه‌نویسی و توسعه نرم‌افزار','برنامه نویسی|برنامه نویسان|پایتون|python|flask|وردپرس|wordpress|elementor|ساخت اپلیکیشن|راه اندازی سایت|نرم افزارها:|مهارت های فنی و دیجیتال|owasp|ساخت دستیار صوتی')
rule('H7','داده و هوش مصنوعی','هوش مصنوعی|ماشین لرنینگ|یادگیری ماشین|machine learning|power bi|پاور بی ای|click house|nlp|علم داده|تحلیل داده|اتوماسیون')
rule('H7','ابزارهای دیجیتال و تولید چندرسانه‌ای','icdl|تایپ سریع|تایپ ده انگشتی|after effects|corel video|نرم افزار املاک')
rule('H8','فروش و بازاریابی','بازاریابی|پیشبرد فروش|مشتری|تبلیغات|برندینگ|برندسازی|مدیریت کسب و کار|راهبردی کسب|مهارت های درآمدزایی|مهارت های مالی و تجاری|crm|odoo')
rule('H8','مالی و سرمایه‌گذاری','مدیریت مالی|دانش مالی|مدیریت سرمایه|بازار سرمایه|سرمایه گذاری|اوراق قرضه|حسابداری|کنترل هزینه|گزارش دهی مالی|سوآپ')
rule('H9','پژوهش و توسعه فناوری','مقاله نویسی|ثبت اختراع|پژوهش|نیازهای فناورانه|نیاز های فناورانه|خودترمیم|هدایت پرتو|پیزو الکتریک|دانش فنی|مالکیت معنوی')
rule('H10','کارآفرینی، شتاب‌دهی و زیست‌بوم نوآوری','کارآفرین|اکوسیستم|زیست بوم|شتاب دهنده|استارتاپ|استارت آپ|تجاری سازی|انتقال فناوری|مرکز رشد|تیم سازی|entrepreneur|حل مسیله واقعی استان')
rule('H11','امور صنفی، رفاهی و اجرایی دانشگاه','خوابگاه|امتحانات دانشگاه|شورای صنفی|غذای دانشجو|سلف|بوفه دانشگاه|ریاست دانشگاه|معاونت آموزشی|رییس دانشگاه|رئیس دانشگاه|هییت دانشگاه|هیات دانشگاه|کتابخانه ملی|رفاه دانشجو')
rule('H11','رسانه و برنامه‌های دانشجویی','خبرنامه|خبرگزاری|رسانه دانشجو|انجمن علمی|بسیج دانشجو|بسیج خوابگاه|مراسم دانشگاه')
rule('H12','صنعت، انرژی و زیرساخت','برنامه ریزی شهری|نفت و گاز|پتروشیمی|نیروگاه|انرژی خورشیدی|تجدیدپذیر|صنایع مزیت دار|صنایع اصلی|پروژه های تولیدی|کارخانه|شهرک صنعتی')
rule('H12','کشاورزی و محیط‌زیست','کشاورزی|دامپروری|شیلات|گلخانه|پساب|محیط زیست|پسماند|بازیافت|آبزی|گردشگری کشاورزی')
rule('H13','سلامت جسم و روان','سلامت روان|سلامت جسم|روانشناسی|مدیریت استرس|استرس و خشم|اضطراب|بیماری|پزشکی|تغذیه|خواب کافی|داروخانه|مدرک تزریق|درمان|پرستاری')
rule('H13','امور خیر و خدمات اجتماعی','خیریه|امور خیر|نیکوکاری|محرومیت زدایی|خدمات اجتماعی')
rule('H14','روابط شخصی و شبکه‌سازی','قرار دوستانه|مهارت شبکه سازی|networking|شبکه سازی حرفه ای|ارتباطات کلیدی|دیدار با|ارتباط با افراد')
rule('H15','دین، معنویت و مناسبت‌ها','معنویات|مدیریت معنوی|دعا|صحیفه سجادیه|شرعی|ترک گناه|صدقه|نذر|صلولت|صلوات|روایات|مقبره شهدا|بسیج|مصلی|هییت|حامیم')
rule('H15','فرهنگ، تاریخ، هنر و رسانه','تاریخ|فرهنگی|فیلم|سینما|تیاتر|تئاتر|خوشنویسی|هنری|موسیقی|گویندگی|گفت و گو محور|کتاب و رسانه|عکس ها|گالری|ادبیات')
rule('H16','حکمرانی، حقوق و سیاست','حکمرانی|حقوقی|حقوق شهروندی|حقوق و مدنی|قوانین مدنی|خط مشی|مدیریت دولتی|سیاست خارجی|اقتصاد کلان|کیسینجر|قذافی|اکتبر ایران|قانون اساسی')
rule('H17','سفر، تفریح و ورزش','سفر به|مسافرت|کوهنوردی|شنا کردن|بدنسازی|فوتبال|والیبال|ورزش|تفریح|گردشگری')
rule('H18','مطالعه و مدیریت منابع','مطالعه و تحقیق|کتاب در روز|بانک مطالعه|منابع سریع|منابع مطالعاتی|خلاصه کتاب|خلاصه کتب')
rule('H19','چشم‌انداز و طرح‌های بلندمدت','چشم انداز|بلندمدت|بلند مدت|رویای|آرمان شخصی')
const overrides={
 'MI-0005':'H5','MI-0021':'H2','MI-0022':'H2','MI-0023':'H11','MI-0029':'H2','MI-0053':'H5','MI-0061':'H4','MI-0067':'H4','MI-0070':'H5','MI-0071':'H4','MI-0090':'H14','MI-0113':'H7','MI-0117':'H6','MI-0122':'H8','MI-0123':'H8','MI-0151':'H9','MI-0152':'H7','MI-0162':'H6','MI-0179':'H12','MI-0186':'H4','MI-0035':'H5','MI-0087':'H5','MI-0019':'H7','MI-1484':'H6','MI-1513':'H10','MI-1499':'H4','MI-1510':'H8','MI-1511':'H8','MI-1512':'H8','MI-1500':'H8','MI-1509':'H8','MI-3063':'H3','MI-0051':'H6','MI-0055':'H13','MI-1493':'H13',
}
const categories=new Map(data.categories.map(c=>[c.h,c]))
// This contiguous section is the original interview, including questions and answers.
for(let n=3058;n<=3118;n++)overrides[`MI-${n}`]='H21'
Object.assign(overrides,{'MI-0066':'H8','MI-0004':'H4','MI-1007':'H11','N115-0055':'H10','MI-0040':'H4','MI-1502':'H4','MI-1458':'H1','MI-2505':'H3','MI-1527':'H16','MI-0072':'H15','MI-0018':'H8','MI-0059':'H6'})
const changes=[],review=[]
for(const item of data.items){
 const original={h:item.h,category:item.category,macro:item.macro}
 const text=normalize(item.text)
 const matches=rules.map(r=>({...r,hits:r.phrases.filter(p=>/^[a-z0-9 ]+$/.test(p)?new RegExp(`(^|[^a-z0-9])${p}([^a-z0-9]|$)`,'i').test(text):['دعا','نذر','صدقه','بسیج','ورزش','تاریخ','فیلم','هنری'].includes(p)?new RegExp(`(^|[^\\p{L}])${p}([^\\p{L}]|$)`,'u').test(text):text.includes(p))})).filter(r=>r.hits.length)
 const scores=new Map()
 for(const r of matches)scores.set(r.h,(scores.get(r.h)||0)+r.hits.reduce((n,p)=>n+(p.length>=8?5:4),0))
 const ranked=[...scores].sort((a,b)=>b[1]-a[1])
 const protectedRecord=['H21','H22'].includes(item.h)
 const best=ranked[0],margin=best?best[1]-(ranked[1]?.[1]||0):0
 let target=item.h,reason='حفظ دسته فعلی؛ شواهد موضوعی کافی برای جابه‌جایی نیست'
 if(protectedRecord)reason='حفظ داده خودشناسی و سنجش؛ موضوع پاسخ، نوع مدرک را تغییر نمی‌دهد'
 else if(overrides[item.id]){target=overrides[item.id];reason='بازبینی مستقیم عنوان آیتم'}
 else if(best&&best[1]>=4&&margin>=3){target=best[0];reason='نشانه‌های موضوعی: '+matches.filter(r=>r.h===target).flatMap(r=>r.hits).join('، ')}
 const topics=matches.filter(r=>r.h===target).sort((a,b)=>b.hits.length-a.hits.length)
 item.subcategory=['H21','H22'].includes(target)?(target==='H21'?'مصاحبه و خوداظهاری':'نتایج آزمون‌های خودشناسی'):topics[0]?.topic||'سایر موضوعات '+categories.get(target).title
 item.classification={version:2,original,reason,needsReview:!protectedRecord&&!overrides[item.id]&&((best&&margin<3)||['H20','H23'].includes(target))}
 if(target!==item.h){const cat=categories.get(target);changes.push({id:item.id,text:item.text,from:item.h,to:target,subcategory:item.subcategory,reason});item.h=target;item.category=cat.title;item.macro=cat.macro}
 if(item.classification.needsReview)review.push({id:item.id,h:item.h,text:item.text,candidates:ranked.slice(0,3).map(([h,score])=>({h,score}))})
}
for(const category of data.categories)category.count=data.items.filter(i=>i.h===category.h).length
data.macroCounts=Object.fromEntries(Object.keys(data.macroTitles).map(code=>[code,data.items.filter(i=>i.macro.startsWith(code+' ')).length]))
data.classificationVersion=2
fs.writeFileSync(file,JSON.stringify(data))
fs.mkdirSync('docs',{recursive:true})
fs.writeFileSync('docs/bank-classification-audit.json',JSON.stringify({total:data.items.length,changed:changes.length,needsReview:review.length,changes,review},null,2))
fs.writeFileSync('docs/BANK_CLASSIFICATION_FA.md',`# بازبینی دسته‌بندی بانک آیتم‌ها\n\nهمهٔ ${data.items.length} آیتم با قواعد موضوعی بررسی شدند؛ ${changes.length} آیتم جابه‌جا شد. ${review.length} مورد به دلیل عنوان کلی، چندموضوعی یا نبود شواهد کافی برای بازبینی مشخص شده‌اند. این خروجی بازبینی معنایی دستی تک‌تک آیتم‌ها نیست.\n\nشناسه، متن، وضعیت، یادداشت و مرجع اصلی حفظ شده‌اند. نسخه اولیه در public/data/master-items.original.json و جزئیات هر جابه‌جایی در bank-classification-audit.json موجود است. دسته بر اساس موضوع انتخاب می‌شود؛ اولویت و نوع اقدام مستقل باقی می‌مانند. داده‌های مصاحبه و آزمون در گروه شواهد خودشناسی باقی می‌مانند.\n\n${data.categories.map(c=>`- ${c.h}: ${c.title} — ${c.count} آیتم`).join('\n')}\n`)
console.log(JSON.stringify({total:data.items.length,changed:changes.length,needsReview:review.length}))
