import assert from 'node:assert/strict'
const base=process.env.NOVA_BASE_URL||'http://127.0.0.1:3007',port=process.env.NOVA_CDP_PORT||9228
const tabs=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json()
const socket=new WebSocket(tabs.find(tab=>tab.type==='page').webSocketDebuggerUrl)
await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject})
let sequence=0,created
const pending=new Map(),errors=[]
socket.onmessage=event=>{const message=JSON.parse(event.data);if(message.id){const task=pending.get(message.id);pending.delete(message.id);message.error?task.reject(message.error):task.resolve(message.result)}if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails)}
const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}))})
async function evaluate(expression){const result=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result.value}
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))
async function until(expression){for(let i=0;i<100;i++){if(await evaluate(expression))return;await pause(100)}throw Error('Timeout: '+expression)}
const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7ksAAAAASUVORK5CYII='
const wav=Buffer.alloc(48);wav.write('RIFF');wav.writeUInt32LE(40,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(8000,24);wav.writeUInt32LE(16000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(4,40)
const title='Calendar feature audit '+Date.now()
try{
 await send('Runtime.enable');await send('Network.enable');await send('Page.enable')
 await send('Page.navigate',{url:base+'/?page=calendar'});await pause(300)
 await until('typeof UnifiedCalendar!=="undefined" && UnifiedCalendar.state.from!==""')
 await evaluate('UnifiedCalendar.openDay("2026-10-23",true)')
 await until('!!document.getElementById("calendarItemForm")')
 await evaluate(`(()=>{const form=document.getElementById('calendarItemForm');const set=(name,value)=>{const input=form.elements.namedItem(name);input.value=value;input.dispatchEvent(new Event('change',{bubbles:true}));input.dispatchEvent(new Event('input',{bubbles:true}));};set('title',${JSON.stringify(title)});set('kind','meeting');set('priority','high');set('due_date','2026-10-24');set('due_time','12:30');set('repeat_frequency','weekly');set('repeat_interval','1');set('repeat_count','3');set('reminder','15');const bytes=Uint8Array.from(atob(${JSON.stringify(png)}),value=>value.charCodeAt(0));const transfer=new DataTransfer();transfer.items.add(new File([bytes],'photo.png',{type:'image/png'}));form.elements.namedItem('attachments').files=transfer.files;form.elements.namedItem('attachments').dispatchEvent(new Event('change'));form.requestSubmit();})()`)
 await until('!UnifiedCalendar.state.busy && !document.getElementById("calendarItemForm")')
 created=await evaluate(`(async()=>{const result=await apiFetch('/api/calendar?from=2026-10-23&to=2026-11-30');return result.entries.find(item=>item.title===${JSON.stringify(title)})})()`)
 assert.ok(created);assert.equal(created.priority,'high');assert.equal(created.due_date,'2026-10-24');assert.equal(created.recurrence.count,3)
 assert.deepEqual(created.reminders,[15])
 const path=`/api/calendar/${created.source}/${created.id}/attachments`
 const files=await evaluate(`apiFetch(${JSON.stringify(path)})`)
 assert.equal(files.attachments.length,1);assert.equal(files.attachments[0].type,'image/png')
 await evaluate(`CalendarExtras.upload(${JSON.stringify(created)},[{name:'voice.wav',type:'audio/wav',data:${JSON.stringify(wav.toString('base64'))}}])`)
 const withAudio=await evaluate(`apiFetch(${JSON.stringify(path)})`)
 assert.equal(withAudio.attachments.length,2);assert.ok(withAudio.attachments.some(file=>file.type==='audio/wav'))
 await evaluate(`document.querySelector('[data-key="${created.key}"] input[type=checkbox]').click()`)
 await until('!UnifiedCalendar.state.busy')
 let rows=await evaluate(`(async()=>{const result=await apiFetch('/api/calendar?from=2026-10-23&to=2026-11-30');return result.entries.filter(item=>item.id===${JSON.stringify(created.id)})})()`)
 assert.deepEqual(rows.map(row=>row.done),[true,false,false])
 await evaluate(`document.querySelector('[data-key="${created.key}"] .uc-edit').click()`)
 await until('!!document.getElementById("calendarItemForm")')
 assert.equal(await evaluate('document.getElementById("calendarInput-repeat_frequency").value'),'weekly')
 assert.equal(await evaluate('document.getElementById("calendarInput-priority").value'),'high')
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true})
 assert.ok(await evaluate('document.getElementById("calendarDayDialog").scrollWidth<=document.getElementById("calendarDayDialog").clientWidth+2'))
 await evaluate('document.getElementById("calendarDayDialog").close();UnifiedCalendar.openDay("2026-10-23")')
 await until('!!document.querySelector(".uc-agenda-item .uc-attachments button")')
 await evaluate(`document.querySelector('[data-key="${created.key}"] .uc-attachments button').click()`)
 await until('!!document.querySelector(".uc-attachment")')
 await evaluate('document.querySelector(".uc-attachment button").click()')
 await until('!!document.querySelector(".uc-attachment img")')
 assert.ok(await evaluate('document.querySelector(".uc-attachment img").src.startsWith("blob:")'))
 await evaluate('document.querySelectorAll(".uc-attachment")[1].querySelector("button").click()')
 await until('!!document.querySelector(".uc-attachment audio")')
 assert.equal(await evaluate('document.querySelector(".uc-attachment audio").controls'),true)
 await evaluate(`(async()=>{const fetcher=window.apiFetch,toast=window.showToast;window.__reminderAudit=[];window.showToast=(...args)=>window.__reminderAudit.push(args);window.apiFetch=async path=>path==='/api/calendar/reminders'?{reminders:[{key:'browser-reminder-audit',title:'Reminder audit',at:new Date(Date.now()-1000).toISOString()}]}:fetcher(path);try{await CalendarExtras.refresh();await CalendarExtras.refresh()}finally{window.apiFetch=fetcher;window.showToast=toast}})()`)
 assert.equal(await evaluate('window.__reminderAudit.length'),1)
 assert.equal(errors.length,0,JSON.stringify(errors))
 console.log('PASS browser: recurrence, deadline, priority, image/audio attachments and private preview, per-occurrence completion, reminders without duplicates, persistence and mobile layout')
}finally{
 if(created)await evaluate(`apiFetch('/api/calendar/${created.source}/${created.id}',{method:'DELETE'})`)
 await send('Emulation.clearDeviceMetricsOverride');socket.close()
}
