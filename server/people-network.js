import {tehranToday} from './planning-date.js'
import {validDate,occurrences,shiftDays} from './calendar-rules.js'
import {teamProjection} from './project-team.js'
const bad=message=>{throw Object.assign(new Error(message),{statusCode:400})}
export function personExtras(value={}){
  const birthday=value.birthday?String(value.birthday).slice(0,10):null
  if(birthday&&(!validDate(birthday)||birthday>tehranToday()))bad('تاریخ تولد معتبر وارد کنید؛ تاریخ تولد نمی‌تواند در آینده باشد.')
  const raw=value.links??[];if(!Array.isArray(raw)||raw.length>20)bad('حداکثر ۲۰ لینک برای هر فرد مجاز است.')
  const links=raw.map(link=>{if(!link||typeof link.url!=='string'||link.url.length>2000||typeof link.label!=='string'||link.label.length>120)bad('عنوان یا نشانی لینک معتبر نیست.');let url;try{url=new URL(link.url)}catch{bad('نشانی کامل لینک را وارد کنید.')}if(!['https:','http:'].includes(url.protocol))bad('فقط لینک http یا https مجاز است.');return {label:link.label.trim()||url.hostname,url:url.href};})
  return {birthday,links}
}
export function nextPersianAnniversary(date,today=tehranToday()){
  if(!validDate(date))return null
  const next=occurrences(date,{frequency:'yearly',interval:1},today,shiftDays(today,370))[0]
  return next?{date:next,days_until:Math.round((Date.parse(next)-Date.parse(today))/86400000)}:null
}
export function peopleNetworkProjection(canonical,relationships,state){
  const team=teamProjection(canonical,relationships.people,state),taskMap=new Map(canonical.tasks.map(t=>[t.id,t])),today=tehranToday()
  return {today,projects:team.projects.map(p=>({id:p.id,name:p.name,status:p.status,lifecycle_status:p.lifecycle_status,due_date:p.due_date})),people:relationships.people.map(person=>{
    const assigned=team.tasks.filter(t=>t.person_id===person.id),commitments=relationships.commitments.filter(c=>c.person_id===person.id).map(c=>{const task=taskMap.get(c.task_id);return {...c,status:task&&c.status!=='cancelled'?(task.status==='done'?'done':'open'):c.status,task:task?{id:task.id,title:task.title,status:task.status,project_id:task.project_id,due_date:task.due_date}:null};})
    return {...person,...personExtras(person),next_birthday:nextPersianAnniversary(person.birthday,today),next_occasion:nextPersianAnniversary(person.important_date,today),memberships:team.members.filter(m=>m.person_id===person.id),assigned_tasks:assigned,commitments,followup_due:!!person.next_contact_at&&person.next_contact_at<=today,summary:{assigned:assigned.length,done:assigned.filter(t=>t.status==='done').length,overdue:assigned.filter(t=>t.overdue).length,open_commitments:commitments.filter(c=>c.status==='open').length}}
  })}
}
export function registerPeopleNetwork(app,{canonical,relationships,store}){
  app.get('/api/people-network',async request=>{const [data,relations,state]=await Promise.all([canonical(request.user.id),relationships(request.user.id),store.list(request.user.id)]);return peopleNetworkProjection(data,relations,state)})
}
