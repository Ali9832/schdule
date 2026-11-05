import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
const base=process.env.NOVA_BASE_URL||'http://127.0.0.1:3039'
if(!base.startsWith('http://127.0.0.1:'))throw Error('Use an isolated local test server')
const token=crypto.randomUUID(),projects=[],tasks=[],today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),yesterday=new Date(Date.parse(today+'T12:00:00Z')-86400000).toISOString().slice(0,10)
async function api(path,method='GET',body){const r=await fetch(base+path,{method,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});const data=await r.json();assert.ok(r.ok,JSON.stringify({path,status:r.status,data}));return data}
for(const phase of ['active','incubating','someday','archived']){const p=await api('/api/projects','POST',{name:'Team '+phase+' '+token,due_date:today});await api('/api/v11/projects/'+p.id,'PATCH',{lifecycle_status:phase});projects.push({...p,phase});}
const personName='همکار آزمایش '+token,person=(await api('/api/v11.10/people','POST',{name:personName,relation_type:'همکار',cadence_days:0})).people.find(p=>p.name===personName)
const p=projects[0],pending=await api('/api/tasks','POST',{title:'Engineering '+token,project_id:p.id,due_date:yesterday,status:'todo'}),finished=await api('/api/tasks','POST',{title:'Reviewed '+token,project_id:p.id,status:'done'});tasks.push(pending,finished)
const detached=await api('/api/tasks','POST',{title:'Preserved task '+token,project_id:projects[1].id});tasks.push(detached)
const event=await api('/api/events','POST',{title:'Preserved meeting '+token,type:'meeting',project_id:projects[1].id,start_at:today+'T09:00:00+03:30',end_at:today+'T10:00:00+03:30'})
const tabs=await(await fetch('http://127.0.0.1:9227/json/list')).json(),ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl)
await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject});let id=0;const waiting=new Map(),errors=[]
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const q=waiting.get(m.id);waiting.delete(m.id);m.error?q.reject(m.error):q.resolve(m.result)}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);if(m.method==='Page.javascriptDialogOpening')void send('Page.handleJavaScriptDialog',{accept:true})}
const send=(method,params={})=>new Promise((resolve,reject)=>{waiting.set(++id,{resolve,reject});ws.send(JSON.stringify({id,method,params}))})
async function ev(expression){const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value}
const pause=ms=>new Promise(r=>setTimeout(r,ms));async function until(expression){for(let i=0;i<160;i++){if(await ev(expression))return;await pause(100)}throw Error('Timeout '+expression)}
async function openProject(projectId){await ev(`AppOverlays.closeAll();goPage('projects');openV11Inspector('project',${JSON.stringify(projectId)})`);await until(`!!document.querySelector('.pt-team[data-project-id="${projectId}"] .pt-member-form')`)}
try{
 await send('Runtime.enable');await send('Page.enable');await send('Network.enable');await send('Network.setCacheDisabled',{cacheDisabled:true});await send('Network.setBypassServiceWorker',{bypass:true});await send('Page.navigate',{url:base});await until('window.NovaUIReady && !!window.ProjectTeam && !!V112_DASH')
 await ev('AppOverlays.closeAll();goPage("projects")');await until(`!!document.querySelector('.pt-project-card[data-project-id="${p.id}"]')`)
 const activeBefore=(await api('/api/v11.2/dashboard')).summary.projects_active
 for(const project of projects){await ev(`document.querySelector('.pt-project-card[data-project-id="${project.id}"] [data-project-complete]').click()`);await until(`!!document.querySelector('.pt-project-card.is-done[data-project-id="${project.id}"]')`);const row=(await api('/api/project-team')).projects.find(x=>x.id===project.id);assert.equal(row.status,'done');assert.equal(row.lifecycle_status,project.phase)}
 assert.equal((await api('/api/v11.2/dashboard')).summary.projects_active,activeBefore-1,'completed project no longer counts as active even when its lifecycle column is unchanged')
 await ev(`document.querySelector('.pt-project-card[data-project-id="${p.id}"] [data-project-edit]').click()`);await until('!!document.querySelector("form[data-entity-type=project]")')
 await ev(`document.getElementById('recordEdit-name').value=${JSON.stringify('Edited '+token)};document.getElementById('recordEdit-outcome').value='Expected result';document.querySelector('form[data-entity-type=project]').requestSubmit()`);await until(`document.getElementById('v11InspectorTitle').textContent===${JSON.stringify('Edited '+token)}`)
 await ev('AppOverlays.closeAll();goPage("relationships")');await until(`!!document.querySelector('[data-team-person="${person.id}"]')`)
 await ev(`document.querySelector('[data-team-person="${person.id}"]').click()`);await until('!!document.querySelector(".pt-dialog .pt-form")')
 await ev(`(()=>{const f=document.querySelector('.pt-dialog .pt-form');f.elements.project_id.value='${p.id}';f.elements.responsibility.value='Design review';f.elements.due_date.value='${yesterday}';f.requestSubmit()})()`);await until('!!document.querySelector(".pt-dialog .pt-member")')
 let membership=(await api('/api/project-team/people/'+person.id)).members[0];assert.equal(membership.project_id,p.id)
 await openProject(p.id)
 await ev(`(()=>{const select=document.querySelector('.pt-task[data-task-id="${pending.id}"] select');select.value='${person.id}';select.dispatchEvent(new Event('change',{bubbles:true}))})()`)
 await until(`document.querySelector('.pt-task[data-task-id="${pending.id}"] select')?.value==='${person.id}'`);await pause(200)
 let reverse=await api('/api/project-team/people/'+person.id);assert.equal(reverse.tasks[0].id,pending.id);assert.equal(reverse.members[0].overdue_count,1)
 await ev('document.querySelector(".pt-team .pt-member .pt-actions button").click()')
 await ev(`(()=>{const f=document.querySelector('.pt-team .pt-form');f.elements.responsibility.value='Updated engineering';f.elements.due_date.value='${today}';f.requestSubmit()})()`);await until('document.querySelector(".pt-team .pt-member")?.innerText.includes("Updated engineering")')
 await ev(`document.querySelector('.pt-task[data-task-id="${pending.id}"] input[type=checkbox]').click()`);await until(`document.querySelector('.pt-task[data-task-id="${pending.id}"] small')?.innerText.includes('انجام‌شده')`)
 reverse=await api('/api/project-team/people/'+person.id);assert.equal(reverse.members[0].done_count,1);assert.equal(reverse.members[0].overdue_count,0);assert.equal(reverse.members[0].responsibility,'Updated engineering')
 await ev(`document.querySelector('.pt-task[data-task-id="${pending.id}"] .pt-actions button:nth-child(2)').click()`);await until('!!document.querySelector("dialog.pt-dialog form")')
 await ev(`(()=>{const f=document.querySelector('dialog.pt-dialog form');f.elements.due_date.value='${today}';f.requestSubmit()})()`);await until('!document.querySelector("dialog.pt-dialog[open]")');assert.equal((await api('/api/tasks')).find(t=>t.id===pending.id).due_date,today)
 for(const width of [320,390,768]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:true});await openProject(p.id)
  const bad=await ev(`(()=>{const root=document.querySelector('.pt-team');return [...root.querySelectorAll('input,select,button,summary')].map(n=>({n,r:n.getBoundingClientRect()})).filter(({n,r})=>r.width&&r.height&&(r.left<0||r.right>innerWidth+1)).map(({n,r})=>({name:n.name||n.className,left:r.left,right:r.right}))})()`);assert.deepEqual(bad,[],JSON.stringify({width,bad}))
  await ev(`ProjectTeam.openPerson('${person.id}')`);await until('!!document.querySelector(".pt-dialog .pt-form")');const geometry=await ev('(()=>{const r=document.querySelector(".pt-dialog").getBoundingClientRect();return {left:r.left,right:r.right}})()');assert.ok(geometry.left>=0&&geometry.right<=width)
  if(width===390){const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync('.local/project-person-mobile.png',Buffer.from(shot.data,'base64'))}
  await ev('document.querySelector("dialog.pt-dialog").close()')
 }
 await send('Emulation.clearDeviceMetricsOverride');await ev('AppOverlays.closeAll();goPage("relationships")');await until(`!!document.querySelector('[data-team-person="${person.id}"]')`);await ev(`ProjectTeam.openPerson('${person.id}')`);await until('document.querySelector(".pt-dialog .pt-member")?.innerText.includes("Updated engineering")')
 await ev('document.querySelector(".pt-dialog .pt-member .pt-actions button:last-child").click()');await until('!document.querySelector(".pt-dialog .pt-member")');assert.equal((await api('/api/project-team/people/'+person.id)).members.length,0);assert.ok((await api('/api/tasks')).some(t=>t.id===pending.id));
 await api('/api/projects/'+projects[1].id+'/members','POST',{person_id:person.id,responsibility:'To unlink'})
 await ev('AppOverlays.closeAll();goPage("projects")');await until(`!!document.querySelector('.pt-project-card[data-project-id="${projects[1].id}"]')`);await ev(`document.querySelector('.pt-project-card[data-project-id="${projects[1].id}"] .pt-delete').click()`);await until(`!document.querySelector('.pt-project-card[data-project-id="${projects[1].id}"]')`)
 assert.equal((await api('/api/tasks')).find(t=>t.id===detached.id).project_id,null);assert.equal((await api('/api/events')).find(e=>e.id===event.id).project_id,null);assert.ok((await api('/api/v11.10/relationships')).people.some(x=>x.id===person.id));assert.equal((await api('/api/project-team/people/'+person.id)).members.length,0)
 await ev('AppOverlays.closeAll();goPage("relationships");document.querySelector("#relationships button.v1110-ghost[onclick*=calendar]").click()');assert.equal(await ev('document.querySelector(".page:not(.hidden)").id'),'calendar')
 assert.deepEqual(errors,[]);console.log('PASS project actions in every phase, two-way person membership, task owners/status/deadlines, actual progress, mobile details and deletion preserving tasks/people/events')
}finally{ws.close();for(const task of tasks)await api('/api/tasks/'+task.id,'DELETE');for(const project of projects.filter(x=>x.id!==projects[1].id))await api('/api/projects/'+project.id,'DELETE');await api('/api/events/'+event.id,'DELETE');await api('/api/v11.10/people/'+person.id,'PATCH',{status:'archived'});}
