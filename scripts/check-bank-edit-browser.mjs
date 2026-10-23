import assert from 'node:assert/strict'
const targets=await(await fetch('http://127.0.0.1:9227/json/list')).json()
const socket=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl)
await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject})
let sequence=0;const pending=new Map()
socket.onmessage=event=>{const m=JSON.parse(event.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result)}}
function send(method,params={}){return new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}))})}
async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value}
const pause=ms=>new Promise(r=>setTimeout(r,ms))
async function ready(){await pause(300);for(let i=0;i<100;i++){if(await evaluate('typeof NovaBank!=="undefined" && document.querySelectorAll("#bank-bank .category-section").length===65')){await evaluate('NovaBank.openAll();document.querySelectorAll("#bank-bank .category-section").forEach(section=>{while(!section.querySelector(".bank-load-more").hidden)NovaBank.loadMore(section.dataset.h)})');return}await pause(150)}throw new Error('Bank did not load')}
let snapshot;
try{
 await send('Page.enable');await send('Network.enable');await send('Network.setCacheDisabled',{cacheDisabled:true});await send('Page.navigate',{url:'http://127.0.0.1:3001/?page=items'});await ready();await pause(500)
 snapshot=await evaluate(`localStorage.getItem('nova-master-items-edits-v1')`)
 const fixture=await evaluate(`(()=>{const edits=JSON.parse(localStorage.getItem('nova-master-items-edits-v1')||'{}'),rows=[...document.querySelectorAll('#bank-bank tr[data-id]')];const row=rows.find(r=>!edits[r.dataset.id]?.taskId&&r.closest('article').dataset.h!=='E03');row.querySelector('[data-action="edit"]').click();return {id:row.dataset.id,from:row.closest('article').dataset.h,before:document.getElementById('bank-count-E03').textContent}})()`)
 const row=`document.querySelector('tr[data-id="${fixture.id}"]')`
 assert.equal(await evaluate(`${row}.querySelector('.item-category-editor').value`),fixture.from)
 await evaluate(`${row}.querySelector('.item-title-editor').value='';${row}.querySelector('[data-action="save"]').click()`)
 assert.ok(await evaluate(`!!${row}.querySelector('.item-edit')`))
 await evaluate(`(()=>{const row=${row},select=row.querySelector('.item-category-editor');row.querySelector('.item-title-editor').value='عنوان ویرایش‌شده <آزمایش> &';select.value='E03';select.dispatchEvent(new Event('change'));row.querySelector('[data-action="save"]').click()})()`)
 await pause(300)
 const moved=await evaluate(`({title:${row}.querySelector('.item-title').textContent,category:${row}.closest('article').dataset.h,editing:!!${row}.querySelector('.item-edit'),edits:JSON.parse(localStorage.getItem('nova-master-items-edits-v1'))['${fixture.id}'],count:document.getElementById('bank-count-E03').textContent})`)
 assert.equal(moved.title,'عنوان ویرایش‌شده <آزمایش> &');assert.equal(moved.category,'E03');assert.equal(moved.editing,false);assert.notEqual(moved.count,fixture.before);assert.equal(moved.edits.h,'E03')
 await send('Page.reload',{ignoreCache:true});await ready();await pause(400)
 assert.equal(await evaluate(`${row}.closest('article').dataset.h`),'E03');assert.equal(await evaluate(`${row}.querySelector('.item-title').textContent`),moved.title)
 await evaluate(`${row}.querySelector('[data-action="edit"]').click();${row}.querySelector('.item-category-editor').value='E01';${row}.querySelector('.item-title-editor').value='لغو ویرایش';${row}.querySelector('[data-action="cancel"]').click()`)
 assert.equal(await evaluate(`${row}.closest('article').dataset.h`),'E03');assert.equal(await evaluate(`${row}.querySelector('.item-title').textContent`),moved.title)
 console.log('Browser: edit title/category/subgroup, blank-title validation, destination counts, reload persistence and cancel passed.')
}finally{
 if(snapshot!==undefined){await evaluate(snapshot===null?`localStorage.removeItem('nova-master-items-edits-v1')`:`localStorage.setItem('nova-master-items-edits-v1',${JSON.stringify(snapshot)})`);await send('Page.reload',{ignoreCache:true})}
 socket.close()
}
