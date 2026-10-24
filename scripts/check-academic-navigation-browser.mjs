import assert from 'node:assert/strict'
import fs from 'node:fs'
const base=process.env.NOVA_BASE_URL||'http://127.0.0.1:3027'
const tabs=await(await fetch('http://127.0.0.1:9227/json/list')).json()
const ws=new WebSocket(tabs.find(t=>t.type==='page'&&t.url.startsWith('http://127.0.0.1:')).webSocketDebuggerUrl)
await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject})
let id=0;const pending=new Map(),errors=[]
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result)}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text)}
const send=(method,params={})=>new Promise((resolve,reject)=>{pending.set(++id,{resolve,reject});ws.send(JSON.stringify({id,method,params}))})
async function ev(expression){const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value}
const pause=ms=>new Promise(r=>setTimeout(r,ms))
async function until(expression){for(let i=0;i<120;i++){if(await ev(expression))return;await pause(100)}throw Error('Timeout '+expression)}
async function ready(){await until('document.getElementById("academicBody").getAttribute("aria-busy")==="false" && !!document.querySelector(".academic-week-panel .planning-date-bar")')}
try{
 await send('Runtime.enable');await send('Page.enable');await send('Network.enable');await send('Network.setCacheDisabled',{cacheDisabled:true});await send('Network.setBypassServiceWorker',{bypass:true});await send('Page.navigate',{url:base});await pause(400);await until('!!window.NoavaAcademic && !!V112_DASH')
 await ev("sessionStorage.setItem('noava.overdue:local-demo:'+DateContext.today(),'1');AppOverlays.closeAll();goPage('academic')");await ready()
 const selected=await ev('DateContext.date')
 assert.equal(await ev("document.querySelectorAll('#academic .planning-date-bar').length"),1)
 assert.equal(await ev("!!document.querySelector('#academicBody .academic-week-panel .planning-date-bar')"),true)
 await ev("document.querySelector('#academic [aria-label=\"هفتهٔ بعد\"]').click()");await ready();assert.equal(await ev('DateContext.date'),await ev(`DateContext.shift('${selected}',7)`))
 await ev("document.querySelector('#academic [aria-label=\"هفتهٔ قبل\"]').click()");await ready();assert.equal(await ev('DateContext.date'),selected)
 await ev("(()=>{const n=document.querySelector('#academic .planning-date-input');n.value='2026-12-09';n.dispatchEvent(new Event('change',{bubbles:true}))})()");await ready()
 assert.match(await ev("document.querySelector('.academic-week>section>button').textContent"),/۱۴۰۵/)
 assert.equal(await ev("document.querySelectorAll('#academic .planning-date-bar').length"),1)
 await ev("document.querySelector('#academic [aria-label=\"بازگشت به امروز تهران\"]').click()");await ready();assert.equal(await ev('DateContext.date===DateContext.today()'),true)
 // Filters and date bar survive rebuilding; the new item follows the selected day.
 await ev("(()=>{const s=document.getElementById('academicKindFilter');s.value='exam';s.dispatchEvent(new Event('change',{bubbles:true}));const k=document.getElementById('academicNewKind');k.value='quiz';k.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('.academic-add>button').click()})()");await until('!!document.getElementById("calendarItemForm")')
 assert.equal(await ev('document.getElementById("calendarItemForm").elements.kind.value'),'quiz')
 assert.equal(await ev('document.getElementById("calendarItemForm").elements.date.value===DateContext.date'),true)
 await ev('AppOverlays.closeAll();UnifiedCalendar.openDay(DateContext.date,true,{kind:"class",all_day:false})');await until('!!document.getElementById("calendarItemForm")')
 const controls=await ev(`(()=>{const f=document.getElementById('calendarItemForm');return ['date','start_time','end_time'].map(name=>{const n=f.elements[name],b=n.parentElement.querySelector('button'),r=b.getBoundingClientRect();return {name,dir:getComputedStyle(n).direction,align:getComputedStyle(n).textAlign,button:b.textContent,visible:r.width>=36&&r.height>=36}})})()`)
 for(const n of controls){assert.equal(n.dir,'ltr');assert.equal(n.align,'left');assert.ok(n.visible)}
 assert.match(controls[1].button,/ساعت/)
 await ev("document.getElementById('calendarInput-start_time').parentElement.querySelector('button').click()");await until('!!document.querySelector(".persian-time-picker[open]")')
 assert.equal(await ev("(()=>{const n=document.querySelectorAll('.persian-time-picker .persian-spin');return n[0].getBoundingClientRect().x<n[1].getBoundingClientRect().x})()"),true)
 await ev("document.querySelector('.persian-time-picker .persian-calendar-actions button:nth-child(2)').click();document.getElementById('calendarInput-date').parentElement.querySelector('button').click()")
 assert.equal(await ev("(()=>{const n=document.querySelectorAll('.persian-calendar .persian-spin');return n.length===3&&n[0].getBoundingClientRect().x<n[1].getBoundingClientRect().x&&n[1].getBoundingClientRect().x<n[2].getBoundingClientRect().x})()"),true)
 await ev("document.querySelector('.persian-calendar').close();AppOverlays.closeAll()")
 for(const width of [1280,390]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width===390});await ev("goPage('academic')");await ready()
  assert.equal(await ev('document.documentElement.scrollWidth<=innerWidth+1'),true)
  assert.equal(await ev("document.querySelectorAll('#academic .planning-date-bar').length"),1)
  fs.mkdirSync('.local',{recursive:true});const screenshot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(`.local/academic-v220-${width}.png`,Buffer.from(screenshot.data,'base64'))
 }
 assert.deepEqual(errors,[]);console.log('PASS academic weekly navigation, date jump/today, no duplicate date bars, filters/add defaults, visible clock buttons, LTR date/time fields and picker columns, desktop/mobile layout.')
}finally{await ev("document.querySelector('.persian-calendar')?.close();AppOverlays.closeAll()").catch(()=>{});await send('Emulation.clearDeviceMetricsOverride');ws.close()}
