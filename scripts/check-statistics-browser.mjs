import assert from 'node:assert/strict'
const base=process.env.NOVA_BASE_URL||'http://127.0.0.1:3032'
assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname),'Run against an isolated local test store')
const tabs=await(await fetch((process.env.NOVA_BROWSER_DEBUG||'http://127.0.0.1:9227')+'/json/list')).json()
const socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl)
await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject})
let seq=0;const pending=new Map(),errors=[]
socket.onmessage=event=>{const m=JSON.parse(event.data);if(m.id){const task=pending.get(m.id);pending.delete(m.id);m.error?task.reject(m.error):task.resolve(m.result)}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails)}
const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}))})
async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value}
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
async function until(expression){for(let i=0;i<120;i++){if(await evaluate(expression))return;await sleep(100)}throw Error('Timeout: '+expression)}
const title='Statistics UI '+Date.now()
try{
 await send('Runtime.enable');await send('Page.enable');await send('Network.enable');await send('Network.setCacheDisabled',{cacheDisabled:true});await send('Network.setBypassServiceWorker',{bypass:true})
 await send('Page.navigate',{url:base});await until('window.NovaUIReady===true&&typeof V112_DASH!=="undefined"&&!!V112_DASH')
 await evaluate(`(async()=>{window.statsTestTask=await apiFetch('/api/tasks',{method:'POST',body:JSON.stringify({title:${JSON.stringify(title)},due_date:DateContext.today(),status:'todo'})});await apiFetch('/api/tasks/'+statsTestTask.id,{method:'PATCH',body:JSON.stringify({status:'done'})});})();`)
 await evaluate('goPage("statistics")');await until('document.querySelector(".stats-status")?.textContent.includes("روز")')
 assert.equal(await evaluate('document.querySelectorAll(".stats-chart").length'),0,'no charts before choosing a section')
 await evaluate(`document.querySelector('.stats-types input[value=tasks]').click()`)
 await until('document.querySelectorAll(".stats-chart").length===4')
 assert.equal(await evaluate(`Array.from(document.querySelectorAll('.stats-metric')).find(c=>c.textContent.includes('تکمیل با تاریخ پایان معتبر')).querySelector('strong').textContent`),'۱')
 await evaluate(`document.querySelector('.stats-types input[value=routines]').click();document.querySelector('.stats-types input[value=reading]').click()`)
 await until('document.querySelectorAll(".stats-chart").length===8')
 await evaluate(`document.querySelector('.stats-item-picker').open=true;const mode=document.querySelector('.stats-item-picker select');mode.value='selected';mode.dispatchEvent(new Event('change'));document.querySelector('.stats-item-picker input[type=search]').value=${JSON.stringify(title)};document.querySelector('.stats-item-picker input[type=search]').dispatchEvent(new Event('input'))`)
 await until('document.querySelectorAll(".stats-record-options input").length===1')
 await evaluate('document.querySelector(".stats-record-options input").click()')
 await until('document.querySelectorAll(".stats-chart").length===8')
 assert.equal(await evaluate('document.querySelector(".stats-metric strong").textContent'),'۱','the selected single task is the entire cohort')
 await evaluate(`document.querySelector('.stats-types input[value=routines]').click();document.querySelector('.stats-types input[value=reading]').click()`)
 await until('document.querySelectorAll(".stats-chart").length===4')
 // Multiple distinct records can be selected without aggregating another user's IDs.
 await evaluate(`(async()=>{await apiFetch('/api/tasks',{method:'POST',body:JSON.stringify({title:${JSON.stringify(title+' two')},due_date:DateContext.today()})});})()`)
 await until('document.querySelectorAll(".stats-record-options input").length===2')
 await evaluate('Array.from(document.querySelectorAll(".stats-record-options input")).find(c=>!c.checked).click()')
 await until('document.querySelector(".stats-metric strong")?.textContent==="۲"')
 // Date range changes do not silently reset item selection.
 await evaluate(`const range=document.querySelector('.stats-filters select');range.value='7';range.dispatchEvent(new Event('change'))`)
 await until('document.querySelector(".stats-status").textContent.includes("۷ روز")')
 assert.equal(await evaluate('document.querySelectorAll(".stats-record-options input:checked").length'),2)
 assert.equal(await evaluate('document.querySelectorAll(".stats-chart svg circle title").length>0'),true)
 await evaluate('document.querySelector(".stats-chart details").open=true')
 assert.equal(await evaluate('document.querySelectorAll(".stats-chart table tbody tr").length'),7)
 // Failed request must not leave old charts as though they were fresh.
 await evaluate(`window.statsOriginalFetch=window.fetch;window.fetch=(url,...args)=>String(url).startsWith('/api/statistics?')?Promise.resolve(new Response(JSON.stringify({error:'statistics outage'}),{status:503})):statsOriginalFetch(url,...args);document.querySelector('.stats-heading button').click();`)
 await until(`document.querySelector('.stats-error')?.textContent==='statistics outage'`)
 assert.equal(await evaluate('document.querySelectorAll(".stats-chart").length'),0)
 await evaluate(`window.fetch=statsOriginalFetch;document.querySelector('.stats-output button').click()`)
 await until('document.querySelectorAll(".stats-chart").length===4')
 for(const width of [390,1280,1920]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:950,deviceScaleFactor:1,mobile:width<600});await sleep(180)
  assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'),'no horizontal overflow at '+width)
 }
 await evaluate('document.body.classList.add("theme-dark")');await sleep(100)
 assert.ok(await evaluate('getComputedStyle(document.querySelector(".stats-chart")).backgroundColor!=="rgb(255, 255, 255)"'))
 assert.deepEqual(errors,[])
 console.log('PASS statistics browser: opt-in charts, multiple categories and records, dates, tables/tooltips, accurate completion, failure recovery, mobile and dark theme')
}finally{socket.close()}
