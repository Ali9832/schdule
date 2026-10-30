import assert from 'node:assert/strict'
import Fastify from 'fastify'
import { registerReading } from '../server/reading.js'
import { tehranToday } from '../server/planning-date.js'
const app = Fastify(), states = new Map(), empty = () => ({books:[],sessions:[],timer:null})
app.addHook('preHandler',async req=>{req.user={id:req.headers['test-user']||'one'}})
app.setErrorHandler((error,req,reply)=>reply.code(error.statusCode||500).send({error:error.message}))
registerReading(app,{
 read:async user=>structuredClone(states.get(user)||empty()),
 change:async(user,action)=>{const state=structuredClone(states.get(user)||empty()),result=action(state);states.set(user,state);return result}
})
async function req(method,url,body,status=200,user='one') {
 const response=await app.inject({method,url,payload:body,headers:{'test-user':user}})
 assert.equal(response.statusCode,status,response.body);return response.json()
}
try {
 assert.equal((await req('GET','/api/reading')).books.length,0)
 let result=await req('POST','/api/reading/books',{title:'Real book',author:'Writer',daily_minutes:20,reminder_enabled:true,reminder_time:'21:15'},201)
 const book=result.books[0].id
 assert.equal(result.books[0].total_seconds,0)
 assert.equal((await req('GET','/api/reading',undefined,200,'two')).books.length,0)
 await req('PATCH','/api/reading/books/'+book,{title:'Other user'},404,'two')
 await req('POST',`/api/reading/books/${book}/sessions`,{minutes:10,request_id:'other'},404,'two')
 await req('POST','/api/reading/books',{title:'Invalid',daily_minutes:0},400)
 await req('PATCH','/api/reading/books/'+book,{reminder_time:'24:10'},400)
 await req('PATCH','/api/reading/books/'+book,{reminder_enabled:'yes'},400)
 const session={minutes:12,date:tehranToday(),request_id:'retry',note:'Chapter 1'}
 result=await req('POST',`/api/reading/books/${book}/sessions`,session,201)
 assert.equal(result.books[0].today_seconds,720)
 const reminders=await req('GET','/api/reading/reminders')
 assert.equal(reminders.books[0].today_seconds,720);assert.equal(reminders.sessions,undefined,'background reminder response excludes reading history')
 assert.equal((await req('GET','/api/reading/reminders',undefined,200,'two')).books.length,0)
 result=await req('POST',`/api/reading/books/${book}/sessions`,session,201)
 assert.equal(result.sessions.length,1,'retry must not double-count time')
 await req('POST',`/api/reading/books/${book}/sessions`,{...session,request_id:'bad',date:'2026-02-30'},400)
 await req('POST',`/api/reading/books/${book}/sessions`,{...session,request_id:'bad',minutes:-1},400)
 await req('POST',`/api/reading/books/${book}/sessions`,{...session,request_id:'bad',date:'2099-01-01'},400)
 result=await req('POST',`/api/reading/books/${book}/start`,{})
 const timer=result.timer.id
 assert.equal((await req('POST',`/api/reading/books/${book}/start`,{})).timer.id,timer)
 await req('PATCH','/api/reading/books/'+book,{status:'finished'},400)
 result=await req('POST','/api/reading/books',{title:'Second'},201)
 const second=result.books[0].id
 await req('POST',`/api/reading/books/${second}/start`,{},409)
 await req('POST','/api/reading/timer/stop',{timer_id:'wrong'},409)
 result=await req('POST','/api/reading/timer/stop',{timer_id:timer})
 assert.equal(result.timer,null);assert.equal(result.sessions.length,2)
 assert.ok(result.books.find(b=>b.id===book).total_seconds>=721)
 assert.equal((await req('POST','/api/reading/timer/stop',{timer_id:timer})).sessions.length,2)
 // A timer crosses Tehran midnight; time belongs to both actual days.
 const midnight=Date.parse(tehranToday()+'T00:00:00+03:30'), realNow=Date.now
 Date.now=()=>midnight+60000
 states.get('one').timer={id:'midnight',book_id:book,started_at:new Date(midnight-60000).toISOString()}
 result=await req('POST','/api/reading/timer/stop',{timer_id:'midnight'})
 Date.now=realNow
 const split=result.sessions.filter(s=>s.id==='midnight'||(s.source==='timer'&&s.seconds===60))
 assert.equal(split.length,2);assert.equal(new Set(split.map(s=>s.date)).size,2)
 await req('POST',`/api/reading/books/${book}/start`,{})
 states.get('one').timer.started_at=new Date(Date.now()-90000000).toISOString()
 const old=states.get('one').timer.id
 await req('POST','/api/reading/timer/stop',{timer_id:old},400)
 result=await req('POST','/api/reading/timer/stop',{timer_id:old,discard:true})
 assert.equal(result.timer,null)
 result=await req('PATCH','/api/reading/books/'+book,{status:'finished',reminder_enabled:false})
 assert.equal(result.books.find(b=>b.id===book).reminder_enabled,false)
 await req('POST',`/api/reading/books/${book}/start`,{},400)
 assert.equal((await req('GET','/api/reading',undefined,200,'two')).sessions.length,0)
 result=await req('POST','/api/reading/books',{title:'Pages book',total_pages:200,current_page:25,reminder_enabled:true},201)
 const pageBook=result.books[0].id,day=tehranToday(),yesterday=new Date(Date.parse(day+'T12:00:00Z')-86400000).toISOString().slice(0,10)
 result=await req('POST',`/api/reading/books/${pageBook}/sessions`,{minutes:15,date:day,start_page:26,end_page:35,request_id:'pages-one'},201)
 assert.equal(result.books[0].current_page,35);assert.equal(result.books[0].total_pages_read,10)
 await req('POST',`/api/reading/books/${pageBook}/sessions`,{minutes:15,start_page:35,end_page:201,request_id:'pages-invalid'},400)
 await req('PATCH','/api/reading/books/'+pageBook,{total_pages:20},400)
 result=await req('POST',`/api/reading/books/${pageBook}/sessions`,{date:yesterday,start_time:'09:00',end_time:'09:45',start_page:36,end_page:40,request_id:'range-one'},201)
 assert.equal(result.books[0].current_page,35,'backdated log does not overwrite the latest bookmark')
 const older=new Date(Date.parse(yesterday+'T12:00:00Z')-86400000).toISOString().slice(0,10)
 result=await req('POST',`/api/reading/books/${pageBook}/sessions`,{date:older,start_time:'23:50',end_time:'00:10',end_next_day:true,start_page:41,end_page:44,request_id:'range-midnight'},201)
 assert.equal(result.books[0].current_page,35);assert.equal(result.books[0].total_pages_read,19)
 assert.equal(result.sessions.filter(s=>s.group_id==='range-midnight').length,2)
 assert.equal(result.sessions.filter(s=>s.group_id==='range-midnight').reduce((n,s)=>n+s.pages_read,0),4,'page counts are not duplicated at midnight')
 assert.equal(result.books[0].total_seconds,4800)
 await req('POST',`/api/reading/books/${pageBook}/sessions`,{date:yesterday,start_time:'09:00',end_time:'09:00',request_id:'bad-time'},400)
 const active=(await req('POST',`/api/reading/books/${pageBook}/start`,{})).timer.id
 const close={minutes:5,start_page:45,end_page:50,date:day,timer_id:active,request_id:active}
 result=await req('POST',`/api/reading/books/${pageBook}/sessions`,close,201)
 assert.equal(result.timer,null);assert.equal(result.books[0].current_page,50);assert.equal(result.books[0].total_seconds,5100)
 result=await req('POST',`/api/reading/books/${pageBook}/sessions`,close,201);assert.equal(result.books[0].total_seconds,5100,'timer-log retry is idempotent')
 assert.equal((await req('GET','/api/reading/reminders')).books.find(b=>b.id===pageBook).current_page,50)
 assert.equal((await req('GET','/api/reading/reminders')).books.find(b=>b.id===pageBook).total_pages_read,25)
 console.log('PASS reading: ownership, pages, bookmarks, duration, time ranges, midnight splitting, retries, timers and reminder progress')
} finally { await app.close() }
