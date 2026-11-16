import assert from 'node:assert/strict'
import Fastify from 'fastify'
import { buildStatistics,completionMetadata,statisticDay,registerStatistics,calendarStatisticRecords } from '../server/statistics.js'
const today='2026-10-31',query={from:'2026-10-25',to:today,types:'tasks,projects,routines,reading,meetings'}
const records=calendarStatisticRecords({events:[{id:'class',title:'Class',start_at:'2026-10-24T09:00:00',created_at:'2026-10-01'}]}, {'event:class':{recurrence:{frequency:'weekly'},results:{'2026-10-24':{status:'not_done',date:'2026-10-24',recorded_at:'2026-10-31T09:00:00Z'},'2026-10-31':{status:'not_done',date:'2026-10-31',recorded_at:'2026-10-31T09:00:00Z'}}},'event:other-user':{results:{'2026-10-31':{status:'not_done',date:'2026-10-31',recorded_at:'2026-10-31T09:00:00Z'}}}});
const missedReport=buildStatistics({calendar_records:records},{...query,types:'calendar',ids:'calendar:event:class'},today);assert.equal(missedReport.summary.not_done,1);assert.equal(missedReport.daily.find(r=>r.date==='2026-10-31').not_done,1);assert.equal(missedReport.not_done_results[0].occurrence_date,'2026-10-31');assert.equal(records.length,1,'Other-user/deleted records cannot enter the calendar catalog');assert.throws(()=>buildStatistics({calendar_records:records},{...query,types:'calendar',ids:'calendar:event:other-user'},today));
assert.equal(buildStatistics({tasks:[{id:'one',title:'One',created_at:'2026-10-25'}],calendar_records:[{id:'task:one',title:'One',created_at:'2026-10-25',results:[]}]},{...query,types:'tasks,calendar'},today).summary.total,1,'Calendar and task views must not double count the same entity');
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
assert.equal(data.task_performance.summary.on_time_percent,50)
assert.equal(data.task_performance.summary.average_cycle_days,6)
assert.equal(data.task_performance.rows.find(r=>r.id==='b').delay_days,1,'Use the deadline captured at completion, not the edited current deadline')
assert.equal(data.task_performance.rows.find(r=>r.id==='d').cycle_days,null,'Do not invent a completion duration from updated_at')
assert.equal(data.task_performance.daily.find(r=>r.date==='2026-10-29').late,1,'Deadline chart groups by due date, not completion date')
const performanceTasks=[
 {id:'miss',title:'Explicitly missed',status:'todo',created_at:'2026-10-25',due_date:'2026-10-28'},
 {id:'later',title:'Completed after a missed attempt',status:'done',created_at:'2026-10-25',completed_at:'2026-10-30',completed_due_date:'2026-10-28'},
 {id:'moved',title:'Rescheduled',status:'todo',due_date:'2026-10-31'},
 {id:'old',title:'Outside range',status:'todo',created_at:'2026-09-01',due_date:'2026-09-02'},
 {id:'invalid',title:'Inconsistent imported dates',status:'done',created_at:'2026-10-31',completed_at:'2026-10-30'},
];
const performanceCalendar=performanceTasks.filter(t=>['miss','later','moved'].includes(t.id)).map(t=>({id:'task:'+t.id,results:[{date:'2026-10-28',status:'not_done'}]}));
const performance=buildStatistics({tasks:performanceTasks,calendar_records:performanceCalendar},{...query,types:'tasks'},today).task_performance;
assert.equal(performance.states.not_done,1);assert.equal(performance.states.late,1);assert.equal(performance.states.open,1,'Old missed date must not mark a rescheduled task as currently missed');
assert.equal(performance.summary.not_done_tasks,3,'Missed attempts remain visible even after later completion or rescheduling');
assert.equal(performance.summary.not_done_occurrences,3);assert.equal(performance.summary.cycle_samples,1);assert.equal(performance.summary.average_cycle_days,5);
assert.equal(performance.rows.some(r=>r.id==='old'),false);assert.equal(performance.rows.find(r=>r.id==='invalid').cycle_days,null);
assert.equal(performance.daily.reduce((n,d)=>n+d.not_done,0),1);
assert.equal(buildStatistics({tasks:performanceTasks,calendar_records:performanceCalendar},{...query,types:'tasks',ids:'tasks:miss'},today).task_performance.rows.length,1);
assert.equal(buildStatistics({tasks:performanceTasks,calendar_records:performanceCalendar},{...query,types:'reading'},today).task_performance.rows.length,0);
assert.equal(buildStatistics({},query,today).task_performance.summary.on_time_percent,null,'No samples is unknown, not zero percent');
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
