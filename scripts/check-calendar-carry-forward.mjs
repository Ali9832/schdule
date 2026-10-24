import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import Fastify from 'fastify'
import { planCarryForward, memoryCarryForward, postgresCarryForward, registerCalendarCarryForward } from '../server/calendar-carry-forward.js'

const target = '2026-10-25', user = randomUUID()
function fixture(count=50) {
  const data={tasks:Array.from({length:count},()=>({id:randomUUID(),user_id:user,title:'Keep title',due_date:'2026-10-01',status:'todo'})),events:[{id:randomUUID(),user_id:user,start_at:'2026-10-20T09:30:00.000Z',end_at:'2026-10-21T11:45:00.000Z',notes:'Keep structured notes'}],projects:[{id:randomUUID(),user_id:user,due_date:'2026-10-22',status:'in_progress'}],goals:[{id:randomUUID(),user_id:user,due_date:'2026-10-23',status:'active'}],execution:{calendar:{}},finance:{currency_unit:'TOMAN',accounts:[{balance:123}]}}
  const series={id:randomUUID(),user_id:user,due_date:'2026-10-04',status:'todo'};data.tasks.push(series)
  data.execution.calendar['task:'+series.id]={kind:'homework',course_id:'course-one',recurrence:{frequency:'weekly',interval:1,count:4},exceptions:{'2026-10-11':{done:true}}}
  data.execution.calendar['task:'+data.tasks[0].id]={kind:'task',due_date:'2026-10-02',due_time:'12:00',reminders:[15]}
  const items=[...data.tasks.filter(t=>t!==series).map(t=>({source:'task',id:t.id})),{source:'event',id:data.events[0].id},{source:'project',id:data.projects[0].id},{source:'outcome',id:data.goals[0].id},{source:'task',id:series.id,occurrence_date:'2026-10-04'},{source:'task',id:series.id,occurrence_date:'2026-10-18'}]
  return {data,items,series}
}
const sample=fixture(),original=structuredClone(sample.data)
const plan=planCarryForward([...sample.items,sample.items[0]],{...sample.data,outcomes:sample.data.goals},sample.data.execution.calendar,target)
assert.deepEqual(sample.data,original,'planning must be pure')
assert.equal(plan.result.moved_count,55,'duplicates count once, occurrences remain independent')
const transfer=memoryCarryForward(()=>sample.data,()=>target)
await transfer(user,sample.items)
assert.ok(sample.data.tasks.filter(t=>t.id!==sample.series.id).every(t=>t.due_date===target))
assert.equal(sample.data.tasks.find(t=>t.id===sample.series.id).due_date,'2026-10-04','series start remains unchanged')
assert.equal(sample.data.execution.calendar['task:'+sample.series.id].exceptions['2026-10-18'].moved_to,target)
assert.equal(sample.data.execution.calendar['task:'+sample.series.id].exceptions['2026-10-11'].done,true)
assert.equal(sample.data.events[0].start_at,'2026-10-25T09:30:00.000Z');assert.equal(sample.data.events[0].end_at,'2026-10-26T11:45:00.000Z')
assert.equal(sample.data.events[0].notes,'Keep structured notes');assert.equal(sample.data.goals[0].due_date,target)
assert.equal(sample.data.execution.calendar['task:'+sample.data.tasks[0].id].due_date,'2026-10-26')
assert.deepEqual(sample.data.finance,original.finance)
const retried=await transfer(user,sample.items);assert.equal(retried.moved_count,0);assert.equal(retried.unchanged_count,55)
const reopened=fixture(1);reopened.data.execution.calendar['task:'+reopened.data.tasks[0].id].done=true
assert.equal((await memoryCarryForward(()=>reopened.data,()=>target)(user,[reopened.items[0]])).moved_count,1,'canonical open task must not be rejected by stale calendar completion metadata')
for(const invalid of ['foreign','completed','future','invalid-occurrence']) {
  const f=fixture(),before=structuredClone(f.data);let items=[...f.items]
  if(invalid==='foreign')items.push({source:'task',id:randomUUID()})
  if(invalid==='completed'){f.data.tasks.at(-1).status='done';items.push({source:'task',id:f.series.id,occurrence_date:'2026-10-11'})}
  if(invalid==='future'){f.data.projects[0].due_date='2026-10-30';before.projects[0].due_date='2026-10-30'}
  if(invalid==='invalid-occurrence')items.push({source:'task',id:f.series.id,occurrence_date:'2026-10-05'})
  if(invalid==='completed')before.tasks.at(-1).status='done'
  await assert.rejects(memoryCarryForward(()=>f.data,()=>target)(user,items));assert.deepEqual(f.data,before,'invalid batch must not partially move records')
}

// The adapter is tested with a transactional query double; no production database is used.
function poolFor(f,failAt='') {
  let state={records:{tasks:structuredClone(f.data.tasks),planner_events:structuredClone(f.data.events),projects:structuredClone(f.data.projects),outcomes:structuredClone(f.data.goals)},calendar:structuredClone(f.data.execution.calendar)},snapshot
  const queries=[];let releases=0
  const client={async query(sql,args=[]){
    queries.push({sql,args})
    if(sql==='BEGIN'){snapshot=structuredClone(state);return {rows:[]}}
    if(sql==='ROLLBACK'){state=snapshot;return {rows:[]}}
    if(sql==='COMMIT')return {rows:[]}
    if(sql.startsWith('SELECT data#>'))return {rows:[{calendar:state.calendar}]}
    const read=sql.match(/FROM (tasks|planner_events|projects|outcomes) WHERE/)
    if(read)return {rows:state.records[read[1]].filter(row=>row.user_id===args[0]&&args[1].includes(row.id))}
    const write=sql.match(/^UPDATE (tasks|planner_events|projects|outcomes) AS e/)
    if(write){if(write[1]===failAt)throw Error('Injected database write failure');assert.match(sql,/e\.user_id=\$1/);for(const patch of JSON.parse(args[1]))Object.assign(state.records[write[1]].find(row=>row.user_id===args[0]&&row.id===patch.id),patch);return {rows:[]}}
    if(sql.startsWith('UPDATE user_life_data')){assert.match(sql,/jsonb_set/);state.calendar={...state.calendar,...JSON.parse(args[1])};return {rows:[]}}
    return {rows:[]}
  },release(){releases++}}
  return {connect:async()=>client,queries,get state(){return state},get releases(){return releases}}
}
const counts=[]
for(const size of [1,500]){
 const f=fixture(size),pool=poolFor(f),items=f.items.slice(0,size)
 await postgresCarryForward(pool,()=>target)(user,items);counts.push(pool.queries.length)
 assert.equal(pool.queries.filter(q=>q.sql.startsWith('UPDATE tasks')).length,1)
 assert.equal(pool.releases,1);assert.equal(pool.queries.at(-1).sql,'COMMIT')
 assert.ok(pool.state.records.tasks.slice(0,size).every(t=>t.due_date===target))
}
assert.equal(counts[0],counts[1],'query count must stay constant for 1 vs 500 tasks')
const broken=fixture(),brokenPool=poolFor(broken,'planner_events'),before=structuredClone(brokenPool.state)
await assert.rejects(postgresCarryForward(brokenPool,()=>target)(user,broken.items),/Injected/)
assert.deepEqual(brokenPool.state,before);assert.equal(brokenPool.queries.at(-1).sql,'ROLLBACK');assert.equal(brokenPool.releases,1)

const one=fixture(),two={tasks:[],events:[],projects:[],goals:[],execution:{calendar:{}}},app=Fastify()
app.addHook('preHandler',async req=>{req.user={id:req.headers['test-user']||user}})
registerCalendarCarryForward(app,memoryCarryForward(id=>id===user?one.data:two,()=>target))
try{
 for(const payload of [{items:[]},{items:[{source:'task',id:'not-uuid'}]},{items:[{source:'wrong',id:randomUUID()}]}])assert.equal((await app.inject({method:'POST',url:'/api/calendar/carry-forward',payload})).statusCode,400)
 const foreign=await app.inject({method:'POST',url:'/api/calendar/carry-forward',payload:{items:one.items},headers:{'test-user':randomUUID()}});assert.equal(foreign.statusCode,404)
 const result=await app.inject({method:'POST',url:'/api/calendar/carry-forward',payload:{items:one.items}});assert.equal(result.statusCode,200,result.body);assert.equal(result.json().moved_count,55)
}finally{await app.close()}
console.log(`PASS bulk carry-forward: atomic validation/rollback, all 4 sources, duration/deadline preservation, per-occurrence moves, safe retry, tenant isolation and constant ${counts[0]} queries for 1 or 500 tasks.`)
