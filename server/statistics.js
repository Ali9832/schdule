import { tehranToday } from './planning-date.js'

export const statisticTypes = { tasks:'کارها', projects:'پروژه‌ها', routines:'روتین‌ها', reading:'کتاب‌خوانی', resources:'منابع یادگیری', goals:'هدف‌ها', meetings:'جلسات' }
const DAY = 86400000
const bad = message => Object.assign(new Error(message), { statusCode:400 })
export const shiftDay = (day, n) => new Date(Date.parse(day+'T12:00:00Z')+n*DAY).toISOString().slice(0,10)
export function statisticDay(value) {
  if (!value) return null
  const raw=String(value)
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return Number.isFinite(Date.parse(raw)) && new Date(raw).toISOString().slice(0,10)===raw ? raw : null
  const date=new Date(value); if(!Number.isFinite(date.getTime()))return null
  return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).format(date)
}
// Do not invent completion dates for records that were already done before tracking.
export function completionMetadata(current, next, now=new Date().toISOString()) {
  if(next.status!=='done')return {completed_at:null,completed_due_date:null}
  if(current?.status==='done')return {completed_at:current.completed_at||null,completed_due_date:current.completed_due_date||null}
  return {completed_at:now,completed_due_date:next.due_date||null}
}
export function buildStatistics(source, query={}, today=tehranToday()) {
  const to=query.to||today
  if(!/^\d{4}-\d{2}-\d{2}$/.test(to)||statisticDay(to)!==to||to>today)throw bad('تاریخ پایان معتبر تا امروز انتخاب کنید.')
  const from=query.from||shiftDay(to,-29)
  if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to)||statisticDay(from)!==from||statisticDay(to)!==to||from>to||to>today)throw bad('بازهٔ تاریخ معتبر تا امروز انتخاب کنید.')
  const length=Math.round((Date.parse(to)-Date.parse(from))/DAY)+1
  if(length>366)throw bad('بازهٔ نمودار حداکثر ۳۶۶ روز است.')
  const types=query.types==null?['tasks','projects','routines','reading']:String(query.types).split(',').filter(Boolean)
  if(!types.length||types.some(type=>!Object.hasOwn(statisticTypes,type)))throw bad('نوع آمار معتبر انتخاب کنید.')
  const selected=new Set(String(query.ids||'').split(',').filter(Boolean))
  if(selected.size>500)throw bad('حداکثر ۵۰۰ مورد را هم‌زمان انتخاب کنید.')
  const groups={tasks:source.tasks||[],projects:source.projects||[],routines:source.routines||[],reading:source.reading?.books||[],resources:source.resources||[],goals:source.outcomes||[],meetings:source.meetings||[]}
  const catalog=Object.entries(groups).flatMap(([type,rows])=>rows.map(r=>({key:type+':'+r.id,id:r.id,type,title:r.title||r.name||'بدون عنوان',status:r.status||'',created:statisticDay(r.created_at)})))
  const allowed=new Set(catalog.filter(c=>types.includes(c.type)).map(c=>c.key))
  if([...selected].some(key=>!allowed.has(key)))throw bad('یکی از موارد انتخاب‌شده در این حساب یا بخش وجود ندارد.')
  const chosen=Object.fromEntries(Object.entries(groups).map(([type,rows])=>[type,types.includes(type)?rows.filter(r=>!selected.size||selected.has(type+':'+r.id)):[]]))
  const countRows=Object.values(chosen).flat(), datedRows=[...chosen.tasks,...chosen.projects], inRange=day=>day&&day>=from&&day<=to
  const days=Array.from({length},(_,i)=>shiftDay(from,i)),previousFrom=shiftDay(from,-length)
  const daily=new Map(days.map(date=>[date,{date,created:0,completed:0,routine_checks:0,reading_minutes:0,meeting_count:0}]))
  const completed=datedRows.filter(r=>r.status==='done'&&statisticDay(r.completed_at)), unknownCompleted=datedRows.filter(r=>r.status==='done'&&!statisticDay(r.completed_at))
  for(const r of countRows){const d=statisticDay(r.created_at);if(daily.has(d))daily.get(d).created++}
  for(const r of completed){const d=statisticDay(r.completed_at);if(daily.has(d))daily.get(d).completed++}
  const overdue=datedRows.filter(r=>r.status!=='done'&&r.status!=='paused'&&r.lifecycle_status!=='archived'&&statisticDay(r.due_date)&&statisticDay(r.due_date)<today)
  const undated=datedRows.filter(r=>!statisticDay(r.due_date))
  const routines=chosen.routines.map(r=>{
    const start=statisticDay(r.created_at), eligible=days.filter(d=>!start||d>=start)
    const checks=eligible.filter(d=>Boolean(r.logs?.[d]))
    for(const d of checks)daily.get(d).routine_checks++
    return {id:r.id,title:r.title,checks:checks.length,target_weekly:Number(r.target_weekly||r.target||1),status:r.status,created:start}
  })
  const bookIds=new Set(chosen.reading.map(r=>r.id)),readingSessions=(source.reading?.sessions||[]).filter(s=>bookIds.has(s.book_id))
  for(const s of readingSessions){if(daily.has(s.date))daily.get(s.date).reading_minutes+=Number(s.seconds||0)/60}
  for(const r of chosen.meetings){const d=statisticDay(r.start_at);if(daily.has(d))daily.get(d).meeting_count++}
  const dueCohort=datedRows.filter(r=>inRange(statisticDay(r.status==='done'&&r.completed_at?r.completed_due_date:r.due_date)))
  const schedule={on_time:0,late:0,overdue:0,upcoming:0,paused:0,unknown:0},deadlines=[]
  for(const r of dueCohort){
    const due=statisticDay(r.status==='done'&&r.completed_at?r.completed_due_date:r.due_date),done=statisticDay(r.completed_at)
    const state=r.status==='done'?(done?(done<=due?'on_time':'late'):'unknown'):(r.status==='paused'||r.lifecycle_status==='archived'?'paused':due<today?'overdue':'upcoming')
    schedule[state]++;deadlines.push({id:r.id,title:r.title||r.name,due,completed:done,state})
  }
  const totalCompleted=completed.filter(r=>inRange(statisticDay(r.completed_at))).length
  const previousCompleted=completed.filter(r=>{const d=statisticDay(r.completed_at);return d>=previousFrom&&d<from}).length
  const byType=Object.entries(chosen).filter(([type])=>types.includes(type)).map(([type,rows])=>({type,title:statisticTypes[type],total:rows.length,created:rows.filter(r=>inRange(statisticDay(r.created_at))).length}))
  const reading=chosen.reading.map(book=>({id:book.id,title:book.title,minutes:readingSessions.filter(s=>s.book_id===book.id&&inRange(s.date)).reduce((n,s)=>n+Number(s.seconds||0)/60,0),daily_minutes:book.daily_minutes,status:book.status}))
  return {today,from,to,days:length,types,catalog,selected:[...selected],by_type:byType,summary:{total:countRows.length,created:countRows.filter(r=>inRange(statisticDay(r.created_at))).length,completed:totalCompleted,previous_completed:previousCompleted,completed_per_week:totalCompleted/length*7,previous_per_week:previousCompleted/length*7,overdue:overdue.length,without_due:undated.length,unknown_completed:unknownCompleted.length,unknown_created:countRows.filter(r=>!statisticDay(r.created_at)).length,routine_checks:routines.reduce((n,r)=>n+r.checks,0),reading_minutes:reading.reduce((n,r)=>n+r.minutes,0)},daily:[...daily.values()],schedule,deadlines,routines,reading,
    states:{done:datedRows.filter(r=>r.status==='done').length,overdue:overdue.length,paused:datedRows.filter(r=>r.status==='paused'||r.lifecycle_status==='archived'&&r.status!=='done').length,open:datedRows.filter(r=>r.status!=='done'&&r.status!=='paused'&&r.lifecycle_status!=='archived'&&!overdue.includes(r)).length},
    notes:['تعدادها مربوط به رکوردهای موجود حساب‌اند؛ رکورد حذف‌شده در تاریخچه محاسبه نمی‌شود.','تاریخ پایان از updated_at حدس زده نمی‌شود؛ پایان‌های بدون تاریخ در سرعت و تحویل به‌موقع وارد نمی‌شوند.','سرعت از آخرین پایان معتبرِ کارها و پروژه‌هایی محاسبه می‌شود که اکنون انجام‌شده‌اند؛ پایان قبلیِ کاری که دوباره باز شده، شمرده نمی‌شود.','عقب‌افتادگی و وضعیت‌ها، وضعیت فعلی‌اند؛ آمار ایجاد و مطالعه مربوط به بازهٔ انتخابی است.','تغییر موعدهای گذشته، توقف روتین و تغییر هدف مطالعه تاریخچهٔ کامل ندارند؛ برای آن‌ها پیشرفت زمانی فرضی ساخته نمی‌شود.','تعداد بانک پایه، آمار رکوردهای ایجادشده در حساب نیست و با این اعداد جمع نمی‌شود.']}
}
export function registerStatistics(app,{load}) {
  app.get('/api/statistics',async req=>{
    // Validate parameters before expensive database reads.
    buildStatistics({}, {...req.query,ids:''})
    return buildStatistics(await load(req.user.id),req.query)
  })
}
