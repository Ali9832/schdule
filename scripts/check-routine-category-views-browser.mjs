import assert from 'node:assert/strict';
const base=process.env.NOVA_BASE_URL||'http://127.0.0.1:3140';assert.ok(base.startsWith('http://127.0.0.1:')&&!base.endsWith(':3001'),'Use isolated local storage');
async function api(path,method='GET',body){const r=await fetch(base+path,{method,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});assert.ok(r.ok,await r.clone().text());return r.json();}
const routines=[];for(const type of ['general','spiritual','reading','exercise'])routines.push(await api('/api/habits','POST',{title:'Category view audit '+type,routine_type:type}));
// Reading has no delete API. Reuse one book confined to this isolated test store.
const book=(await api('/api/reading')).books.find(b=>b.title==='Preserved reading book audit')||(await api('/api/reading/books','POST',{title:'Preserved reading book audit',daily_minutes:25,reminder_enabled:false})).books.find(b=>b.title==='Preserved reading book audit');
const tabs=await(await fetch('http://127.0.0.1:9227/json/list')).json(),ws=new WebSocket(tabs.find(t=>t.type==='page'&&t.url.startsWith('http')).webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
let seq=0;const pending=new Map(),errors=[];ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){pending.get(m.id)(m.result);pending.delete(m.id);}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);};
const send=(method,params={})=>new Promise(r=>{pending.set(++seq,r);ws.send(JSON.stringify({id:seq,method,params}));});
async function ev(expression){const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;}
async function until(expression){for(let i=0;i<150;i++){if(await ev(expression))return;await new Promise(r=>setTimeout(r,80));}throw Error('Timeout: '+expression);}
try{
 await send('Page.bringToFront');await send('Runtime.enable');await send('Network.enable');await send('Network.setCacheDisabled',{cacheDisabled:true});await send('Network.setBypassServiceWorker',{bypass:true});await send('Page.navigate',{url:base});await until('window.NovaUIReady&&window.HabitCategoryViews');
 assert.equal(await ev('document.querySelectorAll("#mainSidebar [data-page=reading]").length'),1);assert.equal(await ev('document.querySelector("#mainSidebar [data-page=reading]").closest("[data-nav-group=routines]")!==null'),true);assert.equal(await ev('document.querySelector("#mainSidebar [data-page=sports]").closest("[data-nav-group=routines]")!==null'),true);
 for(const [page,type]of [['sports','exercise'],['reading','reading']]){
  await ev(`AppOverlays.closeAll();goPage('${page}')`);await until(`!!document.querySelector('#habitPeriodTable-${page} tbody tr')`);
  const text=await ev(`document.querySelector('#habitPeriodTable-${page} tbody').textContent`);assert.ok(text.includes('Category view audit '+type));for(const other of ['general','spiritual','reading','exercise'].filter(t=>t!==type))assert.equal(text.includes('Category view audit '+other),false);
  for(const mode of ['day','week','month','quarter','year']){await ev(`document.querySelector('#habitViews-${page} [data-habit-view=${mode}]').click()`);assert.equal(await ev(`HabitCategoryViews.${page}.mode`),mode);}
  await ev(`NoavaDrafts.clear('generic:new:habit:'+DateContext.date+':${type}');document.querySelector('#${page} .hero .primary').click()`);await until('!document.getElementById("genericModalBg").classList.contains("hidden")');assert.equal(await ev('document.getElementById("genericCategory").value'),type);
  const choices=await ev('[...document.getElementById("genericCategory").options].map(o=>o.value)');for(const type of ['general','spiritual','reading','exercise'])assert.ok(choices.includes(type));await ev('closeGenericAdd()');
 }
 await until(`document.querySelector('#readingBody').textContent.includes('Preserved reading book audit')`);assert.equal((await api('/api/reading')).books.find(b=>b.id===book.id).daily_minutes,25);
 await ev('goPage("habits")');await until('!!document.querySelector("#habitPeriodTable tbody tr")');const all=await ev('document.querySelector("#habitPeriodTable tbody").textContent');for(const type of ['general','spiritual','reading','exercise'])assert.ok(all.includes('Category view audit '+type));
 const duplicates=await ev('(()=>{const ids=[...document.querySelectorAll("[id]")].map(n=>n.id);return ids.filter((id,i)=>ids.indexOf(id)!==i)})()');assert.deepEqual(duplicates,[]);assert.deepEqual(errors,[]);
 console.log('PASS routine navigation placement, reading/exercise filtered period views, contextual category defaults, complete category list, preserved book data and unique DOM identifiers.');
}finally{await ev('AppOverlays.closeAll()').catch(()=>{});ws.close();for(const row of routines)await api('/api/habits/'+row.id,'DELETE');}
