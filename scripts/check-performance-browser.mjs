import assert from 'node:assert/strict'
const base='http://127.0.0.1:3004'
const targets=await(await fetch('http://127.0.0.1:9228/json/list')).json()
const socket=new WebSocket(targets.find(target=>target.type==='page').webSocketDebuggerUrl)
await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject})
let sequence=0
const pending=new Map(),requests=[],errors=[]
socket.onmessage=event=>{
 const message=JSON.parse(event.data)
 if(message.id){const job=pending.get(message.id);pending.delete(message.id);message.error?job.reject(new Error(JSON.stringify(message.error))):job.resolve(message.result)}
 if(message.method==='Network.requestWillBeSent')requests.push(message.params.request.url)
 if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails)
}
const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}))})
async function evaluate(expression){const result=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.text);return result.result.value}
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))
async function until(expression){for(let i=0;i<100;i++){if(await evaluate(expression))return;await pause(100)}throw new Error('Timed out: '+expression)}
try{
 await send('Runtime.enable');await send('Network.enable');await send('Page.enable')
 await send('Page.navigate',{url:base})
 await until('!!window.NovaBank')
 await pause(2200)
 assert.equal(requests.filter(url=>url.includes('master-items.json')).length,0)
 assert.equal(await evaluate('document.querySelectorAll("#bank-bank tr[data-id]").length'),0)
 for(const route of ['/api/v11.3/planning','/api/v11.5/schedule','/api/v11.6/meetings','/api/v11.7/control','/api/v11.8/learning','/api/v11.9/health-system','/api/v11.10/relationships','/api/v11.12/finance'])assert.ok(!requests.some(url=>url.includes(route)),route)
 console.log('PASS dashboard: no bank download or hidden-view requests')
 await evaluate('goPage("items");NovaBank.ensureLoaded();NovaBank.ensureLoaded()')
 await until('document.querySelectorAll("#bank-bank .category-section").length===23')
 assert.equal(requests.filter(url=>url.includes('master-items.json')).length,1)
 assert.equal(await evaluate('document.querySelectorAll("#bank-bank tr[data-id]").length'),0)
 const h=await evaluate('document.querySelector("#bank-bank .category-section").dataset.h')
 await evaluate(`NovaBank.toggleSection(${JSON.stringify(h)})`)
 const rows=()=>evaluate(`document.getElementById('bank-tbody-'+${JSON.stringify(h)}).children.length`)
 assert.equal(await rows(),50)
 await evaluate(`NovaBank.loadMore(${JSON.stringify(h)})`)
 assert.ok(await rows()>50)
 console.log('PASS bank: one download, closed categories have no rows, pagination works')
 const title='performance audit unique title'
 await evaluate(`(()=>{const row=document.querySelector('#bank-bank tr[data-id]');row.querySelector('[data-action="edit"]').click();row.querySelector('textarea.item-title-editor').value=${JSON.stringify(title)};row.querySelector('[data-action="save"]').click();})()`)
 await evaluate(`document.getElementById('bank-q').value=${JSON.stringify(title)};NovaBank.applyFilters();NovaBank.openMatching()`)
 assert.equal(await evaluate('document.querySelectorAll("#bank-bank .category-section:not(.hidden) tr[data-id]").length'),1)
 await evaluate('document.querySelector("#bank-bank .category-section:not(.hidden) [data-action=delete]").click();document.querySelector("#bank-saveMessage button").click()')
 assert.equal(await evaluate('document.querySelectorAll("#bank-bank .category-section:not(.hidden) tr[data-id]").length'),1)
 await evaluate('NovaBank.clearFilters();NovaBank.openAll()')
 const count=await evaluate('document.querySelectorAll("#bank-bank tr[data-id]").length')
 assert.ok(count<=23*50)
 assert.equal(errors.length,0,JSON.stringify(errors))
 console.log('PASS editing, search, delete/undo; open-all rows capped:',count)
}finally{socket.close()}
