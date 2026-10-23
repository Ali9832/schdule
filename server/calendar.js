import {calendarExtraSchema,normalizeCalendarExtras,validateExtras,expandCalendarEntry,occurrences,shiftDays,reminderTimes} from './calendar-rules.js'
export const calendarKinds=['task','meeting','exam','quiz','class','homework','study','project','personal','religious','appointment','goal','focus','review']
export function normalizeCalendarState(value){
  if(!value||typeof value!=='object'||Array.isArray(value))return {}
  return Object.fromEntries(Object.entries(value).filter(([key])=>/^(task|event|project|outcome):[\w-]{1,100}$/.test(key)).slice(-20000).map(([key,item])=>[key,{
    ...normalizeCalendarExtras(item),kind:calendarKinds.includes(item?.kind)?item.kind:'personal',done:item?.done===true,all_day:item?.all_day!==false,
    start_time:/^\d{2}:\d{2}$/.test(item?.start_time||'')?item.start_time:'09:00',end_time:/^\d{2}:\d{2}$/.test(item?.end_time||'')?item.end_time:'10:00',
    color:/^#[\da-f]{6}$/i.test(item?.color||'')?item.color:'',previous_status:String(item?.previous_status||'').slice(0,40)
  }]))
}
const validDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(value||'')&&!Number.isNaN(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value
const validTime=value=>/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value||'')
const fail=message=>{const error=new Error(message);error.statusCode=400;throw error}
const structuredNotes=value=>{if(String(value||'').startsWith('NOVA_'))return true;try{return !!JSON.parse(String(value||''))?.v115}catch{return false}}
export function registerCalendar(app,deps){
  const {canonical,life,saveLife,createTask,updateTask,createProject,updateProject,createEvent,updateEvent,deleteEvent,createOutcome,updateOutcome}=deps
  const schema={type:'object',additionalProperties:false,properties:{...calendarExtraSchema,title:{type:'string',minLength:1,maxLength:200},kind:{type:'string',enum:calendarKinds},date:{type:'string'},end_date:{type:'string'},start_time:{type:'string'},end_time:{type:'string'},all_day:{type:'boolean'},done:{type:'boolean'},description:{type:'string',maxLength:4000},color:{type:'string',pattern:'^#[a-fA-F0-9]{6}$'},priority:{type:'string',enum:['low','medium','high']}}}
  async function state(userId){return normalizeCalendarState((await life(userId)).execution?.calendar)}
  async function saveState(userId,key,patch){const current=await life(userId),calendar=normalizeCalendarState(current.execution?.calendar);if(patch===null)delete calendar[key];else calendar[key]={...(calendar[key]||{}),...patch};await saveLife(userId,{...current,execution:{...current.execution,calendar}})}
  async function find(userId,source,id){const data=await canonical(userId);const entity=({task:data.tasks,event:data.events,project:data.projects,outcome:data.outcomes}[source]||[]).find(item=>item.id===id);if(!entity){const error=new Error('آیتم پیدا نشد.');error.statusCode=404;throw error}return entity}
  async function list(userId,from,to,forReminders=false){
    if(!validDate(from)||!validDate(to)||to<from||(Date.parse(to)-Date.parse(from))/86400000>800)fail('بازهٔ تاریخ معتبر انتخاب کنید.')
    const [data,metadata]=await Promise.all([canonical(userId),state(userId)]),entries=[];
    const add=(source,entity,kind,date,endDate,description,extra={})=>{
      if(!validDate(date))return;const key=source+':'+entity.id,meta=metadata[key]||{};
      const entry={key,source,id:entity.id,title:entity.title||entity.name,kind:meta?.kind||kind,date,end_date:endDate||date,
        all_day:source==='event'?meta?.all_day??false:meta?.all_day??true,start_time:source==='event'?String(entity.start_at).slice(11,16):meta?.start_time||'09:00',end_time:source==='event'?String(entity.end_at||entity.start_at).slice(11,16):meta?.end_time||'10:00',
        done:source==='task'?entity.status==='done':source==='project'?entity.status==='done':source==='outcome'?entity.status==='done':meta?.done||false,
        description:description||'',project_id:entity.project_id||null,color:meta?.color||'',priority:entity.priority||meta.priority||'medium',...extra};
      const offset=forReminders&&meta.due_date?Math.round((Date.parse(meta.due_date)-Date.parse(date))/86400000):0;
      entries.push(...expandCalendarEntry(entry,{...meta,priority:source==='task'?entity.priority||meta.priority:meta.priority||entity.priority},shiftDays(from,-offset),shiftDays(to,-offset)))
    }
    for(const event of data.events)add('event',event,calendarKinds.includes(event.type)?event.type:'personal',String(event.start_at).slice(0,10),String(event.end_at||event.start_at).slice(0,10),structuredNotes(event.notes)?'':event.notes)
    for(const task of data.tasks)add('task',task,'task',task.due_date,task.due_date,task.description)
    for(const project of data.projects)add('project',project,'project',project.due_date,project.due_date,project.description)
    for(const outcome of data.outcomes||[])add('outcome',outcome,'goal',outcome.due_date,outcome.due_date,outcome.note)
    entries.sort((a,b)=>a.date.localeCompare(b.date)||Number(b.all_day)-Number(a.all_day)||a.start_time.localeCompare(b.start_time)||a.title.localeCompare(b.title,'fa'))
    if(entries.length>10000)fail('تعداد نوبت‌ها زیاد است؛ بازهٔ کوتاه‌تری انتخاب کنید.')
    return {from,to,entries}
  }
  app.get('/api/calendar',async request=>list(request.user.id,request.query?.from,request.query?.to))
  app.get('/api/calendar/reminders',async request=>{
    const now=Date.now(),today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).format(now)
    const result=await list(request.user.id,shiftDays(today,-7),shiftDays(today,8),true)
    return {reminders:result.entries.filter(entry=>!entry.done).flatMap(entry=>reminderTimes(entry).filter(reminder=>Date.parse(reminder.at)>=now-3600000&&Date.parse(reminder.at)<=now+86400000).map(reminder=>({...reminder,title:entry.title,date:entry.date,source:entry.source,id:entry.id}))).sort((a,b)=>a.at.localeCompare(b.at)).slice(0,100)}
  })
  function validate(body,current=null){
    validateExtras(body,body.date||String(current?.start_at||current?.due_date||'').slice(0,10),fail)
    if(body.title!==undefined&&!body.title.trim())fail('عنوان را وارد کنید.')
    if(body.date!==undefined&&!validDate(body.date))fail('تاریخ معتبر وارد کنید.')
    if(body.end_date!==undefined&&!validDate(body.end_date))fail('تاریخ پایان معتبر نیست.')
    for(const key of ['start_time','end_time'])if(body[key]!==undefined&&!validTime(body[key]))fail('ساعت باید بین ۰۰:۰۰ تا ۲۳:۵۹ باشد.')
    const start=body.date||String(current?.start_at||current?.due_date||'').slice(0,10),end=body.end_date||start;
    if(end&&start&&end<start)fail('پایان نمی‌تواند قبل از شروع باشد.')
    if(body.all_day===false&&end===start&&(body.end_time||'10:00')<=(body.start_time||'09:00'))fail('ساعت پایان باید بعد از شروع باشد.')
  }
  app.post('/api/calendar',{schema:{body:{...schema,required:['title','date','kind']}}},async(request,reply)=>{
    const body=request.body,userId=request.user.id;validate(body);const kind=body.kind;let entity,source;
    await validateLinks(userId,body);
    if(['task','homework'].includes(kind)){source='task';entity=await createTask(userId,{title:body.title.trim(),description:body.description||'',due_date:body.date,priority:body.priority||'medium',status:body.done?'done':'todo',project_id:body.project_id||null,category:kind==='homework'?'تکالیف':'شخصی'})}
    else if(kind==='project'){source='project';entity=await createProject(userId,{name:body.title.trim(),description:body.description||'',due_date:body.date,status:body.done?'done':'in_progress'})}
    else if(kind==='goal'){source='outcome';entity=await createOutcome(userId,{title:body.title.trim(),note:body.description||'',due_date:body.date,status:body.done?'done':'active'})}
    else{source='event';entity=await createEvent(userId,{title:body.title.trim(),project_id:body.project_id||null,type:['meeting','religious','appointment','focus','review'].includes(kind)?kind:'personal',start_at:`${body.date}T${body.all_day!==false?'00:00':body.start_time||'09:00'}:00`,end_at:`${body.end_date||body.date}T${body.all_day!==false?'23:59':body.end_time||'10:00'}:00`,notes:body.description||'',color:body.color||'#268874'})}
    await saveState(userId,source+':'+entity.id,{...normalizeCalendarExtras(body),kind,all_day:body.all_day!==false,done:body.done===true,start_time:body.start_time||'09:00',end_time:body.end_time||'10:00',color:body.color||''})
    return reply.code(201).send({source,id:entity.id,key:source+':'+entity.id})
  })
  app.patch('/api/calendar/:source/:id',{schema:{body:schema}},async request=>{
    const {source,id}=request.params,userId=request.user.id,current=await find(userId,source,id),body=request.body,metadata=await state(userId),key=source+':'+id,old=metadata[key]||{},previousStatus=current.status;validate(body,current)
    if(body.occurrence_date){
      const start=String(current.start_at||current.due_date||'').slice(0,10)
      if(!old.recurrence||!occurrences(start,old.recurrence,body.occurrence_date,body.occurrence_date).length)fail('این نوبت در مجموعه وجود ندارد.')
      if(Object.keys(body).some(key=>!['occurrence_date','done'].includes(key)))fail('ویرایش مشخصات از طریق مجموعه انجام می‌شود.')
      await saveState(userId,key,{exceptions:{...old.exceptions,[body.occurrence_date]:{...old.exceptions?.[body.occurrence_date],done:body.done===true}}});return {ok:true}
    }
    await validateLinks(userId,body);
    const patch={};if(body.project_id!==undefined&&['task','event'].includes(source))patch.project_id=body.project_id||null;if(body.title!==undefined)patch[source==='project'?'name':'title']=body.title.trim();if(body.description!==undefined)patch[source==='event'?'notes':source==='outcome'?'note':'description']=body.description;
    if(source==='event'){
      const date=body.date||String(current.start_at).slice(0,10),endDate=body.end_date||body.date||String(current.end_at||current.start_at).slice(0,10),allDay=body.all_day??old.all_day??false;
      if(['date','end_date','start_time','end_time','all_day'].some(key=>body[key]!==undefined)){
        patch.start_at=`${date}T${allDay?'00:00':body.start_time||String(current.start_at).slice(11,16)}:00`;patch.end_at=`${endDate}T${allDay?'23:59':body.end_time||String(current.end_at||current.start_at).slice(11,16)}:00`;
        if(patch.end_at<=patch.start_at)fail('پایان باید بعد از شروع باشد.')
      }
      // Keep structured notes used by meeting and religious workflows intact.
      if(structuredNotes(current.notes))delete patch.notes;
      if(Object.keys(patch).length)await updateEvent(userId,id,patch)
    }else{
      if(body.date!==undefined)patch.due_date=body.date;
      if(source==='task'&&body.priority)patch.priority=body.priority;
      if(body.done!==undefined)patch.status=body.done?'done':old.previous_status&&old.previous_status!=='done'?old.previous_status:source==='project'?'in_progress':source==='outcome'?'active':'todo';
      if(Object.keys(patch).length)await({task:updateTask,project:updateProject,outcome:updateOutcome}[source])(userId,id,patch)
    }
    const change={kind:source==='task'?'task':source==='project'?'project':source==='outcome'?'goal':calendarKinds.includes(current.type)?current.type:'personal',all_day:source!=='event',...old};for(const key of ['kind','done','all_day','start_time','end_time','color','priority','due_date','due_time','reminders','recurrence','course_id'])if(body[key]!==undefined)change[key]=body[key];if(body.done===true&&previousStatus!=='done')change.previous_status=previousStatus||'';
    if(body.recurrence!==undefined&&JSON.stringify(normalizeCalendarExtras(body).recurrence)!==JSON.stringify(old.recurrence)||body.date!==undefined&&body.date!==String(current.start_at||current.due_date||'').slice(0,10))change.exceptions={};
    await saveState(userId,key,change);return {ok:true}
  })
  async function validateLinks(userId,body){
    if(body.project_id)await find(userId,'project',body.project_id);
    if(body.course_id&&!(await life(userId)).modules?.academic?.some(course=>course.id===body.course_id))fail('درس مرتبط پیدا نشد.');
  }
  const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  app.get('/api/calendar/overdue',async request=>{
    const to=shiftDays(today(),-1),from=shiftDays(to,-729),result=await list(request.user.id,from,to);
    return {from,to,entries:result.entries.filter(item=>!item.done&&item.end_date<today())};
  });
  app.post('/api/calendar/:source/:id/carry-forward',async request=>{
    const userId=request.user.id,{source,id}=request.params,current=await find(userId,source,id),metadata=await state(userId),key=source+':'+id,old=metadata[key]||{},occurrence=request.body?.occurrence_date,start=String(current.start_at||current.due_date||'').slice(0,10),target=today();
    if(old.recurrence){
      if(!validDate(occurrence)||!occurrences(start,old.recurrence,occurrence,occurrence).length)fail('نوبت معتبر انتخاب کنید.');
      const exception=old.exceptions?.[occurrence]||{};
      if((exception.moved_to||occurrence)>=target||exception.done||exception.skipped)fail('این نوبت عقب‌افتاده نیست.');
      await saveState(userId,key,{exceptions:{...old.exceptions,[occurrence]:{...exception,moved_to:target}}});
    }else{
      if(!validDate(start)||start>=target||old.done||current.status==='done')fail('این آیتم عقب‌افتاده نیست.');
      if(source==='event'){
        const duration=Math.round((Date.parse(String(current.end_at||current.start_at).slice(0,10))-Date.parse(start))/86400000);
        if(shiftDays(start,duration)>=target)fail('برنامه هنوز پایان نیافته است.');
        await updateEvent(userId,id,{start_at:target+String(current.start_at).slice(10),end_at:shiftDays(target,duration)+String(current.end_at||current.start_at).slice(10)});
      }else await({task:updateTask,project:updateProject,outcome:updateOutcome}[source])(userId,id,{due_date:target});
      if(old.due_date)await saveState(userId,key,{due_date:shiftDays(old.due_date,Math.round((Date.parse(target)-Date.parse(start))/86400000))});
    }
    return {ok:true,date:target};
  });
  app.delete('/api/calendar/:source/:id',async request=>{
    const {source,id}=request.params,userId=request.user.id;await find(userId,source,id)
    if(request.query?.occurrence_date){
      const entity=await find(userId,source,id),metadata=await state(userId),old=metadata[source+':'+id]||{},date=request.query.occurrence_date,start=String(entity.start_at||entity.due_date||'').slice(0,10)
      if(!validDate(date)||!old.recurrence||!occurrences(start,old.recurrence,date,date).length)fail('تاریخ نوبت معتبر نیست.')
      await saveState(userId,source+':'+id,{exceptions:{...old.exceptions,[date]:{...old.exceptions?.[date],skipped:true}}});return {ok:true,mode:'occurrence-skipped'}
    }
    if(source==='event'){await deleteEvent(userId,id);await deps.removeAttachments?.(userId,source,id)}else await({task:updateTask,project:updateProject,outcome:updateOutcome}[source])(userId,id,{due_date:null})
    await saveState(userId,source+':'+id,null);return {ok:true,mode:source==='event'?'deleted':'unscheduled'}
  })
}
