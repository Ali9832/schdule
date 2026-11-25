import assert from 'node:assert/strict';
const base=process.env.NOVA_BASE_URL||'http://127.0.0.1:3140';
assert.ok(base.startsWith('http://127.0.0.1:')&&!base.endsWith(':3001'),'Use isolated test storage');
async function api(path,method='GET',body){const r=await fetch(base+path,{method,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});assert.ok(r.ok,await r.clone().text());return r.json();}
const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const habit=await api('/api/habits','POST',{title:'Routine edit audit',description:'Preserve this description',target_weekly:3,color:'#123456',status:'active',logs:{[date]:true}});
const tabs=await(await fetch('http://127.0.0.1:9227/json/list')).json();
const ws=new WebSocket(tabs.find(t=>t.type==='page'&&t.url.startsWith('http')).webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
let seq=0;const pending=new Map(),errors=[];
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){pending.get(m.id)(m.result);pending.delete(m.id);}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);};
const send=(method,params={})=>new Promise(r=>{pending.set(++seq,r);ws.send(JSON.stringify({id:seq,method,params}));});
async function ev(expression){const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;}
async function until(expression){for(let i=0;i<150;i++){if(await ev(expression))return;await new Promise(r=>setTimeout(r,80));}throw Error('Timeout: '+expression);}
try{
 await send('Page.bringToFront');await send('Runtime.enable');await send('Network.enable');await send('Network.setCacheDisabled',{cacheDisabled:true});await send('Network.setBypassServiceWorker',{bypass:true});await send('Page.navigate',{url:base});await until('window.NovaUIReady&&window.NoavaWorkspace');
 await ev(`AppOverlays.closeAll();window.__habitApi=apiFetch;window.__habitAlert=alert;window.__habitCalls=[];window.__habitAlerts=[];window.alert=m=>window.__habitAlerts.push(m);window.apiFetch=async(p,o)=>{window.__habitCalls.push({path:p,method:o?.method||'GET'});return window.__habitApi(p,o)};goPage('habits')`);
 await until(`!![...document.querySelectorAll('.habit-edit-mini')].find(b=>(b.dataset.habitId==='${habit.id}'||b.getAttribute('onclick')?.includes('${habit.id}')))`);
 // Reproduce the matrix-only load: its canonical row exists while the legacy cache does not.
 await ev(`BASE_DATA=null;[...document.querySelectorAll('.habit-edit-mini')].find(b=>(b.dataset.habitId==='${habit.id}'||b.getAttribute('onclick')?.includes('${habit.id}'))).click()`);
 await until(`!document.getElementById('genericModalBg').classList.contains('hidden')`);
 assert.deepEqual(await ev('BASE_EDIT'),{kind:'habit',id:habit.id});assert.equal(await ev('document.getElementById("genericNotes").value'),habit.description);
 await ev(`document.getElementById('genericTitleInput').value='Edited routine audit';document.getElementById('genericAddForm').requestSubmit()`);
 await until(`document.getElementById('genericModalBg').classList.contains('hidden')`);
 let saved=(await api('/api/habits')).find(h=>h.id===habit.id);assert.equal(saved.title,'Edited routine audit');assert.equal(saved.description,habit.description);assert.equal(saved.target_weekly,3);assert.equal(saved.color,'#123456');assert.equal(saved.logs[date],true);
 // Stale dashboard data must not overwrite current canonical notes or misroute an edit.
 await api('/api/habits/'+habit.id,'PATCH',{description:'New canonical description'});
 await ev(`BASE_DATA={habits:[],stats:{}};baseEditModule('habit','${habit.id}','Stale title')`);await until(`!document.getElementById('genericModalBg').classList.contains('hidden')`);
 assert.equal(await ev('document.getElementById("genericNotes").value'),'New canonical description');assert.equal(await ev('document.getElementById("genericTitleInput").value'),'Edited routine audit');
 await ev(`document.getElementById('genericNotes').value='Updated note audit';document.getElementById('genericAddForm').requestSubmit()`);await until(`document.getElementById('genericModalBg').classList.contains('hidden')`);
 saved=(await api('/api/habits')).find(h=>h.id===habit.id);assert.equal(saved.description,'Updated note audit');assert.equal(saved.logs[date],true);
 const calls=await ev('window.__habitCalls');assert.equal(calls.filter(c=>c.path===`/api/habits/${habit.id}`&&c.method==='PATCH').length,2);assert.equal(calls.some(c=>c.path.startsWith('/api/modules/habit')),false);assert.deepEqual(await ev('window.__habitAlerts'),[]);assert.deepEqual(errors,[]);
 console.log('PASS routine matrix edits with missing/stale dashboard cache, correct PATCH route, preserved notes/target/color/logs and canonical title lookup.');
}finally{await ev('AppOverlays.closeAll();if(window.__habitApi)window.apiFetch=window.__habitApi;if(window.__habitAlert)window.alert=window.__habitAlert').catch(()=>{});ws.close();await api('/api/habits/'+habit.id,'DELETE');}
