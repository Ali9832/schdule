import assert from 'node:assert/strict'

// Run against an isolated memory-backed server, never the user's normal store.
const base=process.env.NOVA_BASE_URL||'http://127.0.0.1:3032'
const debug=process.env.NOVA_BROWSER_DEBUG||'http://127.0.0.1:9227'
const health=await(await fetch(base+'/api/health')).json()
assert.equal(health.storage,'memory','Use an isolated memory-backed test server')
assert.notEqual(new URL(base).port,'3001','Do not mutate the normal development instance')
const tabs=await(await fetch(debug+'/json/list')).json(),ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl)
await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject})
let sequence=0;const pending=new Map(),errors=[]
ws.onmessage=event=>{const m=JSON.parse(event.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result)}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text)}
const send=(method,params={})=>new Promise((resolve,reject)=>{pending.set(++sequence,{resolve,reject});ws.send(JSON.stringify({id:sequence,method,params}))})
async function ev(expression){const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value}
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))
async function until(expression){for(let i=0;i<120;i++){if(await ev(expression))return;await pause(100)}throw Error('Timeout: '+expression)}
const api=async path=>{const r=await fetch(base+path);assert.equal(r.ok,true,path);return r.json()}
const label='Integrated tools '+Date.now()
async function open(route,host,panel){await ev(`goPage(${JSON.stringify(route)})`);await until(`document.querySelector('.page:not(.hidden)').id===${JSON.stringify(host)}&&document.getElementById(${JSON.stringify(panel)}).open&&!document.getElementById(${JSON.stringify(panel)}).hasAttribute('aria-busy')`)}
try{
 await send('Runtime.enable');await send('Network.enable');await send('Network.setBypassServiceWorker',{bypass:true});await send('Page.navigate',{url:base})
 await until(`!!window.IntegratedTools&&!!window.DateContext&&typeof V112_DASH!=='undefined'&&!!V112_DASH`)
 await ev(`sessionStorage.setItem('noava.overdue:local-demo:'+DateContext.today(),'1');AppOverlays.closeAll()`)
 assert.equal(await ev(`document.querySelectorAll('.page#areas,.page#resources,.page#health,.page#religious').length`),0)
 const hosts={projectAreasTools:'projects',academicLearningTools:'academic',habitHealthTools:'habits',habitCheckupTools:'habits'};assert.equal(await ev(`document.querySelectorAll('#calendarAppointmentTools,#calendarOccasionTools').length`),0)
 for(const[id,host]of Object.entries(hosts))assert.equal(await ev(`document.getElementById('${id}').closest('.page').id`),host)

 await open('areas','projects','projectAreasTools')
 await ev(`document.getElementById('v117NewArea').value=${JSON.stringify(label)};v117CreateArea()`)
 await until(`V117_DATA.areas.some(a=>a.name===${JSON.stringify(label)})`)
 const area=(await api('/api/v11.7/control')).areas.find(a=>a.name===label);assert.ok(area)
 await ev(`window.testAsk=AppDialogs.ask;AppDialogs.ask=async(message)=>message.includes('توضیح')?'Integrated area description':'Integrated area standard';v117EditArea('${area.id}')`)
 await until(`V117_DATA.areas.find(a=>a.id==='${area.id}').standard==='Integrated area standard'`)
 await ev(`AppDialogs.ask=window.testAsk;goPage('workspace')`)
 await until(`!![...document.getElementById('v11TaskArea').options].find(o=>o.value==='${area.id}')`)

 await open('resources','academic','academicLearningTools')
 await ev(`v118OpenComposer();document.getElementById('v118Title').value=${JSON.stringify(label)};document.getElementById('v118Area').value='${area.id}';document.getElementById('v118NextAction').value='Read integrated resource';v118Save()`)
 await until(`V118_DATA.items.some(r=>r.title===${JSON.stringify(label)})`)
 const resource=(await api('/api/v11.8/learning')).items.find(r=>r.title===label);assert.equal(resource.area_id,area.id)
 await ev(`v118OpenComposer('${resource.id}');v118PromoteProject()`)
 await until(`V118_DATA.items.find(r=>r.id==='${resource.id}').linked.some(l=>l.type==='project')`)
 await ev(`AppDialogs.ask=async()=>${JSON.stringify(label+' task')};v118CreateAction()`)
 await until(`V118_DATA.items.find(r=>r.id==='${resource.id}').linked.some(l=>l.type==='task')`)
 await ev(`AppDialogs.ask=window.testAsk;v118CloseComposer()`)
 const linked=(await api('/api/v11.8/learning')).items.find(r=>r.id===resource.id).linked
 assert.ok(linked.some(l=>l.type==='project'));assert.ok(linked.some(l=>l.type==='task'))

 // A failed save must retain the draft and must not invent a local resource.
 await ev(`v118OpenComposer();document.getElementById('v118Title').value='Keep this unsaved draft';window.testApi=apiFetch;window.apiFetch=async(path,options)=>{if(path==='/api/v11.8/resources'&&options?.method==='POST')throw Error('Test offline');return window.testApi(path,options)};v118Save()`)
 await pause(200)
 assert.equal(await ev(`document.getElementById('v118Composer').classList.contains('open')&&document.getElementById('v118Title').value==='Keep this unsaved draft'&&!V118_DATA.items.some(r=>r.title==='Keep this unsaved draft')`),true)
 await ev(`window.apiFetch=window.testApi;v118CloseComposer();window.apiFetch=async(path,options)=>{if(path==='/api/v11.8/learning')throw Error('Test load failure');return window.testApi(path,options)};IntegratedTools.refresh('academic',true)`)
 await until(`!!document.querySelector('#academicLearningTools .integrated-status button')`)
 await ev(`window.apiFetch=window.testApi;document.querySelector('#academicLearningTools .integrated-status button').click()`)
 await until(`!document.querySelector('#academicLearningTools .integrated-status').textContent`)

 await open('health','habits','habitHealthTools')
 await ev(`document.getElementById('v119Date').value=DateContext.today();document.getElementById('v119Energy').value='7';document.getElementById('v119Sleep').value='8';v119SaveCheckin()`)
 await until(`V119_DATA.metrics.find(m=>m.slug==='energy').latest_value===7`)
 assert.equal((await api('/api/v11.9/health-system')).metrics.find(m=>m.slug==='energy').latest_value,7)
 await ev(`document.getElementById('v119CustomName').value=${JSON.stringify(label)};document.getElementById('v119CustomUnit').value='min';v119AddMetric()`)
 await until(`V119_DATA.metrics.some(m=>m.name===${JSON.stringify(label)})`)
 assert.ok((await api('/api/v11.9/health-system')).metrics.some(m=>m.name===label))

 await open('appointments','habits','habitHealthTools');await ev(`document.getElementById('habitCheckupTools').open=true`)
 const day=await ev(`DateContext.shift(DateContext.today(),3)`)
 await ev(`document.getElementById('v119ApptTitle').value=${JSON.stringify(label+' appointment')};document.getElementById('v119ApptStart').value='${day}T10:00';document.getElementById('v119ApptEnd').value='${day}T11:00';v119AddAppointment()`)
 await until(`V119_DATA.appointments.some(a=>a.title===${JSON.stringify(label+' appointment')})`)
 // Existing event records and preparation APIs remain available without the removed panel.
 await ev(`(async()=>{V1111_DATA=await apiFetch('/api/v11.11/religious-events',{method:'POST',body:JSON.stringify({title:${JSON.stringify(label+' occasion')},date:'${day}',time:'09:00'})});const event=V1111_DATA.religious.events.find(e=>e.title===${JSON.stringify(label+' occasion')});V1111_DATA=(await apiFetch('/api/v11.11/religious-events/'+event.id+'/create-task',{method:'POST',body:JSON.stringify({})})).payload;})()`)
 const calendar=await api(`/api/calendar?from=${day}&to=${day}`)
 assert.ok(calendar.entries.some(e=>e.title===label+' appointment'))
 assert.ok(calendar.entries.some(e=>e.title===label+' occasion'))
 assert.ok((await api('/api/tasks')).some(t=>t.title.includes(label+' occasion')))

 // Checkup controls remain usable, and changing the host day preserves a manually edited appointment date.
 await ev(`document.getElementById('v119ApptStart').value='${day}T12:00';DateContext.set(DateContext.shift(DateContext.today(),1))`)
 await pause(400)
 assert.equal(await ev(`document.getElementById('v119ApptStart').value`),day+'T12:00')
 for(const width of [1440,390]){
   await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width===390})
   for(const[route,host,id]of [['areas','projects','projectAreasTools'],['resources','academic','academicLearningTools'],['health','habits','habitHealthTools'],['appointments','habits','habitHealthTools']]){
     await open(route,host,id);await pause(120)
     assert.equal(await ev(`document.documentElement.scrollWidth<=innerWidth+1`),true,route+' overflow at '+width)
   }
 }
 assert.deepEqual(errors,[])
 console.log('PASS integrated hosts and redirects; area create/edit and task filter; resource/project/task links; failed-save draft and load retry; health checkin/metric; compact checkup host; preserved events visible in calendar; preparation task; date preservation; desktop/mobile; no runtime exceptions.')
}finally{await ev(`if(window.testApi)window.apiFetch=window.testApi;if(window.testAsk)AppDialogs.ask=window.testAsk;AppOverlays.closeAll()`).catch(()=>{});ws.close()}
