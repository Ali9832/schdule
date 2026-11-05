import crypto from 'node:crypto'
import {tehranToday} from './planning-date.js'
const fail=(message,statusCode=400)=>{throw Object.assign(new Error(message),{statusCode})}
function date(value){if(value==null||value==='')return null;if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value)fail('مهلت معتبر وارد کنید.');return value}
function values(body,current={}){
  const next={...current};for(const [key,max] of [['responsibility',500],['notes',4000]]){if(body[key]!==undefined){if(typeof body[key]!=='string'||body[key].length>max)fail('توضیحات مسئولیت معتبر نیست.');next[key]=body[key].trim();}next[key]??='';}
  next.due_date=body.due_date!==undefined?date(body.due_date):current.due_date||null;next.status=body.status??current.status??'active';if(!['active','done'].includes(next.status))fail('وضعیت مسئولیت معتبر نیست.');return next
}
export function teamProjection(canonical,people,state){
  const projectMap=new Map(canonical.projects.map(p=>[p.id,p])),personMap=new Map(people.map(p=>[p.id,p])),today=tehranToday();
  const members=state.members.filter(m=>projectMap.has(m.project_id)&&personMap.has(m.person_id));
  const memberKeys=new Set(members.map(m=>m.project_id+':'+m.person_id));
  const assigned=new Map(state.assignees.filter(a=>memberKeys.has(a.project_id+':'+a.person_id)).map(a=>[a.task_id,a]));
  const tasks=canonical.tasks.filter(t=>projectMap.has(t.project_id)).map(t=>({...t,person_id:assigned.get(t.id)?.project_id===t.project_id?assigned.get(t.id).person_id:null,overdue:t.status!=='done'&&!!t.due_date&&t.due_date<today}));
  return {projects:canonical.projects,people:people.map(p=>({id:p.id,name:p.name,status:p.status,organization:p.organization||''})),tasks,members:members.map(m=>{const rows=tasks.filter(t=>t.project_id===m.project_id&&t.person_id===m.person_id);return {...m,person_name:personMap.get(m.person_id).name,person_status:personMap.get(m.person_id).status,project_name:projectMap.get(m.project_id).name,task_count:rows.length,done_count:rows.filter(t=>t.status==='done').length,overdue_count:rows.filter(t=>t.overdue).length,responsibility_overdue:m.status!=='done'&&!!m.due_date&&m.due_date<today};}),today}
}
export function registerProjectTeam(app,{canonical,people,store}){
  async function context(userId){const [data,persons,state]=await Promise.all([canonical(userId),people(userId),store.list(userId)]);return {data,persons,state}}
  function project(ctx,id){const p=ctx.data.projects.find(p=>p.id===id);if(!p)fail('پروژه پیدا نشد.',404);return p}
  function member(ctx,projectId,id){const m=ctx.state.members.find(m=>m.id===id&&m.project_id===projectId);if(!m)fail('مسئولیت پیدا نشد.',404);return m}
  function version(body,current){if(!Number.isInteger(body?.version)||body.version!==current.version)fail('این مسئولیت تغییر کرده است؛ فهرست را دوباره دریافت کنید.',409)}
  app.get('/api/project-team',async request=>{const c=await context(request.user.id);return teamProjection(c.data,c.persons,c.state)})
  app.get('/api/projects/:id/team',async request=>{const c=await context(request.user.id),p=project(c,request.params.id),all=teamProjection(c.data,c.persons,c.state);return {project:p,people:all.people,members:all.members.filter(m=>m.project_id===p.id),tasks:all.tasks.filter(t=>t.project_id===p.id),today:all.today}})
  app.get('/api/project-team/people/:id',async request=>{const c=await context(request.user.id),p=c.persons.find(p=>p.id===request.params.id);if(!p)fail('فرد پیدا نشد.',404);const all=teamProjection(c.data,c.persons,c.state);return {person:{id:p.id,name:p.name},projects:all.projects,members:all.members.filter(m=>m.person_id===p.id),tasks:all.tasks.filter(t=>t.person_id===p.id),today:all.today}})
  app.post('/api/projects/:id/members',async(request,reply)=>{
    const c=await context(request.user.id),p=project(c,request.params.id),body=request.body||{},person=c.persons.find(p=>p.id===body.person_id&&p.status!=='archived');if(!person)fail('فرد فعال را از فهرست روابط انتخاب کنید.');const now=new Date().toISOString();
    const row=await store.create({...values(body),id:crypto.randomUUID(),user_id:request.user.id,project_id:p.id,person_id:person.id,version:1,created_at:now,updated_at:now});if(!row)fail('این فرد قبلاً به پروژه تخصیص داده شده است؛ مسئولیت موجود را ویرایش کنید.',409);return reply.code(201).send(row)
  })
  app.patch('/api/projects/:id/members/:memberId',async request=>{const c=await context(request.user.id);project(c,request.params.id);const current=member(c,request.params.id,request.params.memberId);version(request.body,current);const row=await store.update({...values(request.body,current),version:current.version+1,updated_at:new Date().toISOString()},current.version);if(!row)fail('مسئولیت هم‌زمان تغییر کرده است؛ دوباره دریافت کنید.',409);return row})
  app.delete('/api/projects/:id/members/:memberId',async request=>{const c=await context(request.user.id);project(c,request.params.id);const current=member(c,request.params.id,request.params.memberId);version(request.body,current);if(!await store.remove(request.user.id,current.project_id,current.id,current.version))fail('مسئولیت هم‌زمان تغییر کرده است؛ دوباره دریافت کنید.',409);return {ok:true}})
  app.put('/api/projects/:id/tasks/:taskId/assignee',async request=>{
    const c=await context(request.user.id),p=project(c,request.params.id),task=c.data.tasks.find(t=>t.id===request.params.taskId&&t.project_id===p.id);if(!task)fail('کار این پروژه پیدا نشد.',404);
    const personId=request.body?.person_id;if(personId!==null&&(!c.persons.some(x=>x.id===personId&&x.status!=='archived')||!c.state.members.some(m=>m.project_id===p.id&&m.person_id===personId)))fail('مسئول کار باید از اعضای همین پروژه باشد.');
    await store.assign(request.user.id,p.id,task.id,personId);return {task_id:task.id,person_id:personId}
  })
}
