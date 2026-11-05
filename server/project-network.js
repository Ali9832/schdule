import crypto from 'node:crypto'
import {tehranToday} from './planning-date.js'
import {shiftDays} from './calendar-rules.js'
const fail=(message,statusCode=400)=>{throw Object.assign(new Error(message),{statusCode})}
export function projectNetworkProjection(projectId,canonical,life,state,calendar){
  const project=canonical.projects.find(p=>p.id===projectId);if(!project)fail('پروژه پیدا نشد.',404)
  const courses=life.modules?.academic||[],references={course:courses,resource:canonical.resources||[],outcome:canonical.outcomes||[],event:canonical.events||[]}
  const connections=(state.connections||[]).filter(c=>c.project_id===projectId).map(c=>({...c,item:references[c.target_type]?.find(item=>item.id===c.target_id)})).filter(c=>c.item)
  const tasks=canonical.tasks.filter(t=>t.project_id===projectId),direct=calendar.entries.filter(e=>e.project_id===projectId||e.source==='project'&&e.id===projectId)
  const courseIds=new Set([...connections.filter(c=>c.target_type==='course').map(c=>c.target_id),...direct.map(e=>e.course_id).filter(Boolean)])
  const explicitEvents=new Set(connections.filter(c=>c.target_type==='event').map(c=>c.target_id))
  const entries=calendar.entries.filter(e=>direct.includes(e)||courseIds.has(e.course_id)||e.source==='event'&&explicitEvents.has(e.id)).map(e=>({...e,related_by:direct.includes(e)?'project':explicitEvents.has(e.id)?'connection':'course'}))
  const linked=(type,list)=>list.filter(item=>connections.some(c=>c.target_type===type&&c.target_id===item.id)||(canonical.links||[]).some(l=>l.source_type==='project'&&l.source_id===projectId&&l.target_type===type&&l.target_id===item.id||l.target_type==='project'&&l.target_id===projectId&&l.source_type===type&&l.source_id===item.id))
  return {project,connections,references:Object.fromEntries(Object.entries(references).map(([type,rows])=>[type,rows.map(row=>({id:row.id,title:row.title||row.name}))])),summary:{tasks:tasks.length,done:tasks.filter(t=>t.status==='done').length,subtasks:tasks.filter(t=>t.parent_task_id&&tasks.some(p=>p.id===t.parent_task_id)).length,overdue:tasks.filter(t=>t.status!=='done'&&t.due_date&&t.due_date<calendar.today).length},courses:courses.filter(c=>courseIds.has(c.id)),resources:linked('resource',canonical.resources||[]),outcomes:linked('outcome',canonical.outcomes||[]),calendar:{from:calendar.from,to:calendar.to,entries},today:calendar.today}
}
export function registerProjectNetwork(app,{canonical,life,store,calendar}){
  async function context(userId){const today=tehranToday(),from=shiftDays(today,-30),to=shiftDays(today,365);const [data,personal,state,entries]=await Promise.all([canonical(userId),life(userId),store.list(userId),calendar(userId,from,to)]);return {data,personal,state,calendar:{...entries,today}}}
  app.get('/api/projects/:id/network',async request=>{const c=await context(request.user.id);return projectNetworkProjection(request.params.id,c.data,c.personal,c.state,c.calendar)})
  app.post('/api/projects/:id/connections',async(request,reply)=>{const c=await context(request.user.id),data=projectNetworkProjection(request.params.id,c.data,c.personal,c.state,c.calendar),body=request.body||{};if(!Array.isArray(data.references[body.target_type])||!data.references[body.target_type].some(item=>item.id===body.target_id))fail('مورد مرتبط را از اطلاعات همین حساب انتخاب کنید.');const row=await store.addConnection({id:crypto.randomUUID(),user_id:request.user.id,project_id:data.project.id,target_type:body.target_type,target_id:body.target_id,created_at:new Date().toISOString()});if(!row)fail('این ارتباط قبلاً ثبت شده است.',409);return reply.code(201).send(row)})
  app.delete('/api/projects/:id/connections/:connectionId',async request=>{const c=await context(request.user.id);if(!c.data.projects.some(p=>p.id===request.params.id))fail('پروژه پیدا نشد.',404);if(!await store.removeConnection(request.user.id,request.params.id,request.params.connectionId))fail('ارتباط پیدا نشد.',404);return {ok:true}})
}
