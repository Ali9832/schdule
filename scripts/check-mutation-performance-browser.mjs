import assert from 'node:assert/strict'
const base=process.env.NOVA_BASE_URL||'http://127.0.0.1:3012'
const audit=process.env.NOVA_AUDIT_ONLY==='1'
const tabs=await(await fetch('http://127.0.0.1:9228/json/list')).json()
const socket=new WebSocket(tabs.find(tab=>tab.type==='page').webSocketDebuggerUrl)
await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject})
let sequence=0;const pending=new Map()
socket.onmessage=event=>{const message=JSON.parse(event.data);if(message.id){const task=pending.get(message.id);pending.delete(message.id);message.error?task.reject(message.error):task.resolve(message.result)}}
const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}))})
async function evaluate(expression){const result=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result.value}
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))
async function until(expression){for(let i=0;i<120;i++){if(await evaluate(expression))return;await pause(100)}throw Error('Timeout: '+expression)}
const title='Mutation timing '+Date.now()
try{
 await send('Page.enable');await send('Network.enable');await send('Network.setCacheDisabled',{cacheDisabled:true});await send('Network.setBypassServiceWorker',{bypass:true})
 await send('Page.navigate',{url:base});await pause(400);await until('typeof DateContextUI!=="undefined" && !!V112_DASH')
 await evaluate('goPage("workspace")');await until('!V111_PAGE.loading && !!V11_DATA');await pause(600)
 const report=await evaluate(`(async()=>{
 const request=window.apiFetch;window.__mutationOriginal=request;window.__mutationCalls=[];
 window.apiFetch=async function(path,options={}){const entry={path,method:options.method||'GET',start:performance.now()};window.__mutationCalls.push(entry);await new Promise(resolve=>setTimeout(resolve,150));const result=await request(path,options);entry.end=performance.now();return result};
 openGenericAdd('daily','Timing');document.getElementById('genericTitleInput').value=${JSON.stringify(title)};
 const started=performance.now();await saveGenericAdd();const finished=performance.now();const row=[...document.querySelectorAll('.workspace-task')].find(row=>row.textContent.includes(${JSON.stringify(title)}));
 const write=window.__mutationCalls.find(x=>x.method==='POST');return {elapsed:finished-started,afterWrite:finished-write.end,visible:!!row,calls:window.__mutationCalls.map(x=>({path:x.path,method:x.method}))};})()`)
 console.log(JSON.stringify({mode:audit?'baseline':'fixed',...report},null,2))
 if(!audit){
  assert.equal(report.visible,true,'Saved task appears before reconciliation reads finish')
  assert.ok(report.afterWrite<120,'Confirmation does not wait for another network round trip')
  await pause(1000)
  const reads=await evaluate('window.__mutationCalls.filter(x=>x.method==="GET").map(x=>x.path)')
  assert.ok(!reads.some(path=>['/api/bootstrap','/api/modules','/api/v11/bootstrap'].includes(path)),'No application-wide reload after creating one task')
  assert.ok(reads.filter(path=>path.startsWith('/api/v11/tasks/paged')).length<=1,'Only one paged reconciliation')
  // Server failures must not leave a phantom task or discard the draft.
  await evaluate(`window.apiFetch=async()=>{throw Error('Save failure test')};openGenericAdd('daily','Failure');document.getElementById('genericTitleInput').value='Unsaved draft';saveGenericAdd()`)
  await pause(200)
  assert.equal(await evaluate('!document.getElementById("genericModalBg").classList.contains("hidden")'),true)
  assert.equal(await evaluate('document.getElementById("genericTitleInput").value'),'Unsaved draft')
  assert.equal(await evaluate('V111_PAGE.items.some(x=>x.title==="Unsaved draft")'),false)
  console.log('PASS: immediate confirmed result, bounded background reads, no full bootstrap reload, failed-save draft retained.')
 }
}finally{await evaluate('if(window.__mutationOriginal)window.apiFetch=window.__mutationOriginal;window.closeGenericAdd?.()');socket.close()}
