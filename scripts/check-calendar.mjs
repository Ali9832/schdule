import assert from 'node:assert/strict'
import Fastify from 'fastify'
import {registerCalendar,normalizeCalendarState} from '../server/calendar.js'

const app=Fastify({logger:false}),people=new Map();let sequence=0
function user(id){if(!people.has(id))people.set(id,{tasks:[],projects:[],outcomes:[],events:[],execution:{calendar:{}}});return people.get(id)}
app.addHook('preHandler',async request=>{request.user={id:request.headers['test-user']||'one'}})
const create=collection=>async(userId,body)=>{const row={id:'test-'+(++sequence),...body};user(userId)[collection].push(row);return row}
const update=collection=>async(userId,id,patch)=>{const row=user(userId)[collection].find(x=>x.id===id);Object.assign(row,patch);return row}
registerCalendar(app,{
  canonical:async id=>user(id),life:async id=>structuredClone(user(id)),saveLife:async(id,value)=>{user(id).execution={...value.execution,calendar:normalizeCalendarState(value.execution.calendar)}},
  createTask:create('tasks'),updateTask:update('tasks'),createProject:create('projects'),updateProject:update('projects'),createEvent:create('events'),updateEvent:update('events'),createOutcome:create('outcomes'),updateOutcome:update('outcomes'),
  deleteEvent:async(userId,id)=>{user(userId).events=user(userId).events.filter(x=>x.id!==id)}
})
async function request(method,url,payload,status=200,headers={}){const response=await app.inject({method,url,payload,headers});assert.equal(response.statusCode,status,response.body);return response.json()}
const list=()=>request('GET','/api/calendar?from=2026-03-01&to=2026-05-31')
try{
  await request('GET','/api/calendar?from=2026-02-30&to=2026-03-01',undefined,400)
  await request('POST','/api/calendar',{title:'Invalid time',kind:'exam',date:'2026-03-21',all_day:false,start_time:'14:00',end_time:'13:00'},400)
  const exam=await request('POST','/api/calendar',{title:'Exam',kind:'exam',date:'2026-03-21',all_day:false,start_time:'14:00',end_time:'16:00',description:'Exam notes'},201)
  let entry=(await list()).entries.find(x=>x.key===exam.key);assert.equal(entry.kind,'exam');assert.equal(entry.start_time,'14:00')
  await request('PATCH',`/api/calendar/event/${exam.id}`,{done:true});assert.equal((await list()).entries[0].done,true)
  await request('PATCH',`/api/calendar/event/${exam.id}`,{date:'2026-03-22',end_date:'2026-03-22',start_time:'15:00',end_time:'17:00',all_day:false,title:'Moved exam'})
  entry=(await list()).entries.find(x=>x.key===exam.key);assert.equal(entry.date,'2026-03-22');assert.equal(entry.kind,'exam');assert.equal(entry.done,true)
  assert.equal((await request('GET','/api/calendar?from=2026-03-01&to=2026-05-31',undefined,200,{'test-user':'two'})).entries.length,0)
  await request('DELETE',`/api/calendar/event/${exam.id}`);assert.equal((await list()).entries.length,0)
  const homework=await request('POST','/api/calendar',{title:'Homework',kind:'homework',date:'2026-03-21',all_day:true},201)
  assert.equal(homework.source,'task');assert.equal(user('one').tasks[0].due_date,'2026-03-21')
  user('one').tasks[0].status='in_progress'
  await request('PATCH',`/api/calendar/task/${homework.id}`,{done:true});assert.equal(user('one').tasks[0].status,'done')
  await request('PATCH',`/api/calendar/task/${homework.id}`,{done:false});assert.equal(user('one').tasks[0].status,'in_progress');assert.equal((await list()).entries[0].kind,'homework')
  await request('DELETE',`/api/calendar/task/${homework.id}`);assert.equal(user('one').tasks.length,1);assert.equal(user('one').tasks[0].due_date,null)
  const project=await request('POST','/api/calendar',{title:'Project',kind:'project',date:'2026-04-01',all_day:true},201)
  await request('PATCH',`/api/calendar/project/${project.id}`,{done:true});assert.equal(user('one').projects[0].status,'done')
  await request('PATCH',`/api/calendar/project/${project.id}`,{done:false});assert.equal(user('one').projects[0].status,'in_progress')
  user('one').events.push({id:'meeting',title:'Meeting',type:'meeting',start_at:'2026-03-25T10:00:00',end_at:'2026-03-25T11:00:00',notes:'NOVA_MEETING::{"decisions":["keep"]}'})
  await request('PATCH','/api/calendar/event/meeting',{done:true,description:'Do not overwrite structure'})
  assert.equal(user('one').events[0].notes,'NOVA_MEETING::{"decisions":["keep"]}');assert.equal((await list()).entries.find(x=>x.id==='meeting').kind,'meeting')
  user('one').events.push({id:'focus',title:'Focus',type:'focus',start_at:'2026-03-25T13:00:00',end_at:'2026-03-25T14:00:00',notes:'{"v115":{"task_id":"linked-task"}}'})
  await request('PATCH','/api/calendar/event/focus',{description:'Keep task link'})
  assert.equal(user('one').events.find(x=>x.id==='focus').notes,'{"v115":{"task_id":"linked-task"}}')
  assert.equal((await list()).entries.find(x=>x.id==='focus').description,'')
  const goal=await request('POST','/api/calendar',{title:'Goal',kind:'goal',date:'2026-03-30',all_day:true},201)
  assert.equal(goal.source,'outcome')
  await request('PATCH',`/api/calendar/outcome/${goal.id}`,{date:'2026-04-02',done:true});assert.equal(user('one').outcomes[0].status,'done')
  await request('DELETE',`/api/calendar/outcome/${goal.id}`);assert.equal(user('one').outcomes[0].due_date,null)
  await request('PATCH','/api/calendar/task/missing',{done:true},404)
  console.log('PASS calendar validation, multi-source CRUD, completion/undo, moving, safe unscheduling, metadata persistence, user isolation and structured-note preservation')
}finally{await app.close()}
