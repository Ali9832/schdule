import assert from 'node:assert/strict'

const targets=await(await fetch('http://127.0.0.1:9227/json/list')).json()
const socket=new WebSocket(targets.find(target=>target.type==='page').webSocketDebuggerUrl)
await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject})
let sequence=0
const pending=new Map(),errors=[],nativeDialogs=[]
socket.onmessage=event=>{
  const message=JSON.parse(event.data)
  if(message.id){const handler=pending.get(message.id);pending.delete(message.id);message.error?handler.reject(message.error):handler.resolve(message.result)}
  if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails)
  if(message.method==='Page.javascriptDialogOpening')nativeDialogs.push(message.params)
}
const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}))})
async function evaluate(expression){const result=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result.value}
const pause=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds))
async function until(expression){for(let attempt=0;attempt<60;attempt++){if(await evaluate(expression))return;await pause(100)}throw Error('Timed out: '+expression)}
let project
try{
  await send('Page.enable');await send('Runtime.enable');await send('Network.enable');await send('Network.setBypassServiceWorker',{bypass:true})
  await send('Page.navigate',{url:'http://127.0.0.1:3001/'})
  await until("typeof AppOverlays!=='undefined' && typeof V11_DATA!=='undefined' && V11_DATA")
  project=await evaluate("apiFetch('/api/projects',{method:'POST',body:JSON.stringify({name:'Editing regression temporary project'})})")
  await evaluate("goPage('projects')");await pause(300)
  await evaluate(`openV11Inspector('project',${JSON.stringify(project.id)})`)
  await until("!document.getElementById('v11InspectorEditBtn').disabled")
  await evaluate("document.getElementById('v11InspectorEditBtn').click()")
  assert.equal(await evaluate("document.querySelector('.record-edit-form').dataset.entityType"),'project')
  assert.equal(await evaluate("document.querySelector('.page:not(.hidden)').id"),'projects')
  for(const width of [320,390,1440]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<700});await pause(100)
    assert.equal(await evaluate("(()=>{const shell=document.getElementById('v11Inspector').getBoundingClientRect();return [...document.querySelectorAll('.record-edit-form input,.record-edit-form select,.record-edit-form textarea,.record-edit-form button')].every(e=>{const r=e.getBoundingClientRect();return r.left>=shell.left-2&&r.right<=shell.right+2})})()"),true)
  }
  // A failed save keeps the form and entered values available for retry.
  await evaluate("window.failedSaveOriginal=apiFetch;window.apiFetch=async (path,options)=>{if(options?.method==='PATCH')throw Error('Test save failure');return failedSaveOriginal(path,options)};document.getElementById('recordEdit-name').value='Retry temporary project';document.querySelector('.record-edit-form').requestSubmit()")
  await until("!document.querySelector('.record-edit-form button[type=submit]').disabled")
  assert.equal(await evaluate("document.getElementById('recordEdit-name').value"),'Retry temporary project')
  assert.equal(await evaluate("document.querySelector('.record-edit-error').textContent"),'Test save failure')
  await evaluate("window.apiFetch=failedSaveOriginal")
  await evaluate("document.getElementById('recordEdit-name').value='Edited temporary project';document.getElementById('recordEdit-lifecycle_status').value='incubating';document.querySelector('.record-edit-form').requestSubmit()")
  await until("!document.querySelector('#v11InspectorBody .record-edit-form')")
  const saved=await evaluate(`apiFetch('/api/v11/inspector/project/${project.id}')`)
  assert.equal(saved.entity.name,'Edited temporary project');assert.equal(saved.entity.lifecycle_status,'incubating')
  await evaluate("goPage('dashboard')")
  assert.equal(await evaluate("document.getElementById('v11Inspector').classList.contains('open')"),false)
  assert.equal(await evaluate("document.getElementById('v11Inspector').getAttribute('aria-hidden')"),'true')

  const canonical=await evaluate("apiFetch('/api/v11/bootstrap')")
  const types={task:'tasks',area:'areas',resource:'resources',outcome:'outcomes',routine:'routines',event:'events',meeting:'meetings'}
  let editors=1
  for(const [type,key]of Object.entries(types)){
    const entity=canonical[key]?.[0];if(!entity)continue
    await evaluate(`openV11Inspector(${JSON.stringify(type)},${JSON.stringify(entity.id)})`)
    await until("!document.getElementById('v11InspectorEditBtn').disabled")
    await evaluate("document.getElementById('v11InspectorEditBtn').click()")
    assert.equal(await evaluate("document.querySelector('.record-edit-form').dataset.entityType"),type)
    await evaluate("goPage('control-center')")
    assert.equal(await evaluate("document.getElementById('v11Inspector').classList.contains('open')"),false)
    editors++
  }
  for(const id of ['v116Composer','v117Composer','v118Composer']){
    await evaluate(`document.getElementById('${id}').classList.add('open');goPage('dashboard')`)
    assert.equal(await evaluate(`document.getElementById('${id}').classList.contains('open')`),false)
  }
  await evaluate("openGenericAdd('general','Temporary');goPage('dashboard')")
  assert.equal(await evaluate("document.getElementById('genericModalBg').classList.contains('hidden')"),true)
  await evaluate("window.pendingQuestion=AppDialogs.ask('Temporary question','value');void 0")
  assert.equal(await evaluate("document.querySelector('.app-question').open"),true)
  await evaluate("goPage('dashboard')")
  assert.equal(await evaluate('window.pendingQuestion'),null)

  // Late fetches and saves must never reopen a panel on another page.
  await evaluate("window.beforeEditingTestApi=apiFetch;window.apiFetch=async (...args)=>{const value=await beforeEditingTestApi(...args);if(String(args[0]).includes('/inspector/'))await new Promise(r=>setTimeout(r,400));return value}")
  await evaluate(`openV11Inspector('project',${JSON.stringify(project.id)});goPage('dashboard');void 0`)
  await pause(600)
  assert.equal(await evaluate("document.getElementById('v11Inspector').classList.contains('open')"),false)
  await evaluate("window.apiFetch=beforeEditingTestApi")
  await evaluate(`openV11Inspector('project',${JSON.stringify(project.id)})`)
  await until("!document.getElementById('v11InspectorEditBtn').disabled")
  await evaluate("document.getElementById('v11InspectorEditBtn').click();window.apiFetch=async (...args)=>{const value=await beforeEditingTestApi(...args);if(args[1]?.method==='PATCH')await new Promise(r=>setTimeout(r,400));return value};document.getElementById('recordEdit-name').value='Late save temporary project';document.querySelector('.record-edit-form').requestSubmit();goPage('control-center')")
  await pause(700)
  assert.equal(await evaluate("document.getElementById('v11Inspector').classList.contains('open')"),false)
  await evaluate("window.apiFetch=beforeEditingTestApi")
  assert.deepEqual(errors,[]);assert.deepEqual(nativeDialogs,[])
  console.log(JSON.stringify({editors,projectSaveVerified:true,navigationCleanup:true,questionCancellation:true,lateFetchAndSaveGuard:true,runtimeErrors:errors.length,nativeDialogs:nativeDialogs.length}))
}finally{
  if(project)await evaluate(`(window.beforeEditingTestApi||apiFetch)('/api/projects/${project.id}',{method:'DELETE'})`)
  await evaluate("if(window.beforeEditingTestApi)window.apiFetch=beforeEditingTestApi;v112Invalidate();goPage('dashboard');v112RefreshDashboard(true)")
  socket.close()
}
