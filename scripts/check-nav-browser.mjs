import assert from 'node:assert/strict'
const targets=await(await fetch('http://127.0.0.1:9227/json/list')).json()
const socket=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl)
await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject})
let sequence=0;const pending=new Map(),errors=[]
socket.onmessage=event=>{const m=JSON.parse(event.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result)}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails)}
function send(method,params={}){return new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}))})}
async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value}
const pause=ms=>new Promise(r=>setTimeout(r,ms))
try{
 await send('Runtime.enable');await send('Page.enable');await send('Network.enable');await send('Network.setCacheDisabled',{cacheDisabled:true});await send('Page.navigate',{url:'http://127.0.0.1:3001/?page=items'})
 for(let i=0;i<100;i++){if(await evaluate('document.querySelectorAll("#bank-bank .category-section").length===65'))break;await pause(200)}
 assert.equal(await evaluate(`(async()=>{const data=await(await fetch('/data/master-items.json')).json();return data.items.length})()`),3248)
 await evaluate('NovaBank.openAll()')
 const renderedRows=await evaluate('document.querySelectorAll("#bank-bank tr[data-id]").length')
 assert.ok(renderedRows>0&&renderedRows<=3248,'Bank categories retain paginated rows')
 assert.equal(await evaluate('document.querySelectorAll("#mainSidebar .nav-badge").length'),6)
 assert.equal(await evaluate(`[...document.querySelectorAll('#mainSidebar .nav-badge')].every(b=>b.closest('[data-nav-group="tasks"]'))`),true)
 await evaluate('NovaNavCounts.refresh()')
 const counts=await evaluate(`(async()=>{const d=await apiFetch('/api/v11.2/dashboard'),s=await apiFetch('/api/v11.11/integration');const ids=['v11TaskBadge','waitingNavBadge','projectNavBadge','meetingNavBadge','habitNavBadge','spiritualNavBadge'];return {actual:ids.map(id=>document.getElementById(id).textContent),expected:[d.summary.tasks_open,d.attention.waiting_count,d.summary.projects_active,d.meetings.week_count,d.routines.active,s.spiritual.summary.active].map(toFaNum)}})()`)
 assert.deepEqual(counts.actual,counts.expected)
 assert.equal(await evaluate(`document.querySelectorAll('#mainSidebar [data-page="habits"]').length`),1)
 assert.equal(await evaluate(`document.querySelector('[data-page="habits"]').closest('[data-nav-group="tasks"]')!==null`),true)
 assert.equal(await evaluate(`document.querySelector('[data-page="spiritual"]').closest('[data-nav-group="routines"]')!==null`),true)
 await evaluate(`document.getElementById('bank-topic').value='زبان انگلیسی';NovaBank.applyFilters()`)
 const filtered=await evaluate(`(()=>{const rows=[...document.querySelectorAll('#bank-bank tr[data-id]')].filter(r=>r.style.display!=='none');return {count:rows.length,valid:rows.every(r=>r.dataset.topic==='زبان انگلیسی')}})()`)
 assert.ok(filtered.count>0);assert.ok(filtered.valid)
 await evaluate(`NovaBank.clearFilters();document.getElementById('bank-review').checked=true;NovaBank.applyFilters()`)
 assert.ok(await evaluate(`[...document.querySelectorAll('#bank-bank tr[data-id]')].filter(r=>r.style.display!=='none').every(r=>r.dataset.review==='true')`))
 await evaluate('NovaBank.clearFilters()')
 for(const width of [1440,390]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width===390})
  for(const page of ['habits','spiritual','items']){
   await evaluate(`document.querySelectorAll('#mainSidebar details').forEach(d=>d.open=false);goPage('${page}')`)
   await pause(200)
   assert.equal(await evaluate(`document.querySelector('.page:not(.hidden)').id`),page)
   assert.equal(await evaluate('document.querySelectorAll("#mainSidebar .nav-badge").length'),6)
   assert.equal(await evaluate(`[...document.querySelectorAll('#mainSidebar .nav-badge')].every(b=>b.closest('[data-nav-group="tasks"]'))`),true)
   if(page!=='items')assert.equal(await evaluate(`document.querySelector('[data-nav-group="tasks"]').open&&document.querySelector('[data-nav-group="routines"]').open&&document.querySelector('[data-page="${page}"]').getAttribute('aria-current')==='page'`),true)
  }
 }
 await pause(600)
 assert.equal(errors.length,0,JSON.stringify(errors))
 console.log(JSON.stringify({rows:3248,taskSidebarBadges:6,countsMatchApi:true,topicFilter:filtered,routinesUnderTasks:true,spiritualUnderRoutines:true,desktopMobileNavigation:true,runtimeErrors:errors.length}))
}finally{socket.close()}
