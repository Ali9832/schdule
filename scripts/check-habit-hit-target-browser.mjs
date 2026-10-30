import assert from 'node:assert/strict'
const base=process.env.NOVA_BASE_URL||'http://127.0.0.1:3012'
const tabs=await(await fetch((process.env.NOVA_BROWSER_DEBUG||'http://127.0.0.1:9228')+'/json/list')).json()
const socket=new WebSocket(tabs.find(tab=>tab.type==='page').webSocketDebuggerUrl)
await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject})
let sequence=0,dayRequests=0;const pending=new Map()
socket.onmessage=event=>{const message=JSON.parse(event.data);if(message.id){const task=pending.get(message.id);pending.delete(message.id);message.error?task.reject(message.error):task.resolve(message.result)}if(message.method==='Network.requestWillBeSent'&&message.params.request.url.includes(`/api/habits/${habit?.id}/day`))dayRequests++}
const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}))})
async function evaluate(expression){const result=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result.value}
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))
async function until(expression){for(let i=0;i<100;i++){if(await evaluate(expression))return;await pause(100)}throw Error('Timeout: '+expression)}
let habit
try{
 await send('Page.enable');await send('Network.enable');await send('Network.setCacheDisabled',{cacheDisabled:true});await send('Network.setBypassServiceWorker',{bypass:true})
 await send('Page.navigate',{url:base});await pause(400);await until('typeof DateContextUI!=="undefined" && !!V112_DASH')
 habit=await evaluate(`apiFetch('/api/habits',{method:'POST',body:JSON.stringify({title:'Hit target audit '+Date.now(),target_weekly:7,status:'active'})})`)
 await evaluate('goPage("habits")');await until('!!document.querySelector("#habitMatrixTable .habit-check")')
 const selector=`#habitMatrixTable input.habit-check[onchange*="${habit.id}"]`
 await until(`!!document.querySelector(${JSON.stringify(selector)})`)
 for(const [width,height] of [[1280,900],[390,844]]){
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<500})
  await send('Emulation.setTouchEmulationEnabled',{enabled:width<500})
  for(const point of ['center','top-left','bottom-right','keyboard',...(width<500?['touch']:[])]){
   await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center',inline:'center'})`);await pause(80)
   const before=await evaluate(`document.querySelector(${JSON.stringify(selector)}).checked`),requestsBefore=dayRequests
   const rect=await evaluate(`(()=>{const input=document.querySelector(${JSON.stringify(selector)}),cell=input.closest('td'),r=cell.getBoundingClientRect(),label=input.closest('label').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,labelWidth:label.width,labelHeight:label.height,name:input.getAttribute('aria-label')}})()`)
   assert.ok(rect.labelWidth>=rect.width-2);assert.ok(rect.labelHeight>=rect.height-2);assert.ok(rect.name.includes(habit.title))
   if(point==='keyboard'){
    await evaluate(`document.querySelector(${JSON.stringify(selector)}).focus()`)
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:' ',code:'Space',windowsVirtualKeyCode:32});await send('Input.dispatchKeyEvent',{type:'keyUp',key:' ',code:'Space',windowsVirtualKeyCode:32})
   }else{
    const x=rect.x+(point==='top-left'?3:point==='bottom-right'?rect.width-4:rect.width/2),y=rect.y+(point==='top-left'?3:point==='bottom-right'?rect.height-4:rect.height/2)
    const hit=await evaluate(`(()=>{const element=document.elementFromPoint(${x},${y}),r=element?.getBoundingClientRect(),scroll=document.getElementById('habitCombinedScroll');return {element:element?.outerHTML.slice(0,200),x:r?.x,width:r?.width,scroll:scroll.scrollLeft,container:scroll.getBoundingClientRect().toJSON()}})()`)
    assert.equal(await evaluate(`!!document.elementFromPoint(${x},${y})?.closest('.habit-day-toggle-cell')`),true,`Hit target ${width}/${point}: ${JSON.stringify(rect)} ${JSON.stringify(hit)}`)
    if(point==='touch'){
     await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,radiusX:2,radiusY:2}]});await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]})
    }else{
     await send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',clickCount:1})
    }
   }
   await until(`document.querySelector(${JSON.stringify(selector)}).checked===${!before}`)
   await until(`BASE_HABIT_MATRIX.rows.find(row=>row.id===${JSON.stringify(habit.id)}).days[0]===${!before}`)
   await pause(160);assert.equal(dayRequests-requestsBefore,1,`One write per ${width}/${point}`)
   const stored=await evaluate(`apiFetch('/api/habits/matrix?year='+document.getElementById('habitYearSelect').value+'&month='+document.getElementById('habitMonthSelect').value)`)
   const row=stored.rows.find(row=>row.id===habit.id);assert.equal(row.days[0],!before,`Persisted ${width}/${point}`);assert.ok(row.days.slice(1).every(value=>!value),'Other day cells unchanged')
  }
 }
 const checked=await evaluate(`document.querySelector(${JSON.stringify(selector)}).checked`)
 await evaluate('loadHabitMatrix()');assert.equal(await evaluate(`document.querySelector(${JSON.stringify(selector)}).checked`),checked)
 console.log('Habit hit targets passed: actual centre/corner clicks, one request per toggle, Space keyboard, mobile touch, full-cell coverage, persisted values and adjacent-day isolation.')
}finally{
 if(habit?.id)await evaluate(`apiFetch('/api/habits/${habit.id}',{method:'DELETE'})`)
 await send('Emulation.setTouchEmulationEnabled',{enabled:false});await send('Emulation.clearDeviceMetricsOverride')
 socket.close()
}
