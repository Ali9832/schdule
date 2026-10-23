import assert from 'node:assert/strict'
const base=process.env.NOVA_BASE_URL||'http://127.0.0.1:3018',port=process.env.NOVA_CDP_PORT||'9227'
const tabs=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json()
const socket=new WebSocket(tabs.find(tab=>tab.type==='page'&&!tab.url.startsWith('chrome-extension:')).webSocketDebuggerUrl)
await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject})
let sequence=0;const pending=new Map(),errors=[],created=[]
socket.onmessage=event=>{const m=JSON.parse(event.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result)}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails)}
const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}))})
async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value}
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))
async function until(expression){for(let i=0;i<100;i++){if(await evaluate(expression))return;await pause(100)}throw Error('Timeout: '+expression)}
async function navigate(){await send('Page.navigate',{url:base});await pause(400);await until('!!window.NoavaWorkspace && !!V112_DASH');await evaluate(`sessionStorage.setItem('noava.overdue:local-demo:'+DateContext.today(),'1');document.querySelector('#overdueReview')?.close()`)}
try{
 await send('Page.enable');await send('Runtime.enable');await send('Network.enable');await send('Network.setCacheDisabled',{cacheDisabled:true});await send('Network.setBypassServiceWorker',{bypass:true});await navigate()
 assert.match(await evaluate('document.title'),/NOAVA/)
 assert.equal(await evaluate('document.querySelector(".brand strong").textContent'),'NOAVA')
 await evaluate('document.querySelector(".sidebar-bottom .profile").click()');await until('document.querySelector("#profile h2")');assert.equal(await evaluate('document.getElementById("profile").classList.contains("hidden")'),false)
 await evaluate(`openGenericAdd('daily','Draft test');document.getElementById('genericTitleInput').value='Persistent title';document.getElementById('genericNotes').value='Persistent description';document.getElementById('genericNotes').dispatchEvent(new Event('input',{bubbles:true}));AppOverlays.closeAll()`)
 await navigate();await evaluate(`openGenericAdd('daily','Draft test')`)
 assert.equal(await evaluate('document.getElementById("genericTitleInput").value'),'Persistent title')
 assert.equal(await evaluate('document.getElementById("genericNotes").value'),'Persistent description')
 await evaluate('document.querySelector("#genericModalBg .modal-actions .secondary").click();openGenericAdd("daily","Draft test")')
 assert.equal(await evaluate('document.getElementById("genericTitleInput").value'),'')
 await evaluate('AppOverlays.closeAll();goPage("finance")');await until('!!V1112_DATA')
 await evaluate('FinanceEditor.open("transactions")')
 const money=await evaluate(`(()=>{const f=document.getElementById('financeEditorForm'),n=f.elements.amount;n.value='2000000';n.dispatchEvent(new Event('input',{bubbles:true}));return {value:n.value,label:n.closest('label').textContent,type:n.type}})()`)
 assert.equal(money.value,'2,000,000');assert.equal(money.type,'text');assert.match(money.label,/تومان/)
 await evaluate('document.getElementById("financeEditorDialog").close();FinanceEditor.open("transactions")');assert.equal(await evaluate('document.getElementById("financeEditorForm").elements.amount.value'),'2,000,000')
 await evaluate('document.getElementById("financeEditorForm").querySelector("[data-close]").click()')
 await evaluate('goPage("calendar");UnifiedCalendar.openDay(DateContext.date,true)');await until('!!document.getElementById("calendarItemForm")')
 await evaluate(`document.getElementById('calendarInput-title').value='Calendar persistent draft';document.getElementById('calendarInput-description').value='Description before accidental close';document.getElementById('calendarInput-description').dispatchEvent(new Event('input',{bubbles:true}))`)
 // Real pointer events outside the dialog close it; a click inside leaves it open.
 const point=await evaluate('(()=>{const r=document.getElementById("calendarDayDialog").getBoundingClientRect();return {x:r.left+20,y:r.top+20}})()')
 for(const type of ['mousePressed','mouseReleased'])await send('Input.dispatchMouseEvent',{type,...point,button:'left',clickCount:1})
 assert.equal(await evaluate('document.getElementById("calendarDayDialog").open'),true)
 for(const type of ['mousePressed','mouseReleased'])await send('Input.dispatchMouseEvent',{type,x:2,y:2,button:'left',clickCount:1})
 await until('!document.getElementById("calendarDayDialog")')
 await navigate();await evaluate('UnifiedCalendar.openDay(DateContext.date)');await until('!!document.getElementById("calendarItemForm")')
 assert.equal(await evaluate('document.getElementById("calendarInput-title").value'),'Calendar persistent draft')
 await evaluate('document.getElementById("calendarItemForm")._noavaDraft.clear();AppOverlays.closeAll()')
 const course=await evaluate(`apiFetch('/api/modules/academic/items',{method:'POST',body:JSON.stringify({title:'Browser Math',note:'Term 1'})})`);created.push(['/api/modules/academic/items/',course.id])
 const project=await evaluate(`apiFetch('/api/projects',{method:'POST',body:JSON.stringify({name:'Browser course project'})})`);created.push(['/api/projects/',project.id])
 await evaluate('goPage("academic")');await until('document.querySelectorAll(".academic-week > section").length===7')
 await evaluate(`NoavaAcademic.openNew('class')`);await until('!!document.getElementById("calendarItemForm")')
 const defaults=await evaluate('({kind:document.getElementById("calendarInput-kind").value,repeat:document.getElementById("calendarInput-repeat_frequency").value})');assert.deepEqual(defaults,{kind:'class',repeat:'weekly'})
 await evaluate(`(()=>{const f=document.getElementById('calendarItemForm');f.elements.title.value='Linked weekly class';f.elements.course_id.value=${JSON.stringify(course.id)};f.elements.project_id.value=${JSON.stringify(project.id)};f.requestSubmit()})()`)
 await until('!UnifiedCalendar.state.busy && !document.getElementById("calendarItemForm")')
 const calendar=await evaluate('apiFetch("/api/calendar?from="+DateContext.date+"&to="+DateContext.date)');const item=calendar.entries.find(e=>e.title==='Linked weekly class');assert.ok(item);created.push(['/api/events/',item.id]);assert.equal(item.course_id,course.id);assert.equal(item.project_id,project.id);assert.equal(item.recurrence.frequency,'weekly')
 await evaluate(`(()=>{const r=[...document.querySelectorAll('.uc-agenda-item')].find(r=>r.dataset.key===${JSON.stringify(item.key)});r.querySelector('input').click()})()`)
 await until('!UnifiedCalendar.state.busy');assert.equal(await evaluate('document.querySelector(".uc-dialog-list article:last-child").classList.contains("done")'),true)
 await evaluate('AppOverlays.closeAll()')
 // Completion in the exact workspace list must be reversible and survive reload.
 const task=await evaluate(`apiFetch('/api/tasks',{method:'POST',body:JSON.stringify({title:'Workspace checkbox audit',due_date:DateContext.date,status:'todo'})})`);created.push(['/api/tasks/',task.id]);
 await evaluate(`goPage('workspace');setV11TaskView('list');document.getElementById('v11TaskSearch').value='Workspace checkbox audit';reloadV111Tasks()`);
 await until(`!!document.querySelector('.workspace-task[data-id="${task.id}"]')`);
 await evaluate(`document.querySelector('.workspace-task[data-id="${task.id}"] input').click()`);await until(`document.querySelector('.workspace-task[data-id="${task.id}"]')?.classList.contains('is-done')&&!document.querySelector('.workspace-task[data-id="${task.id}"] input').disabled`);
 assert.equal(await evaluate(`(async()=>{const tasks=await apiFetch('/api/tasks');return tasks.find(t=>t.id===${JSON.stringify(task.id)}).status})()`),'done');
 await evaluate(`document.querySelector('.workspace-task[data-id="${task.id}"] input').click()`);await until(`!document.querySelector('.workspace-task[data-id="${task.id}"]')?.classList.contains('is-done')&&!document.querySelector('.workspace-task[data-id="${task.id}"] input').disabled`);
 // Project report and meeting text must survive a full page reload.
 await evaluate(`openV11Inspector('project',${JSON.stringify(project.id)})`);await until('!!document.querySelector(".pw-report-form textarea")');
 await evaluate(`(()=>{const f=document.querySelector('.pw-report-form');f.elements.text.value='Report survives reload';f.elements.text.dispatchEvent(new Event('input',{bubbles:true}))})()`);
 await navigate();await evaluate(`openV11Inspector('project',${JSON.stringify(project.id)})`);await until('!!document.querySelector(".pw-report-form textarea")');assert.equal(await evaluate('document.querySelector(".pw-report-form textarea").value'),'Report survives reload');
 await evaluate(`document.querySelector('.pw-report-form')._noavaDraft.clear();AppOverlays.closeAll();goPage('meetings');v116OpenNew();document.getElementById('v116Agenda').value='Meeting survives reload';document.getElementById('v116Agenda').dispatchEvent(new Event('input',{bubbles:true}))`);
 await navigate();await evaluate(`goPage('meetings');v116OpenNew()`);assert.equal(await evaluate('document.getElementById("v116Agenda").value'),'Meeting survives reload');await evaluate('document.getElementById("v116Composer")._noavaDraft.clear();AppOverlays.closeAll()');
 // User-scoped draft keys must never restore another account's text.
 const isolation=await evaluate(`(()=>{const original=localStorage.getItem('nova_user');const form=document.createElement('form'),input=document.createElement('textarea');input.name='note';form.append(input);localStorage.setItem('nova_user',JSON.stringify({id:'draft-a'}));NoavaDrafts.bind(form,'isolation');input.value='private A';input.dispatchEvent(new Event('input',{bubbles:true}));localStorage.setItem('nova_user',JSON.stringify({id:'draft-b'}));const another=document.createElement('form');another.innerHTML='<textarea name="note"></textarea>';NoavaDrafts.bind(another,'isolation');const value=another.elements.note.value;NoavaDrafts.clearUser();localStorage.setItem('nova_user',JSON.stringify({id:'draft-a'}));NoavaDrafts.clearUser();original?localStorage.setItem('nova_user',original):localStorage.removeItem('nova_user');return value})()`)
 assert.equal(isolation,'')
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await evaluate('goPage("academic")');await until('document.querySelectorAll(".academic-week > section").length===7');assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'),true)
 assert.equal(errors.length,0,JSON.stringify(errors));console.log('PASS NOAVA browser: profile, branding, draft reload/recovery/discard/isolation, grouped TOMAN inputs, real backdrop/inside clicks, academic weekly/project/calendar links, completion sorting and mobile layout')
}finally{await evaluate('window.AppOverlays?.closeAll()').catch(()=>{});for(const [path,id]of created.reverse())await evaluate(`apiFetch(${JSON.stringify(path+id)},{method:'DELETE'}).catch(()=>{})`).catch(()=>{});await send('Emulation.clearDeviceMetricsOverride');socket.close()}
