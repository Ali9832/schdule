import fs from 'node:fs'
import assert from 'node:assert/strict'
const port=process.env.NOVA_CDP_PORT||9226
const base=process.env.NOVA_BASE_URL||'http://127.0.0.1:3002'
const targets=await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
const target=targets.find(target=>target.type==='page')
const socket=new WebSocket(target.webSocketDebuggerUrl)
await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject})
let sequence=0
const pending=new Map(),errors=[],network=[],consoleErrors=[]
socket.onmessage=event=>{
 const message=JSON.parse(event.data)
 if(message.id){const request=pending.get(message.id);pending.delete(message.id);if(message.error)request?.reject(new Error(JSON.stringify(message.error)));else request?.resolve(message.result)}
 if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails)
 if(message.method==='Network.responseReceived'&&message.params.response.status>=400)network.push({status:message.params.response.status,url:message.params.response.url})
 if(message.method==='Runtime.consoleAPICalled'&&message.params.type==='error')consoleErrors.push(message.params.args.map(arg=>arg.description||arg.value).join(' '))
}
function send(method,params={}){return new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));})}
async function evaluate(expression){const result=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result.value}
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))
const results=[]
async function check(name,fn){try{const detail=await fn();results.push({name,passed:true,detail});console.log('PASS',name,JSON.stringify(detail||{}))}catch(error){results.push({name,passed:false,error:error.message});console.log('FAIL',name,error.message)}}
try{
 await send('Runtime.enable');await send('Network.enable');await send('Page.enable')
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false})
 errors.length=0;consoleErrors.length=0;network.length=0
 await send('Storage.clearDataForOrigin',{origin:base,storageTypes:'local_storage,service_workers,cache_storage'})
 await send('Page.navigate',{url:base+'/?page=items'});
 for(let attempt=0;attempt<80;attempt++){if(await evaluate('typeof goPage==="function" && document.querySelectorAll("#bank-bank tr[data-id]").length===3248'))break;await pause(250)}
 await check('Bank loads 3248 rows without iframe',async()=>{const state=await evaluate('({rows:document.querySelectorAll("#bank-bank tr[data-id]").length,iframe:!!document.querySelector("#items iframe"),active:!document.getElementById("items").classList.contains("hidden")})');assert.equal(state.rows,3248);assert.equal(state.iframe,false);return state})
 const pages=await evaluate('[...document.querySelectorAll(".nav-item[data-page]")].map(element=>element.dataset.page).filter((page,index,array)=>array.indexOf(page)===index)')
 for(const page of pages){
  await check('Tab '+page,async()=>{const previous=errors.length;await evaluate(`goPage(${JSON.stringify(page)})`);await pause(650);const state=await evaluate(`({active:!document.getElementById(${JSON.stringify(page)}).classList.contains('hidden'),text:document.getElementById(${JSON.stringify(page)}).innerText.length})`);assert.ok(state.active);assert.ok(state.text>0);assert.equal(errors.length,previous);return state})
 }
 await evaluate('goPage("items");NovaBank.openAll()')
 await check('Bank title has readable width',async()=>{const width=await evaluate('document.querySelector("#bank-bank tr[data-id] .item-title").closest("td").getBoundingClientRect().width');assert.ok(width>=250);return {width}})
 const first=await evaluate('document.querySelector("#bank-bank tr[data-id]").dataset.id')
 await check('Bank item connects to backend task by ID',async()=>{
  const task=await evaluate(`(async()=>{const row=document.querySelector('[data-id="${first}"]');window.__auditTask=await apiFetch('/api/tasks',{method:'POST',body:JSON.stringify({title:row.querySelector('.item-title').textContent,status:'todo',tags:['master:${first}']})});return window.__auditTask;})()`)
  assert.ok(task.id);return {taskId:task.id}
 })
 await check('Tick moves row to completed end and syncs dashboard',async()=>{
  await evaluate(`document.querySelector('[data-item="${first}"]').click()`);await pause(250)
  const state=await evaluate(`(()=>{const row=document.querySelector('[data-id="${first}"]');return {completed:row.classList.contains('item-completed'),after:[...row.parentElement.children].slice([...row.parentElement.children].indexOf(row)+1).every(row=>row.classList.contains('item-completed')),dashboard:document.querySelector('[data-master-check="${first}"]')?.checked};})()`)
  assert.ok(state.completed);assert.ok(state.after);assert.equal(state.dashboard,true);
  const backend=await evaluate('(async()=>{const tasks=await apiFetch("/api/tasks");return tasks.find(task=>task.id===window.__auditTask.id).status})()');assert.equal(backend,'done');return {...state,backend}
 })
 await check('Dashboard untick updates bank and restores order',async()=>{
  await evaluate(`document.querySelector('[data-master-check="${first}"]').click()`);await pause(250)
  const state=await evaluate(`(()=>{const row=document.querySelector('[data-id="${first}"]');return {checked:row.querySelector('[data-item]').checked,completed:row.classList.contains('item-completed'),first:row.parentElement.firstElementChild===row}})()`)
  assert.equal(state.checked,false);assert.equal(state.completed,false);assert.ok(state.first);
  const backend=await evaluate('(async()=>{const tasks=await apiFetch("/api/tasks");return tasks.find(task=>task.id===window.__auditTask.id).status})()');assert.equal(backend,'todo');return {...state,backend}
 })
 await check('Inline editing saves title',async()=>{
  await evaluate(`(()=>{const row=document.querySelector('[data-id="${first}"]');row.querySelector('[data-action="edit"]').click();row.querySelector('.item-title-editor').value='Browser audit edited item';row.querySelector('[data-action="save"]').click();})()`);await pause(200)
  for(let attempt=0;attempt<40;attempt++){if(await evaluate(`!document.querySelector('[data-id="${first}"] .item-edit')`))break;await pause(100)}
  assert.equal(await evaluate(`!!document.querySelector('[data-id="${first}"] .item-edit')`),false)
  const title=await evaluate(`document.querySelector('[data-id="${first}"] .item-title').textContent`);assert.equal(title,'Browser audit edited item');return {title}
 })
 await check('Delete and undo restore bank row',async()=>{
  await evaluate(`document.querySelector('[data-id="${first}"] [data-action="delete"]').click()`)
  assert.equal(await evaluate(`!!document.querySelector('[data-id="${first}"]')`),false)
  await evaluate('document.querySelector("#bank-saveMessage button").click()')
  assert.equal(await evaluate(`!!document.querySelector('[data-id="${first}"]')`),true)
 })
 await check('Search filters by edited title',async()=>{
  await evaluate('document.getElementById("bank-q").value="Browser audit edited item";NovaBank.applyFilters()')
  const count=await evaluate('[...document.querySelectorAll("#bank-bank tr[data-id]")].filter(row=>row.style.display!=="none").length');assert.equal(count,1);await evaluate('NovaBank.clearFilters()');return {count}
 })
 await check('Mobile bank keeps title readable and page fits',async()=>{
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await pause(150)
  const state=await evaluate('({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,titleWidth:document.querySelector("#bank-bank .item-title").closest("td").getBoundingClientRect().width})');assert.ok(state.titleWidth>=250);assert.ok(state.scrollWidth<=state.width+2);return state
 })
 const mobile=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync('test-results/bank-mobile.png',Buffer.from(mobile.data,'base64'))
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false})
 await evaluate('goPage("items");scrollTo(0,0)');await pause(150)
 const screenshot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync('test-results/bank-desktop.png',Buffer.from(screenshot.data,'base64'))
 await evaluate('apiFetch("/api/tasks/"+window.__auditTask.id,{method:"DELETE"})')
}finally{
 fs.writeFileSync('test-results/browser-audit.json',JSON.stringify({base,results,errors,consoleErrors,network},null,2))
 socket.close()
}
console.log('RESULT',JSON.stringify({passed:results.filter(result=>result.passed).length,failed:results.filter(result=>!result.passed).length,exceptions:errors.length,consoleErrors:consoleErrors.length,networkErrors:network.length}))
if(results.some(result=>!result.passed)||errors.length)process.exitCode=1
