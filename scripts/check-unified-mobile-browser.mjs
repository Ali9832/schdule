import assert from 'node:assert/strict'
import fs from 'node:fs'
const base=process.env.NOVA_BASE_URL||'http://127.0.0.1:3037'
const tabs=await(await fetch('http://127.0.0.1:9227/json/list')).json(),ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl)
await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject});let id=0;const pending=new Map(),errors=[]
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result)}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text)}
const send=(method,params={})=>new Promise((resolve,reject)=>{pending.set(++id,{resolve,reject});ws.send(JSON.stringify({id,method,params}))})
async function ev(expression){const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value}
const pause=ms=>new Promise(r=>setTimeout(r,ms));async function until(expression){for(let i=0;i<120;i++){if(await ev(expression))return;await pause(100)}throw Error('Timeout '+expression)}
async function bounds(selector){return ev(`(()=>{const root=document.querySelector(${JSON.stringify(selector)}),bad=[];for(const n of root.querySelectorAll('input,select,textarea,button,summary')){const r=n.getBoundingClientRect();if(!r.width||!r.height||getComputedStyle(n).visibility==='hidden')continue;if(r.left<-1||r.right>innerWidth+1)bad.push({id:n.id||n.className,left:r.left,right:r.right});}return bad})()`)}
try{
 await send('Runtime.enable');await send('Page.enable');await send('Network.enable');await send('Network.setCacheDisabled',{cacheDisabled:true});await send('Network.setBypassServiceWorker',{bypass:true});await send('Page.navigate',{url:base});await until('window.NovaUIReady && !!V112_DASH && !!window.UnifiedCalendar.openComposer')
 await ev('AppOverlays.closeAll();NoavaDrafts.clear("calendar:new:"+DateContext.date)')
 for(const width of [320,390,768]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:true})
  await ev('goPage("calendar");document.querySelector(".uc-header .uc-primary").click()');await until('!!document.getElementById("calendarItemForm") && !UnifiedCalendar.state.referencesLoading')
  const calendarDefaults=await ev('({kind:document.getElementById("calendarInput-kind").value,date:document.getElementById("calendarInput-date").value})');assert.equal(calendarDefaults.kind,'task')
  assert.deepEqual(await bounds('#calendarDayDialog'),[],`calendar composer at ${width}`)
  await ev('AppOverlays.closeAll();goPage("today");document.querySelector("#today button[onclick*=openGenericAdd]").click()');await until('!!document.getElementById("calendarItemForm")')
  assert.deepEqual(await ev('({kind:document.getElementById("calendarInput-kind").value,date:document.getElementById("calendarInput-date").value})'),calendarDefaults)
  assert.equal(await ev('document.getElementById("genericModalBg").classList.contains("hidden")'),true,'both actions use the same form')
  if(width===390){
   const title='Unified mobile task '+crypto.randomUUID();await ev(`document.getElementById('calendarInput-title').value=${JSON.stringify(title)};document.getElementById('calendarItemForm').requestSubmit()`);await until('!UnifiedCalendar.state.busy && !document.getElementById("calendarItemForm")');await ev('AppOverlays.closeAll()');await until(`document.getElementById('today').innerText.includes(${JSON.stringify(title)})`);
   const task=await ev(`apiFetch('/api/tasks').then(rows=>rows.find(t=>t.title===${JSON.stringify(title)}))`);assert.ok(task);await ev(`apiFetch('/api/tasks/${task.id}',{method:'DELETE'})`);
  }
  await ev('AppOverlays.closeAll();goPage("workspace")');await until('!V111_PAGE.loading')
  const controls=await ev('[...document.querySelectorAll(".v11-filter-row>input,.v11-filter-row>select")].map(n=>({id:n.id,width:n.getBoundingClientRect().width,height:n.getBoundingClientRect().height}))')
  for(const control of controls){assert.ok(control.width>=120,JSON.stringify({width,control}));assert.ok(control.height>=44,JSON.stringify(control))}
  assert.deepEqual(await bounds('.v11-filter-row'),[])
  await ev('document.querySelector("#v114SavedViews summary").click()');await pause(100)
  const popup=await ev('(()=>{const r=document.querySelector(".saved-filter-popover").getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom}})()');assert.ok(popup.left>=0&&popup.right<=width&&popup.top>=0&&popup.bottom<=900,JSON.stringify(popup))
  await ev('SavedFiltersUI.close(false)')
  if(width===390){const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync('.local/mobile-task-filters.png',Buffer.from(shot.data,'base64'))}
  for(const [page,open,selector] of [['meetings','v116OpenNew()','#v116Composer'],['goals','v117OpenOutcome()','#v117Composer'],['academic','v118OpenComposer()','#v118Composer']]){
   await ev(`AppOverlays.closeAll();goPage(${JSON.stringify(page)})`);await pause(200);await ev(open);await pause(200);assert.deepEqual(await bounds(selector),[],`${selector} at ${width}`);await ev('AppOverlays.closeAll()')
  }
 }
 assert.deepEqual(errors,[]);console.log('PASS same task/calendar composer, date/type defaults, readable filters, saved-filter popup and meeting/goal/resource composers at 320/390/768px')
}finally{ws.close()}
