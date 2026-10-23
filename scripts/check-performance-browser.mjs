import assert from 'node:assert/strict'
import fs from 'node:fs'
const base=process.env.NOVA_BASE_URL||'http://127.0.0.1:3006'
const port=process.env.NOVA_CDP_PORT||9228
const bank=JSON.parse(fs.readFileSync('public/data/master-items.json','utf8'))
const version=JSON.parse(fs.readFileSync('package.json','utf8')).version
const targets=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json()
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
async function evaluate(expression){const result=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result.value}
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))
async function until(expression){for(let i=0;i<100;i++){if(await evaluate(expression))return;await pause(100)}throw new Error('Timed out: '+expression)}
try{
 await send('Runtime.enable');await send('Network.enable');await send('Page.enable')
 await send('Storage.clearDataForOrigin',{origin:base,storageTypes:'all'})
 await send('Page.navigate',{url:base})
 await until('!!window.NovaBank')
 await pause(2400)
 assert.equal(requests.filter(url=>url.includes('master-items.json')).length,0)
 assert.equal(await evaluate('document.querySelectorAll("#bank-bank tr[data-id]").length'),0)
 for(const route of ['/api/v11.3/planning','/api/v11.5/schedule','/api/v11.6/meetings','/api/v11.7/control','/api/v11.8/learning','/api/v11.9/health-system','/api/v11.10/relationships','/api/v11.12/finance'])assert.ok(!requests.some(url=>url.includes(route)),route)
 assert.equal(await evaluate('document.getElementById("app-version").textContent'),'v'+version)
 console.log('PASS initial dashboard: no bank download or hidden-view API requests')
 await evaluate('goPage("items");NovaBank.ensureLoaded();NovaBank.ensureLoaded()')
 await until('document.querySelectorAll("#bank-bank .category-section").length===65')
 await pause(500)
 assert.equal(requests.filter(url=>url.includes('master-items.json')).length,1)
 assert.equal(await evaluate('document.querySelectorAll("#bank-macro option").length'),11)
 assert.equal(await evaluate('document.querySelectorAll("#bank-bank tr[data-id]").length'),0)
 const h=bank.categories.find(category=>category.count>100).h
 await evaluate(`NovaBank.jumpToCategory(${JSON.stringify(h)})`)
 const rows=()=>evaluate(`document.getElementById('bank-tbody-'+${JSON.stringify(h)}).children.length`)
 assert.equal(await rows(),50)
 await evaluate(`NovaBank.loadMore(${JSON.stringify(h)})`)
 assert.equal(await rows(),100)
 console.log('PASS bank: 65 categories, 10 domains, single download and 50-row pagination')
 const rendered=await evaluate('[...document.querySelectorAll("#bank-bank tr[data-id]")].map(row=>row.dataset.id)')
 const target=bank.items.find(item=>item.h===h&&!rendered.includes(item.id))
 assert.ok(target,'fixture must not be in the rendered page')
 await evaluate(`document.getElementById('bank-q').value=${JSON.stringify(target.id)};NovaBank.applyFilters();NovaBank.openMatching()`)
 const row=`document.querySelector('#bank-bank .category-section:not(.hidden) tr[data-id="${target.id}"]')`
 assert.ok(await evaluate(`!!${row}`))
 await evaluate(`${row}.querySelector('[data-action="edit"]').click();${row}.querySelector('.item-title-editor').value='Performance audit title';${row}.querySelector('.item-category-editor').value='E03';${row}.querySelector('.item-category-editor').dispatchEvent(new Event('change'));${row}.querySelector('[data-action="save"]').click()`)
 await until(`!!document.querySelector('#bank-tbody-E03 tr[data-id="${target.id}"]')`)
 assert.equal(await evaluate(`document.querySelector('tr[data-id="${target.id}"] .item-title').textContent`),'Performance audit title')
 await evaluate(`document.getElementById('bank-q').value=${JSON.stringify(target.id)};NovaBank.applyFilters();NovaBank.openMatching()`)
 await evaluate(`${row}.querySelector('[data-action="delete"]').click();document.querySelector('#bank-saveMessage button').click()`)
 assert.ok(await evaluate(`!!${row}`))
 await send('Page.reload',{ignoreCache:true})
 await pause(300)
 await until('typeof goPage==="function" && !!window.NovaBank')
 await evaluate('goPage("items");NovaBank.ensureLoaded()')
 await until('document.querySelectorAll("#bank-bank .category-section").length===65')
 await evaluate(`document.getElementById('bank-q').value=${JSON.stringify(target.id)};NovaBank.applyFilters();NovaBank.openMatching()`)
 assert.equal(await evaluate(`${row}.closest('article').dataset.h`),'E03')
 assert.equal(await evaluate(`${row}.querySelector('.item-title').textContent`),'Performance audit title')
 const topic=bank.items.find(item=>item.subcategory).subcategory
 await evaluate(`NovaBank.clearFilters();document.getElementById('bank-topic').value=${JSON.stringify(topic)};NovaBank.applyFilters();NovaBank.openMatching()`)
 assert.ok(await evaluate(`document.querySelectorAll('#bank-bank .category-section:not(.hidden) tbody tr').length>0 && [...document.querySelectorAll('#bank-bank .category-section:not(.hidden) tbody tr')].every(row=>row.dataset.topic===${JSON.stringify(topic)})`))
 await evaluate('NovaBank.clearFilters();document.getElementById("bank-review").checked=true;NovaBank.applyFilters();NovaBank.openMatching()')
 assert.ok(await evaluate('[...document.querySelectorAll("#bank-bank .category-section:not(.hidden) tbody tr")].every(row=>row.dataset.review==="true")'))
 await evaluate('goPage("calendar")')
 await until('!!window.UnifiedCalendar && !!window.UnifiedCalendar.state.from && !window.UnifiedCalendar.state.busy')
 assert.equal(await evaluate('window.UnifiedCalendar.state.error'),'')
 assert.equal(await evaluate('document.getElementById("calendar").classList.contains("hidden")'),false)
 assert.equal(errors.length,0,JSON.stringify(errors))
 console.log('PASS editing, category move, delete/undo, reload persistence, review filter and Persian calendar')
}finally{socket.close()}
