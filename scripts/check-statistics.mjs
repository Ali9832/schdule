import assert from 'node:assert/strict'
import Fastify from 'fastify'
import { buildStatistics,completionMetadata,statisticDay,registerStatistics } from '../server/statistics.js'
const today='2026-10-31',query={from:'2026-10-25',to:today,types:'tasks,projects,routines,reading,meetings'}
const source={tasks:[
 {id:'a',title:'On time',status:'done',created_at:'2026-10-25T12:00:00Z',completed_at:'2026-10-27T12:00:00Z',due_date:'2026-10-29',completed_due_date:'2026-10-28'},
 {id:'b',title:'Late',status:'done',created_at:'2026-10-20T12:00:00Z',completed_at:'2026-10-30T12:00:00Z',due_date:'2026-11-03',completed_due_date:'2026-10-29'},
 {id:'c',title:'Overdue',status:'todo',created_at:'2026-10-24T12:00:00Z',due_date:'2026-10-26'},
 {id:'d',title:'Old finished',status:'done',created_at:'2026-10-25T12:00:00Z',updated_at:'2026-10-30T12:00:00Z',due_date:'2026-10-27'},
 {id:'e',title:'Previous completion',status:'done',created_at:'2026-09-01',completed_at:'2026-10-20T12:00:00Z'},
 {id:'f',title:'Undated',status:'todo'},
],projects:[{id:'p',name:'Paused',status:'paused',due_date:'2026-10-25'}],routines:[{id:'r',title:'Routine',target_weekly:3,created_at:'2026-10-26',logs:{'2026-10-25':true,'2026-10-26':true,'2026-10-27':false,'2026-10-28':true,'2026-11-02':true}}],
reading:{books:[{id:'book',title:'Book',daily_minutes:20,created_at:'2026-10-25',status:'reading'}],sessions:[{book_id:'book',date:'2026-10-26',seconds:120},{book_id:'book',date:'2026-10-28',seconds:60},{book_id:'unselected',date:'2026-10-28',seconds:900}]},meetings:[{id:'m',title:'Meeting',start_at:'2026-10-30T21:30:00Z',created_at:'2026-10-25'}]}
const data=buildStatistics(source,query,today)
assert.equal(data.summary.completed,2);assert.equal(data.summary.previous_completed,1);assert.equal(data.summary.completed_per_week,2)
assert.equal(data.summary.unknown_completed,1,'updated_at must not become a completion date')
assert.equal(data.summary.overdue,1);assert.equal(data.summary.unknown_created,2)
assert.deepEqual(data.schedule,{on_time:1,late:1,overdue:1,upcoming:0,paused:1,unknown:1})
assert.equal(data.summary.routine_checks,2,'do not count check-ins before the routine was created')
assert.equal(data.summary.reading_minutes,3)
assert.equal(data.daily.find(d=>d.date==='2026-10-31').meeting_count,1,'timestamps use Tehran time')
assert.equal(data.daily.reduce((n,d)=>n+d.completed,0),2)
assert.equal(statisticDay('2026-10-30T21:30:00Z'),'2026-10-31')
assert.equal(statisticDay('2026-02-30'),null)
assert.equal(buildStatistics(source,{...query,types:'reading',ids:'reading:book'},today).summary.total,1)
assert.equal(buildStatistics(source,{...query,types:'tasks',ids:'tasks:a,tasks:b'},today).summary.completed,2)
assert.throws(()=>buildStatistics(source,{...query,ids:'tasks:someone-else'},today),/وجود ندارد/)
for(const extra of [{to:'invalid'},{from:'2026-02-30'},{from:'2025-01-01'},{from:'2026-11-01'},{to:'2026-11-01'},{types:'unknown'},{types:''}])assert.throws(()=>buildStatistics(source,{...query,...extra},today),e=>e.statusCode===400)
assert.equal(buildStatistics({},query,today).summary.total,0,'no generated sample records')
const metadata=completionMetadata({status:'todo'},{status:'done',due_date:'2026-10-30'},'2026-10-29T12:00:00Z')
assert.equal(metadata.completed_due_date,'2026-10-30')
assert.deepEqual(completionMetadata({status:'done',...metadata},{status:'done',due_date:'2026-11-10'}),metadata,'edits preserve the original completion deadline')
assert.deepEqual(completionMetadata({status:'done'},{status:'done'}),{completed_at:null,completed_due_date:null},'no fabricated historical completion')
assert.equal(completionMetadata({status:'done',...metadata},{status:'todo'}).completed_at,null)
const app=Fastify();app.addHook('preHandler',async req=>{req.user={id:req.headers['test-user']||'one'}})
app.setErrorHandler((e,req,reply)=>reply.code(e.statusCode||500).send({error:e.message}))
let reads=0;registerStatistics(app,{load:async user=>{reads++;return user==='one'?source:{}}})
try{
 const url='/api/statistics?from=2026-10-25&to=2026-10-30&types=tasks'
 assert.equal((await app.inject({url})).statusCode,200)
 const other=await app.inject({url,headers:{'test-user':'two'}});assert.equal(other.json().summary.total,0)
 const rejected=await app.inject({url:url+'&ids=tasks:a',headers:{'test-user':'two'}});assert.equal(rejected.statusCode,400)
 const before=reads;assert.equal((await app.inject({url:'/api/statistics?to=invalid'})).statusCode,400);assert.equal(reads,before)
 console.log('PASS statistics: real data, date bounds, Tehran time, selected records, ownership, deadline snapshots, unknown completion dates, routine logs, reading totals and velocity')
}finally{await app.close()}
