import { tehranToday } from './planning-date.js'

export const statisticTypes = { tasks:'کارها', projects:'پروژه‌ها', routines:'روتین‌ها', reading:'کتاب‌خوانی', resources:'منابع یادگیری', goals:'هدف‌ها', meetings:'جلسات',calendar:'برنامه‌های تقویم' }
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
export function calendarStatisticRecords(source,calendar={}) {
  return Object.entries({task:source.tasks||[],event:source.events||[],project:source.projects||[],outcome:source.outcomes||[]}).flatMap(([type,rows])=>rows.filter(row=>statisticDay(row.start_at||row.due_date)||Object.keys(calendar[type+':'+row.id]?.results||{}).length).map(row=>{
    const meta=calendar[type+':'+row.id]||{};
    return {id:type+':'+row.id,title:row.title||row.name,created_at:row.created_at,status:row.status,results:Object.entries(meta.results||{}).filter(([,r])=>r.status==='not_done'&&statisticDay(r.date)&&Number.isFinite(Date.parse(r.recorded_at))).map(([occurrence,r])=>({...r,source:type,entity_id:row.id,occurrence_date:meta.recurrence?occurrence:null,title:row.title||row.name}))};
  }));
}
// These are current task outcomes grouped by their deadline, not invented historical snapshots.
export function taskPerformance(tasks, calendar, from, to, today) {
  const inRange=d=>d&&d>=from&&d<=to, diff=(a,b)=>Math.round((Date.parse(a)-Date.parse(b))/DAY);
  const results=new Map(calendar.map(r=>[r.id,r.results||[]]));
  const rows=tasks.map(task=>{
    const created=statisticDay(task.created_at), completed=task.status==='done'?statisticDay(task.completed_at):null;
    const due=statisticDay(task.status==='done'&&completed?task.completed_due_date:task.due_date);
    const missed=(results.get('task:'+task.id)||[]).filter(r=>inRange(r.date));
    const currentMissed=task.status!=='done'&&(results.get('task:'+task.id)||[]).some(r=>!due||r.date===due);
    const state=task.status==='done'?(completed?(due?(completed<=due?'on_time':'late'):'done_no_due'):'unknown'):
      task.status==='paused'||task.lifecycle_status==='archived'?'paused':currentMissed?'not_done':due&&due<today?'overdue':'open';
    return {id:task.id,title:task.title,created,due,completed,state,not_done_count:missed.length,
      cycle_days:created&&completed&&completed>=created?diff(completed,created):null,
      delay_days:due?(completed?Math.max(0,diff(completed,due)):task.status!=='done'&&state!=='paused'?Math.max(0,diff(today,due)):null):null};
  }).filter(r=>inRange(r.created)||inRange(r.due)||inRange(r.completed)||r.not_done_count);
  const states={on_time:0,late:0,done_no_due:0,unknown:0,not_done:0,overdue:0,open:0,paused:0};
  for(const row of rows)states[row.state]++;
  const daily=Array.from({length:diff(to,from)+1},(_,i)=>({date:shiftDay(from,i),on_time:0,late:0,not_done:0,overdue:0,open:0,paused:0,unknown:0,cycle_total:0,cycle_count:0}));
  const byDate=new Map(daily.map(d=>[d.date,d]));
  for(const row of rows){
    if(inRange(row.due))byDate.get(row.due)[row.state]++;
    if(inRange(row.completed)&&row.cycle_days!==null){const day=byDate.get(row.completed);day.cycle_total+=row.cycle_days;day.cycle_count++;}
  }
  const dueRows=rows.filter(r=>inRange(r.due)),onTime=dueRows.filter(r=>r.state==='on_time').length,late=dueRows.filter(r=>r.state==='late').length;
  const durations=rows.filter(r=>inRange(r.completed)&&r.cycle_days!==null).map(r=>r.cycle_days);
  return {rows,states,daily,summary:{total:rows.length,not_done_tasks:rows.filter(r=>r.not_done_count).length,not_done_occurrences:rows.reduce((n,r)=>n+r.not_done_count,0),due_total:dueRows.length,on_time:onTime,late,on_time_percent:onTime+late?100*onTime/(onTime+late):null,average_cycle_days:durations.length?durations.reduce((a,b)=>a+b,0)/durations.length:null,cycle_samples:durations.length}};
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
  const groups={tasks:source.tasks||[],projects:source.projects||[],routines:source.routines||[],reading:source.reading?.books||[],resources:source.resources||[],goals:source.outcomes||[],meetings:source.meetings||[],calendar:source.calendar_records||[]}
  const catalog=Object.entries(groups).flatMap(([type,rows])=>rows.map(r=>({key:type+':'+r.id,id:r.id,type,title:r.title||r.name||'بدون عنوان',status:r.status||'',created:statisticDay(r.created_at)})))
  const allowed=new Set(catalog.filter(c=>types.includes(c.type)).map(c=>c.key))
  if([...selected].some(key=>!allowed.has(key)))throw bad('یکی از موارد انتخاب‌شده در این حساب یا بخش وجود ندارد.')
  const chosen=Object.fromEntries(Object.entries(groups).map(([type,rows])=>[type,types.includes(type)?rows.filter(r=>!selected.size||selected.has(type+':'+r.id)):[]]))
  const identities={tasks:'task',projects:'project',goals:'outcome',meetings:'event'};
  const countRows=[...new Map(Object.entries(chosen).flatMap(([type,rows])=>rows.map(row=>[type==='calendar'?row.id:(identities[type]||type)+':'+row.id,row]))).values()], datedRows=[...chosen.tasks,...chosen.projects], inRange=day=>day&&day>=from&&day<=to
  const days=Array.from({length},(_,i)=>shiftDay(from,i)),previousFrom=shiftDay(from,-length)
  const daily=new Map(days.map(date=>[date,{date,created:0,completed:0,routine_checks:0,reading_minutes:0,meeting_count:0,not_done:0}]))
  const notDone=chosen.calendar.flatMap(r=>r.results||[]).filter(r=>inRange(r.date));
  for(const result of notDone)daily.get(result.date).not_done++;
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
  return {today,from,to,days:length,types,catalog,selected:[...selected],by_type:byType,task_performance:taskPerformance(chosen.tasks,source.calendar_records||[],from,to,today),not_done_results:notDone,summary:{not_done:notDone.length,total:countRows.length,created:countRows.filter(r=>inRange(statisticDay(r.created_at))).length,completed:totalCompleted,previous_completed:previousCompleted,completed_per_week:totalCompleted/length*7,previous_per_week:previousCompleted/length*7,overdue:overdue.length,without_due:undated.length,unknown_completed:unknownCompleted.length,unknown_created:countRows.filter(r=>!statisticDay(r.created_at)).length,routine_checks:routines.reduce((n,r)=>n+r.checks,0),reading_minutes:reading.reduce((n,r)=>n+r.minutes,0)},daily:[...daily.values()],schedule,deadlines,routines,reading,
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
