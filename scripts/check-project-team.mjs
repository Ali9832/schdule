import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import Fastify from 'fastify'
import {registerProjectTeam} from '../server/project-team.js'
import {memoryProjectTeamStore} from '../server/project-team-store.js'
import {tehranToday} from '../server/planning-date.js'
const uuid=()=>crypto.randomUUID(),p1=uuid(),p2=uuid(),person=uuid(),stranger=uuid(),t1=uuid(),t2=uuid(),foreignTask=uuid(),today=tehranToday(),yesterday=new Date(Date.parse(today+'T12:00:00Z')-86400000).toISOString().slice(0,10)
const projects=[{id:p1,name:'Project',status:'in_progress',lifecycle_status:'someday'},{id:p2,name:'Second project'}],persons=[{id:person,name:'Person',status:'active'}],tasks=[{id:t1,title:'Pending',project_id:p1,status:'todo',due_date:yesterday},{id:t2,title:'Finished',project_id:p1,status:'done',due_date:yesterday},{id:foreignTask,title:'Other project task',project_id:p2,status:'todo'}]
const memory={},store=memoryProjectTeamStore(memory),app=Fastify();app.addHook('preHandler',async r=>{r.user={id:r.headers['test-user']||'one'}})
app.setErrorHandler((e,r,reply)=>reply.code(e.statusCode||500).send({error:e.message}))
registerProjectTeam(app,{store,canonical:async user=>({projects:user==='one'?projects:[],tasks:user==='one'?tasks:[]}),people:async user=>user==='one'?persons:[{id:stranger,name:'Private person',status:'active'}]})
async function request(method,url,payload,status=200,user='one'){const r=await app.inject({method,url,payload,headers:{'test-user':user}});assert.equal(r.statusCode,status,r.body);return r.json()}
try{
 const base='/api/projects/'+p1
 let member=await request('POST',base+'/members',{person_id:person,responsibility:'Engineering',due_date:yesterday},201)
 await request('POST',base+'/members',{person_id:person},409)
 await request('POST',base+'/members',{person_id:stranger},400)
 await request('GET',base+'/team',undefined,404,'two')
 await request('GET','/api/project-team/people/'+person,undefined,404,'two')
 await request('POST','/api/projects/'+p2+'/members',{person_id:person,due_date:'2026-02-30'},400)
 await request('PUT',base+'/tasks/'+foreignTask+'/assignee',{person_id:person},404)
 await request('PUT',base+'/tasks/'+t1+'/assignee',{person_id:person})
 let data=await request('GET',base+'/team');assert.equal(data.tasks[0].person_id,person);assert.equal(data.members[0].task_count,1);assert.equal(data.members[0].overdue_count,1);assert.equal(data.members[0].responsibility_overdue,true)
 let reverse=await request('GET','/api/project-team/people/'+person);assert.equal(reverse.members[0].project_id,p1);assert.equal(reverse.tasks[0].id,t1)
 tasks[0].status='done';reverse=await request('GET','/api/project-team/people/'+person);assert.equal(reverse.members[0].done_count,1);assert.equal(reverse.members[0].overdue_count,0)
 member=await request('PATCH',base+'/members/'+member.id,{version:member.version,status:'done',due_date:null});assert.equal(member.version,2)
 await request('PATCH',base+'/members/'+member.id,{version:1,notes:'Stale edit'},409)
 const concurrent=await Promise.all([app.inject({method:'PATCH',url:base+'/members/'+member.id,payload:{version:2,notes:'First'}}),app.inject({method:'PATCH',url:base+'/members/'+member.id,payload:{version:2,notes:'Second'}})]);assert.deepEqual(concurrent.map(r=>r.statusCode).sort(),[200,409]);member=concurrent.find(r=>r.statusCode===200).json()
 tasks[0].project_id=p2;data=await request('GET','/api/projects/'+p2+'/team');assert.equal(data.tasks.find(t=>t.id===t1).person_id,null,'moving a task cannot assign someone to a project they have not joined');tasks[0].project_id=p1
 await request('PUT',base+'/tasks/'+t1+'/assignee',{person_id:null});assert.equal((await request('GET',base+'/team')).tasks[0].person_id,null)
 await request('PUT',base+'/tasks/'+t1+'/assignee',{person_id:person})
 await request('DELETE',base+'/members/'+member.id,{version:member.version});assert.equal((await request('GET',base+'/team')).tasks.length,2);assert.equal(tasks.length,3);assert.equal(persons.length,1);assert.equal((await store.list('one')).assignees.length,0)
 assert.equal((await request('GET','/api/project-team',undefined,200,'two')).members.length,0)
 console.log('PASS project/person ownership, two-way membership, real task/deadline progress, moved tasks, duplicate assignment, optimistic concurrent edits and unlinking without deleting tasks/people')
}finally{await app.close()}
