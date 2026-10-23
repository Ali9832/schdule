export const validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value
export const validTime=value=>/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value||'')
export const shiftDays=(value,days)=>new Date(Date.parse(value+'T12:00:00Z')+days*86400000).toISOString().slice(0,10)
const dayDiff=(a,b)=>Math.round((Date.parse(a+'T12:00:00Z')-Date.parse(b+'T12:00:00Z'))/86400000)
const formatter=new Intl.DateTimeFormat('en-US-u-ca-persian',{year:'numeric',month:'numeric',day:'numeric',timeZone:'UTC'})
function persian(value){return Object.fromEntries(formatter.formatToParts(new Date(value+'T12:00:00Z')).filter(p=>['year','month','day'].includes(p.type)).map(p=>[p.type,Number(p.value)]))}
function persianMonth(year,month,day){
 // Locate the first day using the runtime's Persian calendar, including leap years.
 const target=year*10000+month*100+1
 let lo=Math.floor(Date.UTC(year+621,0,1)/86400000),hi=Math.floor(Date.UTC(year+622,11,31)/86400000)
 while(lo<hi){const mid=Math.floor((lo+hi)/2),p=persian(new Date(mid*86400000).toISOString().slice(0,10));if(p.year*10000+p.month*100+p.day<target)lo=mid+1;else hi=mid}
 const start=new Date(lo*86400000).toISOString().slice(0,10)
 let result=shiftDays(start,day-1)
 while(persian(result).month!==month)result=shiftDays(result,-1)
 return result
}
export function recurrenceDate(start,rule,index){
 const interval=rule.interval||1
 if(rule.frequency==='daily'||rule.frequency==='weekly')return shiftDays(start,index*interval*(rule.frequency==='weekly'?7:1))
 const p=persian(start),months=(rule.frequency==='yearly'?12:1)*interval*index,total=p.year*12+p.month-1+months
 return persianMonth(Math.floor(total/12),total%12+1,p.day)
}
export function occurrences(start,rule,from,to,duration=0){
 if(!rule||rule.frequency==='none')return start<=to&&shiftDays(start,duration)>=from?[start]:[]
 const earliest=shiftDays(from,-duration),delta=Math.max(0,dayDiff(earliest,start))
 let index=0
 if(['daily','weekly'].includes(rule.frequency))index=Math.max(0,Math.floor(delta/((rule.interval||1)*(rule.frequency==='weekly'?7:1)))-1)
 else {const a=persian(start),b=persian(earliest);index=Math.max(0,Math.floor(((b.year-a.year)*12+b.month-a.month)/((rule.interval||1)*(rule.frequency==='yearly'?12:1)))-1)}
 const result=[]
 for(let visited=0;visited<1000;visited++,index++){
  if(rule.count&&index>=rule.count)break
  const value=recurrenceDate(start,rule,index)
  if(value>to||rule.until&&value>rule.until)break
  if(value>=earliest)result.push(value)
 }
 return result
}
export function normalizeCalendarExtras(item={}){
 const recurrence=item.recurrence&&['daily','weekly','monthly','yearly'].includes(item.recurrence.frequency)?{frequency:item.recurrence.frequency,interval:Math.max(1,Math.min(365,Number(item.recurrence.interval)||1)),until:validDate(item.recurrence.until)?item.recurrence.until:null,count:Number.isInteger(item.recurrence.count)&&item.recurrence.count>0?Math.min(1000,item.recurrence.count):null}:null
 return {course_id:String(item.course_id||'').slice(0,100),priority:['low','medium','high'].includes(item.priority)?item.priority:'medium',due_date:validDate(item.due_date)?item.due_date:null,due_time:validTime(item.due_time)?item.due_time:'23:59',reminders:[...new Set(Array.isArray(item.reminders)?item.reminders.filter(n=>Number.isInteger(n)&&n>=0&&n<=10080):[])].slice(0,3),recurrence,
  exceptions:Object.fromEntries(Object.entries(item.exceptions||{}).filter(([date])=>validDate(date)).slice(-2000).map(([date,value])=>[date,{done:value?.done===true,skipped:value?.skipped===true,...(validDate(value?.moved_to)?{moved_to:value.moved_to}:{})}]))}
}
export const calendarExtraSchema={
 course_id:{type:'string',maxLength:100},project_id:{anyOf:[{type:'string',maxLength:100},{type:'null'}]},
 due_date:{anyOf:[{type:'null'},{type:'string'}]},due_time:{type:'string'},priority:{type:'string',enum:['low','medium','high']},
 reminders:{type:'array',maxItems:3,uniqueItems:true,items:{type:'integer',minimum:0,maximum:10080}},
 recurrence:{anyOf:[{type:'null'},{type:'object',additionalProperties:false,required:['frequency'],properties:{frequency:{type:'string',enum:['daily','weekly','monthly','yearly']},interval:{type:'integer',minimum:1,maximum:365},until:{anyOf:[{type:'string'},{type:'null'}]},count:{anyOf:[{type:'integer',minimum:1,maximum:1000},{type:'null'}]}}}]},occurrence_date:{type:'string'}
}
export function validateExtras(body,start,fail){
 if(body.due_date!=null&&!validDate(body.due_date))fail('موعد معتبر وارد کنید.')
 if(body.due_time!==undefined&&!validTime(body.due_time))fail('ساعت موعد معتبر نیست.')
 if(body.occurrence_date!==undefined&&!validDate(body.occurrence_date))fail('تاریخ نوبت معتبر نیست.')
 if(body.recurrence?.until&&(!validDate(body.recurrence.until)||body.recurrence.until<start))fail('پایان تکرار باید بعد از تاریخ شروع باشد.')
}
export function expandCalendarEntry(entry,metadata,from,to){
 const duration=dayDiff(entry.end_date,entry.date),rule=metadata.recurrence
 const {exceptions,...extras}=normalizeCalendarExtras(metadata)
 const moved=Object.entries(metadata.exceptions||{}).filter(([,value])=>validDate(value.moved_to)&&value.moved_to<=to&&shiftDays(value.moved_to,duration)>=from).map(([date])=>date)
 return [...new Set([...occurrences(entry.date,rule,from,to,duration),...moved])].filter(original=>{const exception=metadata.exceptions?.[original],date=exception?.moved_to||original;return !exception?.skipped&&date<=to&&shiftDays(date,duration)>=from}).map(original=>{
  const date=metadata.exceptions?.[original]?.moved_to||original,delta=dayDiff(date,entry.date)
  return {...entry,...extras,due_date:metadata.due_date?shiftDays(metadata.due_date,delta):null,
   key:rule?`${entry.source}:${entry.id}@${original}`:entry.key,series_key:entry.key,date,end_date:shiftDays(date,duration),series_date:entry.date,series_end_date:entry.end_date,series_due_date:metadata.due_date||null,
   done:rule?metadata.exceptions?.[original]?.done===true:entry.done,occurrence_date:rule?original:null,priority:metadata.priority||entry.priority}
 })
}
export function reminderTimes(entry){
 const date=entry.due_date||entry.date,time=entry.due_date?entry.due_time:entry.all_day?'09:00':entry.start_time
 const timestamp=Date.parse(`${date}T${time}:00+03:30`)
 return (entry.reminders||[]).map(minutes=>({key:`${entry.key}:${minutes}:${timestamp}`,at:new Date(timestamp-minutes*60000).toISOString(),minutes}))
}
