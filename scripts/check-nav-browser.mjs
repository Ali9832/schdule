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
 for(let i=0;i<100;i++){if(await evaluate('typeof NovaNavCounts!=="undefined" && document.querySelectorAll("#bank-bank tr[data-id]").length===3248'))break;await pause(200)}
 await pause(1200);await evaluate('NovaNavCounts.refresh()');await pause(600)
 assert.equal(await evaluate('document.querySelectorAll("#bank-bank tr[data-id]").length'),3248)
 const comparison=await evaluate(`(async()=>{const d=await apiFetch('/api/v11.2/dashboard');return {badge:document.getElementById('habitNavBadge').textContent,expected:toFaNum(d.routines.active),taskBadge:document.getElementById('v11TaskBadge').textContent,tasks:toFaNum(d.summary.tasks_open)}})()`)
 assert.equal(comparison.badge,comparison.expected);assert.equal(comparison.taskBadge,comparison.tasks)
 await evaluate(`document.getElementById('bank-topic').value='زبان انگلیسی';NovaBank.applyFilters()`)
 const filtered=await evaluate(`(()=>{const rows=[...document.querySelectorAll('#bank-bank tr[data-id]')].filter(r=>r.style.display!=='none');return {count:rows.length,valid:rows.every(r=>r.dataset.topic==='زبان انگلیسی')}})()`)
 assert.ok(filtered.count>0);assert.ok(filtered.valid)
 await evaluate(`NovaBank.clearFilters();document.getElementById('bank-review').checked=true;NovaBank.applyFilters()`)
 assert.ok(await evaluate(`[...document.querySelectorAll('#bank-bank tr[data-id]')].filter(r=>r.style.display!=='none').every(r=>r.dataset.review==='true')`))
 await evaluate('NovaBank.clearFilters()')
 const initial=await evaluate(`document.getElementById('v11TaskBadge').textContent`)
 let task;
 try{
  task=await evaluate(`apiFetch('/api/tasks',{method:'POST',body:JSON.stringify({title:'بررسی موقت شمارنده منو',status:'todo',priority:'low'})})`)
  await pause(1000)
  const changed=await evaluate(`document.getElementById('v11TaskBadge').textContent`)
  assert.notEqual(changed,initial)
  await evaluate(`apiFetch('/api/tasks/${task.id}',{method:'PATCH',body:JSON.stringify({status:'done'})})`);await pause(1000)
  assert.equal(await evaluate(`document.getElementById('v11TaskBadge').textContent`),initial)
 }finally{if(task)await evaluate(`apiFetch('/api/tasks/${task.id}',{method:'DELETE'})`)}
 await pause(600)
 assert.equal(errors.length,0,JSON.stringify(errors))
 console.log(JSON.stringify({rows:3248,counts:comparison,topicFilter:filtered,liveTaskCreateCompleteDelete:true,runtimeErrors:errors.length}))
}finally{socket.close()}
