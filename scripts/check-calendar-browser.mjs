import assert from 'node:assert/strict'
const tabs=await(await fetch('http://127.0.0.1:9227/json/list')).json()
const socket=new WebSocket(tabs.find(tab=>tab.type==='page').webSocketDebuggerUrl)
await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject})
let sequence=0;const pending=new Map(),errors=[],nativeDialogs=[]
socket.onmessage=event=>{const message=JSON.parse(event.data);if(message.id){const task=pending.get(message.id);pending.delete(message.id);message.error?task.reject(message.error):task.resolve(message.result)}if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails);if(message.method==='Page.javascriptDialogOpening')nativeDialogs.push(message.params)}
const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}))})
async function evaluate(expression){const result=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result.value}
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))
async function until(expression){for(let i=0;i<80;i++){if(await evaluate(expression))return;await pause(100)}const detail=await evaluate('({message:UnifiedCalendar.state.message,invalid:[...document.querySelectorAll("#calendarItemForm :invalid")].map(input=>({name:input.name,message:input.validationMessage})),error:document.querySelector(".uc-form-error")?.textContent})');throw Error('Timed out: '+expression+' '+JSON.stringify(detail))}
let created,savedPreferences;const title='Calendar UI regression '+Date.now()
try{
  await send('Runtime.enable');await send('Page.enable');await send('Network.enable');await send('Network.setBypassServiceWorker',{bypass:true});await send('Page.reload',{ignoreCache:true});await pause(500);await until("typeof UnifiedCalendar!=='undefined'")
  savedPreferences=await evaluate("localStorage.getItem('molibden.calendar.preferences.v1')")
  await evaluate("Object.assign(UnifiedCalendar.prefs,{showDone:true,hiddenKinds:[]});UnifiedCalendar.state.anchor='2026-10-18';goPage('calendar')");await until("document.getElementById('unifiedCalendar').getAttribute('aria-busy')==='false'")
  assert.equal(await evaluate("document.querySelector('.sidebar>.nav-item').dataset.page"),'calendar')
  for(const [anchor,view,from,to] of [['2025-03-20','month','2025-02-19','2025-03-20'],['2026-04-10','quarter','2026-03-21','2026-06-21'],['2026-04-10','year','2026-03-21','2027-03-20']]){
    await evaluate(`UnifiedCalendar.state.anchor='${anchor}';UnifiedCalendar.state.view='${view}'`)
    assert.deepEqual(await evaluate('UnifiedCalendar.range()'),{from,to})
  }
  let layoutChecks=0
  for(const width of [320,390,768,1440]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:950,deviceScaleFactor:1,mobile:width<700})
    for(const view of ['day','week','month','quarter','year']){
      await evaluate(`UnifiedCalendar.state.anchor='2026-10-18';UnifiedCalendar.state.view='${view}';UnifiedCalendar.load()`)
      assert.equal(await evaluate("document.documentElement.scrollWidth<=innerWidth+2"),true,`${view} at ${width}`)
      assert.equal(await evaluate("getComputedStyle(document.getElementById('unifiedCalendar')).direction"),'rtl')
      if(view==='quarter')assert.equal(await evaluate("document.querySelectorAll('.uc-mini-month').length"),3)
      if(view==='year')assert.equal(await evaluate("document.querySelectorAll('.uc-mini-month').length"),12)
      layoutChecks++
    }
  }
  await evaluate("UnifiedCalendar.state.view='month';UnifiedCalendar.state.anchor='2026-10-18';UnifiedCalendar.load();UnifiedCalendar.openDay('2026-10-18',true)")
  await evaluate(`document.getElementById('calendarInput-title').value=${JSON.stringify(title)};document.getElementById('calendarInput-kind').value='exam';document.getElementById('calendarInput-kind').dispatchEvent(new Event('change'));document.querySelector('#calendarItemForm [name=all_day]').checked=false;document.querySelector('#calendarItemForm [name=all_day]').dispatchEvent(new Event('change'));document.getElementById('calendarInput-start_time').value='14:00';document.getElementById('calendarInput-end_time').value='16:00';document.getElementById('calendarItemForm').requestSubmit()`)
  await until("!UnifiedCalendar.state.busy && !document.getElementById('calendarItemForm')")
  created=await evaluate(`UnifiedCalendar.state.entries.find(item=>item.title===${JSON.stringify(title)})`);assert.ok(created);assert.equal(created.kind,'exam');assert.equal(created.start_time,'14:00')
  assert.equal(await evaluate("document.querySelectorAll('#calendarDayDialog .uc-agenda-item input[type=checkbox]').length"),await evaluate("UnifiedCalendar.state.entries.filter(item=>item.date<='2026-10-18'&&item.end_date>='2026-10-18').length"))
  await evaluate(`document.querySelector('[data-key="${created.key}"] input[type=checkbox]').click()`)
  await until(`!UnifiedCalendar.state.busy && UnifiedCalendar.state.entries.find(item=>item.key==='${created.key}').done`)
  await send('Page.reload',{ignoreCache:true});await pause(500);await until("typeof UnifiedCalendar!=='undefined'")
  await evaluate("UnifiedCalendar.state.view='month';UnifiedCalendar.state.anchor='2026-10-18';goPage('calendar')")
  await until("document.getElementById('unifiedCalendar').getAttribute('aria-busy')==='false'")
  assert.equal(await evaluate(`UnifiedCalendar.state.entries.find(item=>item.key==='${created.key}').done`),true)
  await evaluate("UnifiedCalendar.openDay('2026-10-18')")
  await evaluate(`document.querySelector('[data-key="${created.key}"] .uc-edit').click();document.getElementById('calendarInput-date').value='2026-10-19';document.getElementById('calendarInput-date').dispatchEvent(new Event('change'));document.getElementById('calendarItemForm').requestSubmit()`)
  await until(`!UnifiedCalendar.state.busy && UnifiedCalendar.state.entries.find(item=>item.key==='${created.key}').date==='2026-10-19'`)
  assert.equal(await evaluate(`UnifiedCalendar.state.entries.find(item=>item.key==='${created.key}').end_date`),'2026-10-19')
  assert.equal(await evaluate(`!!document.querySelector('[data-key="${created.key}"]')`),false)
  await evaluate("UnifiedCalendar.openDay('2026-10-19')")
  // Failed saves preserve the user's draft and keep the dialog open.
  await evaluate(`document.querySelector('[data-key="${created.key}"] .uc-edit').click();document.getElementById('calendarInput-title').value='Retained draft';window.calendarTestApi=apiFetch;window.apiFetch=async(path,options)=>{if(options?.method==='PATCH')throw Error('Test save failure');return calendarTestApi(path,options)};document.getElementById('calendarItemForm').requestSubmit()`)
  await until('!UnifiedCalendar.state.busy')
  assert.equal(await evaluate("document.getElementById('calendarInput-title').value"),'Retained draft')
  await evaluate("window.apiFetch=calendarTestApi;document.querySelector('.uc-form-actions button[type=button]').click()")
  // Day manager remains complete even when a kind is hidden on the overview.
  await evaluate("UnifiedCalendar.prefs.hiddenKinds=['exam'];UnifiedCalendar.render();UnifiedCalendar.openDay('2026-10-19')")
  assert.equal(await evaluate(`!!document.querySelector('[data-key="${created.key}"]')`),true)
  for(const width of [320,390,1440]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:950,deviceScaleFactor:1,mobile:width<700})
    assert.equal(await evaluate("document.getElementById('calendarDayDialog').scrollWidth<=document.getElementById('calendarDayDialog').clientWidth+2"),true)
  }
  await evaluate(`document.querySelector('[data-key="${created.key}"] .uc-delete').click();document.querySelector('[data-key="${created.key}"] .uc-danger').click()`)
  await until(`!UnifiedCalendar.state.busy && !UnifiedCalendar.state.entries.some(item=>item.key==='${created.key}')`)
  created=null
  await evaluate("goPage('dashboard')");await pause(50)
  assert.equal(await evaluate("!!document.querySelector('#calendarDayDialog[open]')"),false)
  assert.deepEqual(errors,[]);assert.deepEqual(nativeDialogs,[])
  console.log(JSON.stringify({layoutChecks,views:5,jalaliLeapAndSeasonBounds:true,create:true,complete:true,move:true,delete:true,draftOnError:true,fullDayIgnoresOverviewFilters:true,navigationCleanup:true,runtimeErrors:0}))
}finally{
  if(created)await evaluate(`(window.calendarTestApi||apiFetch)('/api/calendar/${created.source}/${created.id}',{method:'DELETE'})`)
  await evaluate(`if(window.calendarTestApi)window.apiFetch=calendarTestApi;${savedPreferences===null?"localStorage.removeItem('molibden.calendar.preferences.v1')":`localStorage.setItem('molibden.calendar.preferences.v1',${JSON.stringify(savedPreferences||'{}')})`};AppOverlays.closeAll()`)
  socket.close()
}
