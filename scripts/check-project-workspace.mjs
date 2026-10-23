import assert from 'node:assert/strict'
import Fastify from 'fastify'
import crypto from 'node:crypto'
import { registerProjectWorkspace } from '../server/project-workspace.js'
const p1=crypto.randomUUID(),p2=crypto.randomUUID(),p3=crypto.randomUUID(),rows=new Map(),events=[]
const projects=[{id:p1,name:'Project one',user_id:'one'},{id:p2,name:'Project two',user_id:'one'},{id:p3,name:'Other user',user_id:'two'}]
const app=Fastify()
app.addHook('preHandler',async request=>{request.user={id:request.headers['test-user']||'one'}})
app.setErrorHandler((error,request,reply)=>reply.code(error.statusCode||500).send({error:error.message}))
registerProjectWorkspace(app,{
 project:async(user,id)=>projects.find(p=>p.id===id&&p.user_id===user),projects:async user=>projects.filter(p=>p.user_id===user),
 meetings:async(user,id)=>events.filter(row=>row.user_id===user&&row.project_id===id),
 createEvent:async(user,body)=>{const row={...body,id:crypto.randomUUID(),user_id:user};events.push(row);return row},
 updateEvent:async(user,id,body)=>{const index=events.findIndex(row=>row.id===id&&row.user_id===user);if(index<0)return null;events[index]={...events[index],...body};return events[index]},
 reports:{
 list:async(user,project)=>[...rows.values()].filter(row=>row.user_id===user&&(!project||row.project_id===project)),
 create:async row=>rows.set(row.id,structuredClone(row)),
 get:async(user,project,id)=>{const row=rows.get(id);return row?.user_id===user&&row.project_id===project?structuredClone(row):null},
 update:async(row,version)=>{if(rows.get(row.id)?.version!==version)return false;rows.set(row.id,structuredClone(row));return true}
 }
})
async function request(method,url,body,status=200,user='one'){const result=await app.inject({method,url,payload:body,headers:{'test-user':user}});assert.equal(result.statusCode,status,result.body);return result.json()}
try{
 assert.equal((await request('GET',`/api/projects/${p1}/workspace`)).reports.length,0)
 await request('GET',`/api/projects/${p1}/workspace`,undefined,404,'two')
 await request('GET','/api/projects/invalid/workspace',undefined,404)
 await request('POST',`/api/projects/${p1}/reports`,{text:' '},400)
 await request('POST',`/api/projects/${p1}/reports`,{text:'Valid',report_date:'2026-02-30'},400)
 const report=await request('POST',`/api/projects/${p1}/reports`,{text:'First update',report_date:'2026-10-23',project_id:p2,user_id:'two'},201)
 assert.equal(report.project_id,p1);assert.equal(report.user_id,'one')
 assert.equal((await request('GET',`/api/projects/${p2}/workspace`)).reports.length,0)
 const updated=await request('PATCH',`/api/projects/${p1}/reports/${report.id}`,{text:'Expanded update',report_date:'2026-10-23',version:1})
 assert.equal(updated.version,2);assert.equal(updated.created_at,report.created_at)
 await request('PATCH',`/api/projects/${p1}/reports/${report.id}`,{text:'Stale update',version:1},409)
 await request('PATCH',`/api/projects/${p2}/reports/${report.id}`,{text:'Wrong project',version:2},404)
 await request('PATCH',`/api/projects/${p1}/reports/${report.id}`,{text:'Wrong user',version:2},404,'two')
 assert.equal((await request('GET','/api/project-reports')).reports[0].project_name,'Project one')
 assert.equal((await request('GET','/api/project-reports',undefined,200,'two')).reports.length,0)
 const meeting=await request('POST',`/api/projects/${p1}/meetings`,{title:'Future meeting',date:'2099-01-01',time:'09:00',duration:45,status:'scheduled',project_id:p2},201)
 assert.equal(meeting.project_id,p1);assert.equal(meeting.status,'scheduled')
 assert.equal(new Date(meeting.end_at)-new Date(meeting.start_at),45*60000)
 const old=await request('POST',`/api/projects/${p1}/meetings`,{title:'Past, not confirmed',date:'2000-01-01',time:'09:00',duration:45,status:'scheduled'},201)
 assert.equal(old.status,'past')
 const source=events.find(row=>row.id===meeting.id);source.notes='NOVA_MEETING::'+JSON.stringify({phase:'prepare',summary:'Keep summary',actions:[{id:'a',text:'Keep action',task_id:'task'}]})
 const held=await request('PATCH',`/api/projects/${p1}/meetings/${meeting.id}`,{status:'held'});assert.equal(held.status,'held')
 assert.equal(JSON.parse(events.find(row=>row.id===meeting.id).notes.slice(14)).actions[0].task_id,'task')
 await request('PATCH',`/api/projects/${p2}/meetings/${meeting.id}`,{status:'held'},404)
 await request('POST',`/api/projects/${p1}/meetings`,{title:'Invalid',date:'2026-10-23',time:'25:00'},400)
 await request('POST',`/api/projects/${p1}/meetings`,{title:'Invalid',date:'2026-10-23',duration:0},400)
 assert.equal((await request('GET',`/api/projects/${p1}/workspace`)).reports[0].text,'Expanded update')
 console.log('Project workspace passed: owned-project reports, edit/version conflicts, isolation, meeting creation/linking/status, metadata preservation and validation.')
}finally{await app.close()}
