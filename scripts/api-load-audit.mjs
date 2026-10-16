import fs from 'node:fs'
import assert from 'node:assert/strict'
import {performance} from 'node:perf_hooks'
const base=process.env.NOVA_BASE_URL||'http://127.0.0.1:3002'
if(!base.endsWith(':3002'))throw new Error('This audit writes test records and must run on the isolated test server at port 3002.')
const results=[]
async function request(path,method='GET',body){
 const response=await fetch(base+path,{method,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)})
 const text=await response.text();let data;try{data=JSON.parse(text)}catch{data=text}
 return {status:response.status,data}
}
async function api(path,method='GET',body){const response=await request(path,method,body);assert.ok(response.status>=200&&response.status<300,`${method} ${path}: ${response.status} ${JSON.stringify(response.data).slice(0,220)}`);return response.data}
async function check(name,fn){try{await fn();results.push({name,passed:true});console.log('PASS',name)}catch(error){results.push({name,passed:false,error:error.message});console.log('FAIL',name,error.message)}}
const routes=[...fs.readFileSync('server/index.js','utf8').matchAll(/app\.get\(\s*['"]([^'"]+)['"]/g)].map(match=>match[1]).filter(path=>!path.includes(':'))
for(const route of routes)await check('GET '+route,()=>api(route))
const today=(await api('/api/v11.2/dashboard')).today
const mark='AUDIT '+Date.now()
async function crud(path,payload,patch,key='title'){
 await check('CRUD '+path,async()=>{const created=await api(path,'POST',payload);assert.ok(created.id);const updated=await api(path+'/'+created.id,'PATCH',patch);assert.equal(updated[key],patch[key]);await api(path+'/'+created.id,'DELETE')})
}
await crud('/api/tasks',{title:mark,status:'todo',due_date:today},{title:mark+' edited',status:'done'})
await crud('/api/projects',{name:mark},{name:mark+' edited'},'name')
await crud('/api/events',{title:mark,type:'personal',start_at:today+'T10:00:00',end_at:today+'T11:00:00'},{title:mark+' edited'})
await crud('/api/goals',{title:mark,target_value:10},{title:mark+' edited',current_value:5})
await crud('/api/habits',{title:mark,target_weekly:5},{title:mark+' edited'})
await crud('/api/weekly-plan',{title:mark,day:'جمعه',start:'12:00',end:'13:00'},{title:mark+' edited'})
await crud('/api/ideas',{title:mark},{title:mark+' edited'})
await crud('/api/daily-logs',{date:'2026-10-01',note:mark},{note:mark+' edited'},'note')
await crud('/api/finance/accounts',{name:mark,balance:100},{name:mark+' edited'},'name')
await crud('/api/finance/transactions',{description:mark,type:'income',amount:100,date:today},{description:mark+' edited'},'description')
await crud('/api/finance/debts',{title:mark,amount:100},{title:mark+' edited'})
await crud('/api/modules/review/items',{title:mark},{title:mark+' edited',done:true})
await check('Habit toggle visible in logs and matrix',async()=>{const habit=await api('/api/habits','POST',{title:mark+' habit'});await api('/api/habits/'+habit.id+'/toggle','POST',{date:today});const list=await api('/api/habits');assert.equal(list.find(row=>row.id===habit.id).logs[today],true);await api('/api/habits/'+habit.id,'DELETE')})
await check('Meeting action creates a task and completion returns to meeting',async()=>{
 const meeting=await api('/api/v11.6/meetings','POST',{title:mark+' meeting',start_at:today+'T13:00:00',end_at:today+'T14:00:00',actions:[{text:mark+' meeting action',due_date:today}]})
 const row=meeting.payload.items.find(row=>row.id===meeting.meeting.id);const action=row.details.actions[0]
 const result=await api(`/api/v11.6/meetings/${row.id}/actions/${action.id}/task`,'POST',{})
 await api('/api/tasks/'+result.task.id,'PATCH',{status:'done'})
 const updated=await api('/api/v11.6/meetings');assert.equal(updated.items.find(item=>item.id===row.id).details.actions[0].status,'done')
})
await check('Spiritual routine shares habit log',async()=>{
 const before=await api('/api/habits');await api('/api/v11.11/spiritual-routines','POST',{title:mark+' spiritual',target_weekly:3})
 const list=await api('/api/habits');const habit=list.find(habit=>habit.title===mark+' spiritual');assert.ok(habit);assert.equal(list.length,before.length+1)
 await api('/api/v11.11/spiritual-routines/'+habit.id+'/toggle','POST',{date:today,done:true})
 assert.equal((await api('/api/habits')).find(row=>row.id===habit.id).logs[today],true)
})
await check('Relationship follow-up links to task completion',async()=>{
 const people=await api('/api/v11.10/people','POST',{name:mark+' person',cadence_days:7});const person=people.people.find(person=>person.name===mark+' person');assert.ok(person)
 const linked=await api('/api/v11.10/people/'+person.id+'/follow-up-task','POST',{title:mark+' followup',due_date:today});assert.ok(linked.task.id)
 await api('/api/tasks/'+linked.task.id,'PATCH',{status:'done'})
 const updated=await api('/api/v11.10/relationships');assert.equal(updated.commitments.find(row=>row.id===linked.commitment.id).status,'done')
})
await check('Health daily check-in stored',async()=>{await api('/api/v11.9/checkin','POST',{date:today,energy:7,sleep_hours:8,movement_minutes:30});const data=await api('/api/v11.9/health-system');assert.ok(JSON.stringify(data).includes(today))})
await check('Resource converts into task',async()=>{
 const created=await api('/api/v11.8/resources','POST',{title:mark+' resource',resource_type:'note'})
 const resource=(await api('/api/v11.8/learning')).items.find(item=>item.title===mark+' resource');assert.ok(resource)
 const action=await api('/api/v11.8/resources/'+resource.id+'/create-action','POST',{title:mark+' resource action'});assert.ok(action.task?.id)
 assert.ok((await api('/api/tasks')).some(task=>task.id===action.task.id))
})
await check('Outcome links and unlinks project',async()=>{
 const created=await api('/api/v11.7/outcomes','POST',{title:mark+' outcome',target_value:10})
 const project=await api('/api/projects','POST',{name:mark+' outcome project'})
 const path=`/api/v11.7/outcomes/${created.outcome.id}/projects/${project.id}`
 await api(path,'POST',{});assert.ok((await api('/api/v11/links')).some(link=>link.source_id===project.id&&link.target_id===created.outcome.id))
 await api(path,'DELETE');assert.ok(!(await api('/api/v11/links')).some(link=>link.source_id===project.id&&link.target_id===created.outcome.id))
})
await check('Religious event appears in calendar with preparation task',async()=>{
 const created=await api('/api/v11.11/religious-events','POST',{title:mark+' religious event',date:today})
 const event=created.religious.events.find(event=>event.title===mark+' religious event');assert.ok(event)
 const linked=await api('/api/v11.11/religious-events/'+event.id+'/create-task','POST',{});assert.ok(linked.task.id)
 assert.ok((await api('/api/v11.5/schedule')).entries.some(entry=>entry.entity_id===event.id))
})
await check('Financial commitment links to task and calendar',async()=>{
 const created=await api('/api/v11.12/commitments','POST',{title:mark+' financial commitment',amount:100,due_date:today})
 const commitment=created.finance.commitments.find(item=>item.title===mark+' financial commitment');assert.ok(commitment)
 const task=await api('/api/v11.12/commitments/'+commitment.id+'/create-task','POST',{})
 const event=await api('/api/v11.12/commitments/'+commitment.id+'/create-event','POST',{})
 assert.ok(task.task.id);assert.ok(event.event.id)
 const updated=await api('/api/v11.12/finance');const row=updated.finance.commitments.find(item=>item.id===commitment.id)
 assert.equal(row.task_id,task.task.id);assert.equal(row.event_id,event.event.id)
})
await check('Settings persist across views',async()=>{await api('/api/settings','PATCH',{display_name:mark});assert.equal((await api('/api/settings')).display_name,mark)})
await check('Saved view create and delete',async()=>{
 const created=await api('/api/v11.4/saved-views','POST',{name:mark,filters:{status:'todo'}})
 const row=created.saved_views.find(row=>row.name===mark);assert.ok(row)
 const updated=await api('/api/v11.4/saved-views/'+row.id,'DELETE');assert.ok(!updated.saved_views.some(item=>item.id===row.id))
})
await check('Invalid habit calendar inputs rejected',async()=>{
 assert.equal((await request('/api/habits/matrix?month=99')).status,400)
 assert.equal((await request('/api/habits/missing/day','POST',{year:1405,month:13,day:1,done:true})).status,400)
})
await check('Invalid task rejected',async()=>{assert.equal((await request('/api/tasks','POST',{title:'',status:'invalid'})).status,400)})
await check('Missing record returns 404',async()=>{assert.equal((await request('/api/tasks/audit-missing','PATCH',{status:'done'})).status,404)})
await check('Task list populated with 500 extra records',async()=>{
 for(let batch=0;batch<25;batch++)await Promise.all(Array.from({length:20},(_,index)=>api('/api/tasks','POST',{title:`${mark} load ${batch*20+index}`,status:'todo',due_date:today,priority:'medium'})))
 assert.ok((await api('/api/tasks')).length>=500)
})
const paths=['/api/v11.2/dashboard','/api/v11/tasks/paged?limit=50','/api/v11.5/schedule','/api/v11.7/control','/api/v11.8/learning','/api/v11.9/health-system','/api/v11.10/relationships','/api/v11.12/finance','/api/habits/matrix','/api/health']
const timings=[],failures=[];let cursor=0
const started=performance.now()
await Promise.all(Array.from({length:25},async()=>{while(cursor<1000){const index=cursor++,path=paths[index%paths.length],start=performance.now();try{await api(path)}catch(error){failures.push({path,error:error.message})}timings.push(performance.now()-start)}}))
timings.sort((a,b)=>a-b)
const elapsed=performance.now()-started
const load={requests:1000,concurrency:25,extraTasks:500,datasetTasks:(await api('/api/tasks')).length,errors:failures.length,durationMs:Math.round(elapsed),requestsPerSecond:Math.round(1000000/elapsed),medianMs:Math.round(timings[499]),p95Ms:Math.round(timings[949]),maxMs:Math.round(timings.at(-1)),failures}
console.log('LOAD',JSON.stringify(load))
fs.writeFileSync('test-results/api-load-audit.json',JSON.stringify({base,results,load},null,2))
console.log('RESULT',JSON.stringify({passed:results.filter(row=>row.passed).length,failed:results.filter(row=>!row.passed).length}))
if(results.some(row=>!row.passed)||load.errors)process.exitCode=1
