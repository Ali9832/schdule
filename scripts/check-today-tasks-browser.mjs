import assert from 'node:assert/strict'
const base=process.env.NOVA_BASE_URL||'http://127.0.0.1:3015'
const tabs=await(await fetch('http://127.0.0.1:9228/json/list')).json()
const socket=new WebSocket(tabs.find(tab=>tab.type==='page').webSocketDebuggerUrl)
await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject})
let sequence=0,accept=false;const pending=new Map(),ids=[],errors=[]
socket.onmessage=event=>{const message=JSON.parse(event.data);if(message.id){const task=pending.get(message.id);pending.delete(message.id);message.error?task.reject(message.error):task.resolve(message.result)}if(message.method==='Page.javascriptDialogOpening')void send('Page.handleJavaScriptDialog',{accept});if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails)}
const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}))})
async function evaluate(expression){const result=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result.value}
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))
async function until(expression){for(let i=0;i<100;i++){if(await evaluate(expression))return;await pause(100)}throw Error('Timeout: '+expression)}
const title='Today actions '+Date.now(),selector=id=>`#todayPageBody > div:nth-child(4) [data-task-id="${id}"]`
try{
 await send('Page.enable');await send('Runtime.enable');await send('Network.enable');await send('Network.setCacheDisabled',{cacheDisabled:true});await send('Network.setBypassServiceWorker',{bypass:true})
 await send('Page.navigate',{url:base});await pause(400);await until('typeof TodayTasks!=="undefined" && !!V112_DASH')
 for(const [name,status] of [[' Done','done'],[' Open','todo'],[' Progress','in_progress']]){
  const task=await evaluate(`apiFetch('/api/tasks',{method:'POST',body:JSON.stringify({title:${JSON.stringify(title+name)},due_date:DateContext.date,status:${JSON.stringify(status)}})})`);ids.push(task.id)
 }
 await evaluate('goPage("today")');await until(`!!document.querySelector(${JSON.stringify(selector(ids[1]))})`)
 const order=()=>evaluate('Array.from(document.querySelectorAll(".today-task-row")).map(row=>({id:row.dataset.taskId,done:row.classList.contains("is-done")}))')
 let rows=await order();assert.ok(rows.findIndex(row=>row.id===ids[0])>rows.findIndex(row=>row.id===ids[1]))
 assert.equal(await evaluate(`document.querySelector(${JSON.stringify(selector(ids[1]))}).querySelectorAll('button').length`),2)
 await evaluate(`document.querySelector(${JSON.stringify(selector(ids[1]))}).querySelector('input').click()`)
 await until('TodayTasks.pendingCount===0')
 assert.equal(await evaluate(`document.querySelector(${JSON.stringify(selector(ids[1]))}).classList.contains('is-done')`),true)
 assert.ok((await evaluate(`getComputedStyle(document.querySelector(${JSON.stringify(selector(ids[1]))}).querySelector('.today-task-content')).textDecorationLine`)).includes('line-through'))
 assert.ok(Number(await evaluate(`getComputedStyle(document.querySelector(${JSON.stringify(selector(ids[1]))}).querySelector('.today-task-content')).opacity`))<1)
 rows=await order();const firstDone=rows.findIndex(row=>row.done);assert.ok(rows.slice(firstDone).every(row=>row.done))
 // Failed optimistic uncheck rolls back without touching persisted/shared state.
 await evaluate(`window.__todayRequest=window.apiFetch;window.apiFetch=async()=>{await new Promise(resolve=>setTimeout(resolve,150));throw Error('Offline test')};document.querySelector(${JSON.stringify(selector(ids[1]))}).querySelector('input').click()`)
 await until('TodayTasks.pendingCount===0')
 assert.equal(await evaluate(`document.querySelector(${JSON.stringify(selector(ids[1]))}).querySelector('input').checked`),true)
 await evaluate('window.apiFetch=window.__todayRequest')
 await evaluate(`document.querySelector(${JSON.stringify(selector(ids[1]))}).querySelector('input').click()`)
 await until('TodayTasks.pendingCount===0')
 assert.equal(await evaluate(`document.querySelector(${JSON.stringify(selector(ids[1]))}).querySelector('input').checked`),false)
 // Existing edit form retains status/date while updating the title.
 await evaluate(`document.querySelector(${JSON.stringify(selector(ids[1]))}).querySelector('button:not(.today-task-delete)').click()`)
 await until('!document.getElementById("genericModalBg").classList.contains("hidden")')
 await evaluate(`document.getElementById('genericTitleInput').value=${JSON.stringify(title+' Edited')};saveGenericAdd()`)
 await until('document.getElementById("genericModalBg").classList.contains("hidden")')
 assert.equal(await evaluate(`document.querySelector(${JSON.stringify(selector(ids[1]))}).querySelector('strong').textContent`),title+' Edited')
 accept=false;await evaluate(`document.querySelector(${JSON.stringify(selector(ids[2]))}).querySelector('.today-task-delete').click()`);assert.equal(await evaluate(`!!document.querySelector(${JSON.stringify(selector(ids[2]))})`),true)
 accept=true;await evaluate(`document.querySelector(${JSON.stringify(selector(ids[2]))}).querySelector('.today-task-delete').click()`)
 await until(`!document.querySelector(${JSON.stringify(selector(ids[2]))})`)
 // Reload uses persisted values and still places done cards at the end.
 await send('Page.navigate',{url:base});await pause(400);await until('typeof TodayTasks!=="undefined" && !!V112_DASH');await evaluate('goPage("today")');await until(`!!document.querySelector(${JSON.stringify(selector(ids[1]))})`)
 assert.equal(await evaluate(`document.querySelector(${JSON.stringify(selector(ids[0]))}).querySelector('input').checked`),true)
 assert.equal(await evaluate(`document.querySelector(${JSON.stringify(selector(ids[1]))}).querySelector('strong').textContent`),title+' Edited')
 assert.equal(await evaluate(`!!document.querySelector(${JSON.stringify(selector(ids[2]))})`),false)
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true})
 assert.equal(await evaluate('document.querySelector(".today-task-card").scrollWidth<=document.querySelector(".today-task-card").clientWidth+1'),true)
 assert.equal(errors.length,0,JSON.stringify(errors))
 console.log('Today actions passed: exact fourth card, edit, confirmed/cancelled delete, completion styling/order, uncheck, failed-save rollback, persisted reload and mobile layout.')
}finally{
 await evaluate(`if(window.__todayRequest)window.apiFetch=window.__todayRequest`)
 for(const id of ids)await evaluate(`apiFetch('/api/tasks/${id}',{method:'DELETE'}).catch(()=>{})`)
 await send('Emulation.clearDeviceMetricsOverride');socket.close()
}
