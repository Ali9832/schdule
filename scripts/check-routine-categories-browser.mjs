import assert from 'node:assert/strict';
const base=process.env.NOVA_BASE_URL||'http://127.0.0.1:3140';assert.ok(base.startsWith('http://127.0.0.1:')&&!base.endsWith(':3001'),'Use isolated test storage');
async function api(path,method='GET',body){const r=await fetch(base+path,{method,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});assert.ok(r.ok,await r.clone().text());return r.json();}
const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const ids=[],habit=await api('/api/habits','POST',{title:'Category edit audit',description:'Keep category notes',target_weekly:3,logs:{[date]:true}});ids.push(habit.id);
const custom=await api('/api/habits','POST',{title:'Custom category audit',routine_type:'مطالعه'});ids.push(custom.id);
const tabs=await(await fetch('http://127.0.0.1:9227/json/list')).json(),ws=new WebSocket(tabs.find(t=>t.type==='page'&&t.url.startsWith('http')).webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
let seq=0;const pending=new Map(),errors=[];ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){pending.get(m.id)(m.result);pending.delete(m.id);}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);};
const send=(method,params={})=>new Promise(r=>{pending.set(++seq,r);ws.send(JSON.stringify({id:seq,method,params}));});
async function ev(expression){const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;}
async function until(expression){for(let i=0;i<150;i++){if(await ev(expression))return;await new Promise(r=>setTimeout(r,80));}throw Error('Timeout: '+expression);}
try{
 await send('Page.bringToFront');await send('Runtime.enable');await send('Network.enable');await send('Network.setCacheDisabled',{cacheDisabled:true});await send('Network.setBypassServiceWorker',{bypass:true});await send('Page.navigate',{url:base});await until('window.NovaUIReady&&window.RoutineCategories');
 await ev(`AppOverlays.closeAll();NoavaDrafts.clear('generic:new:habit:'+DateContext.date);openGenericAdd('habit')`);await until('!document.getElementById("genericModalBg").classList.contains("hidden")');
 const options=await ev('[...document.getElementById("genericCategory").options].map(o=>({value:o.value,text:o.textContent}))');
 assert.deepEqual(options.slice(0,2),[{value:'general',text:'عمومی'},{value:'spiritual',text:'معنوی'}]);assert.ok(options.some(o=>o.value==='مطالعه'));assert.equal(options.some(o=>o.text==='همهٔ روتین‌ها'),false);
 assert.equal(await ev('getComputedStyle(document.getElementById("genericStatus").closest(".field")).display'),'none');
 await ev(`document.getElementById('genericTitleInput').value='Created spiritual category audit';document.getElementById('genericCategory').value='spiritual';document.getElementById('genericAddForm').requestSubmit()`);await until('document.getElementById("genericModalBg").classList.contains("hidden")');
 const created=(await api('/api/habits')).find(h=>h.title==='Created spiritual category audit');assert.ok(created);ids.push(created.id);assert.equal(created.routine_type,'spiritual');
 await ev(`baseEditModule('habit','${habit.id}','Stale')`);await until('!document.getElementById("genericModalBg").classList.contains("hidden")');assert.equal(await ev('document.getElementById("genericCategory").value'),'general');
 await ev(`document.getElementById('genericCategory').value='spiritual';document.getElementById('genericAddForm').requestSubmit()`);await until('document.getElementById("genericModalBg").classList.contains("hidden")');
 let saved=(await api('/api/habits')).find(h=>h.id===habit.id);assert.equal(saved.routine_type,'spiritual');assert.equal(saved.logs[date],true);assert.equal(saved.description,'Keep category notes');assert.equal(saved.target_weekly,3);
 await api('/api/v11.11/spiritual-routines/'+habit.id,'PATCH',{title:'Edited from spiritual audit'});await api('/api/v11.11/spiritual-routines/'+habit.id+'/toggle','POST',{date,value:false});
 saved=(await api('/api/habits')).find(h=>h.id===habit.id);assert.equal(saved.title,'Edited from spiritual audit');assert.equal(saved.logs[date],false);assert.equal(saved.routine_type,'spiritual');assert.equal(saved.target_weekly,3);
 await ev(`baseEditModule('habit','${habit.id}','Stale')`);await until('!document.getElementById("genericModalBg").classList.contains("hidden")');assert.equal(await ev('document.getElementById("genericCategory").value'),'spiritual');
 await ev(`document.getElementById('genericCategory').value='general';document.getElementById('genericAddForm').requestSubmit()`);await until('document.getElementById("genericModalBg").classList.contains("hidden")');assert.equal((await api('/api/habits')).find(h=>h.id===habit.id).routine_type,'general');
 await ev(`openGenericAdd('project')`);await until('!document.getElementById("genericModalBg").classList.contains("hidden")');assert.notEqual(await ev('getComputedStyle(document.getElementById("genericStatus").closest(".field")).display'),'none');assert.equal(await ev('document.getElementById("genericCategory").options[0].value'),'عمومی');
 assert.deepEqual(errors,[]);console.log('PASS dynamic routine categories, create/edit persistence, category round-trip, spiritual editor/check-in compatibility, preserved notes/logs/targets and routine-only status hiding.');
}finally{await ev('AppOverlays.closeAll()').catch(()=>{});ws.close();for(const id of ids)await api('/api/habits/'+id,'DELETE');}
