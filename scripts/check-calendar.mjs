import assert from 'node:assert/strict'
import Fastify from 'fastify'
import {registerCalendar,normalizeCalendarState} from '../server/calendar.js'
import {registerCalendarAttachments} from '../server/calendar-attachments.js'
import {recurrenceDate,reminderTimes} from '../server/calendar-rules.js'

const app=Fastify({logger:false}),people=new Map();let sequence=0
function user(id){if(!people.has(id))people.set(id,{tasks:[],projects:[],outcomes:[],events:[],execution:{calendar:{}}});return people.get(id)}
app.addHook('preHandler',async request=>{request.user={id:request.headers['test-user']||'one'}})
const files=new Map()
registerCalendarAttachments(app,{canonical:async id=>user(id),store:{
 list:async(userId,source,id)=>[...files.values()].filter(row=>row.user_id===userId&&row.source===source&&row.entity_id===id),
 put:async row=>files.set(row.id,row),
 get:async(userId,source,id,key)=>{const row=files.get(key);return row?.user_id===userId&&row.source===source&&row.entity_id===id?row:null},
 remove:async(userId,source,id,key)=>{const row=files.get(key);if(row?.user_id===userId&&row.source===source&&row.entity_id===id)files.delete(key)}
}})
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
  const repeat=await request('POST','/api/calendar',{title:'Repeated exam',kind:'exam',date:'2026-03-21',all_day:false,start_time:'10:00',end_time:'11:00',due_date:'2026-03-22',due_time:'12:00',priority:'high',reminders:[15,60],recurrence:{frequency:'weekly',interval:2,count:3,until:null}},201)
  let repeated=(await list()).entries.filter(row=>row.id===repeat.id)
  assert.deepEqual(repeated.map(row=>row.date),['2026-03-21','2026-04-04','2026-04-18'])
  assert.deepEqual(repeated.map(row=>row.due_date),['2026-03-22','2026-04-05','2026-04-19'])
  assert.ok(repeated.every(row=>row.priority==='high'&&row.reminders.length===2))
  assert.equal(reminderTimes(repeated[0])[0].at,'2026-03-22T08:15:00.000Z')
  await request('PATCH',`/api/calendar/event/${repeat.id}`,{occurrence_date:'2026-04-04',done:true})
  repeated=(await list()).entries.filter(row=>row.id===repeat.id)
  assert.deepEqual(repeated.map(row=>row.done),[false,true,false])
  await request('PATCH',`/api/calendar/event/${repeat.id}`,{title:'Updated series',date:'2026-03-21'})
  assert.equal((await list()).entries.find(row=>row.id===repeat.id&&row.date==='2026-04-04').done,true)
  await request('DELETE',`/api/calendar/event/${repeat.id}?occurrence_date=2026-04-18`)
  assert.equal((await list()).entries.filter(row=>row.id===repeat.id).length,2)
  await request('PATCH',`/api/calendar/event/${repeat.id}`,{occurrence_date:'2026-04-05',done:true},400)
  await request('POST','/api/calendar',{title:'Bad recurrence',kind:'task',date:'2026-03-21',recurrence:{frequency:'daily',until:'2026-02-01'}},400)
  await request('POST','/api/calendar',{title:'Bad reminder',kind:'task',date:'2026-03-21',reminders:[-1]},400)
  const noDeadline=await request('POST','/api/calendar',{title:'No optional deadline',kind:'exam',date:'2026-03-21',due_date:null,recurrence:null,reminders:[]},201)
  assert.equal((await list()).entries.find(row=>row.id===noDeadline.id).due_date,null)
  for(const kind of ['task','homework','project','goal','meeting','exam','class','study','personal','religious','appointment','focus','review']){
    const created=await request('POST','/api/calendar',{title:'Recurring '+kind,kind,date:'2026-04-01',due_date:'2026-04-02',priority:'high',reminders:[0],recurrence:{frequency:'daily',count:2}},201)
    const rows=(await list()).entries.filter(row=>row.id===created.id&&row.source===created.source)
    assert.equal(rows.length,2,kind);assert.ok(rows.every(row=>row.priority==='high'&&row.recurrence.frequency==='daily'&&row.reminders[0]===0),kind)
  }
  assert.equal(recurrenceDate('2026-03-21',{frequency:'monthly'},1),'2026-04-21')
  assert.equal(recurrenceDate('2026-08-22',{frequency:'monthly'},2),'2026-10-22')
  assert.equal(recurrenceDate('2026-03-21',{frequency:'yearly'},1),'2027-03-21')
  const daily=await request('POST','/api/calendar',{title:'Long lived',kind:'personal',date:'2000-01-01',recurrence:{frequency:'daily'}},201)
  assert.equal((await request('GET','/api/calendar?from=2050-01-01&to=2050-01-03')).entries.filter(row=>row.id===daily.id).length,3)
  const png={name:'small.png',type:'image/png',data:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7ksAAAAASUVORK5CYII='}
  const attachmentPath=`/api/calendar/event/${repeat.id}/attachments`
  const attachment=await request('POST',attachmentPath,png,201)
  const attachmentList=await request('GET',attachmentPath)
  assert.equal(attachmentList.attachments.length,1);assert.equal(attachmentList.attachments[0].bytes,undefined)
  const media=await app.inject({method:'GET',url:attachmentPath+'/'+attachment.id})
  assert.equal(media.statusCode,200);assert.equal(media.headers['content-type'],'image/png');assert.deepEqual(media.rawPayload,Buffer.from(png.data,'base64'))
  await request('GET',attachmentPath+'/'+attachment.id,undefined,404,{'test-user':'two'})
  await request('POST',attachmentPath,{...png,type:'image/svg+xml'},400)
  await request('POST',attachmentPath,{...png,data:Buffer.from('not an image').toString('base64')},400)
  await request('POST',attachmentPath,{...png,data:Buffer.alloc(2097153).toString('base64')},400)
  const audio=await request('POST',attachmentPath,{name:'voice.mp3',type:'audio/mpeg',data:Buffer.from('ID3example audio').toString('base64')},201)
  assert.equal(audio.type,'audio/mpeg')
  await request('DELETE',attachmentPath+'/'+audio.id);await request('DELETE',attachmentPath+'/'+attachment.id)
  assert.equal((await request('GET',attachmentPath)).attachments.length,0)
  assert.ok(Array.isArray((await request('GET','/api/calendar/reminders')).reminders))
  const future=new Date(Date.now()+30*60000),dueDate=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).format(future),dueTime=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Tehran',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(future)
  const independent=await request('POST','/api/calendar',{title:'Independent deadline reminder',kind:'personal',date:'2000-01-01',due_date:dueDate,due_time:dueTime,reminders:[15]},201)
  assert.ok((await request('GET','/api/calendar/reminders')).reminders.some(row=>row.id===independent.id),'deadline reminders must work even when the event start is outside the reminder window')
  console.log('PASS recurrence for all 13 kinds, Persian month/year boundaries, per-occurrence state, deadlines, priority, reminder times, private image/audio attachments and size/type validation')
  console.log('PASS calendar validation, multi-source CRUD, completion/undo, moving, safe unscheduling, metadata persistence, user isolation and structured-note preservation')
}finally{await app.close()}
