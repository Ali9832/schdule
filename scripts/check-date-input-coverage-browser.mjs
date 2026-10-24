import assert from 'node:assert/strict'
const base=process.env.NOVA_BASE_URL||'http://127.0.0.1:3026'
const tabs=await(await fetch('http://127.0.0.1:9227/json/list')).json()
const ws=new WebSocket(tabs.find(t=>t.type==='page'&&t.url.startsWith('http://127.0.0.1:')).webSocketDebuggerUrl)
await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject})
let id=0;const pending=new Map(),errors=[]
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result)}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text)}
const send=(method,params={})=>new Promise((resolve,reject)=>{pending.set(++id,{resolve,reject});ws.send(JSON.stringify({id,method,params}))})
async function ev(expression){const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value}
const pause=ms=>new Promise(r=>setTimeout(r,ms))
async function until(expression){for(let i=0;i<120;i++){if(await ev(expression))return;await pause(100)}throw Error('Timeout '+expression)}
try{
 await send('Runtime.enable');await send('Page.enable');await send('Network.enable');await send('Network.setCacheDisabled',{cacheDisabled:true});await send('Network.setBypassServiceWorker',{bypass:true});await send('Page.navigate',{url:base});await pause(400);await until('!!window.PersianUI && !!window.NoavaWorkspace && !!V112_DASH')
 await ev("sessionStorage.setItem('noava.overdue:local-demo:'+DateContext.today(),'1');AppOverlays.closeAll()")
 // Every pre-existing native date/time field, including hidden legacy composers, is enhanced.
 const audit=await ev(`(()=>{const failures=[],fields=[...document.querySelectorAll('input[data-persian-type]')];for(const n of fields){const kind=n.dataset.persianType,old=n.value,raw=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value');if(!n.parentElement.matches('.persian-date-field')||!n.parentElement.querySelector('button'))failures.push(n.id+':missing controls');const text=kind==='time'?'۱۳۳۰':kind==='datetime-local'?'۱۴۰۵۰۸۰۳ ۱۳۳۰':kind==='month'?'۲۰۲۶۱۰':'۱۴۰۵۰۸۰۳';raw.set.call(n,text);n.dispatchEvent(new Event('input',{bubbles:true}));const expected=kind==='time'?'13:30':kind==='datetime-local'?'2026-10-25T13:30':kind==='month'?'2026-10':'2026-10-25';if(n.value!==expected)failures.push(n.id+':'+n.value);n.value=old;}return {count:fields.length,failures,unhandled:document.querySelectorAll('input[type=date],input[type=time],input[type=datetime-local],input[type=month]').length}})()`)
 assert.ok(audit.count>=25);assert.deepEqual(audit.failures,[]);assert.equal(audit.unhandled,0)
 // Dynamically inserted controls and controls whose type is assigned after insertion.
 await ev(`(()=>{const f=document.createElement('form');f.id='dateCoverageFixture';for(const kind of ['date','time','datetime-local','month']){const n=document.createElement('input');n.type=kind;n.name=kind;f.append(n);}const later=document.createElement('input');later.id='coverageLater';later.name='later';f.append(later);document.body.append(f);setTimeout(()=>{later.type='time'},0)})()`)
 await until("document.getElementById('coverageLater').dataset.persianType==='time'")
 const data=await ev(`(()=>{const f=document.getElementById('dateCoverageFixture');for(const [kind,value]of Object.entries({date:'2026-10-25',time:'13:30','datetime-local':'2026-10-25T13:30',month:'2026-10',later:'09:00'}))f.elements.namedItem(kind).value=value;const n=f.elements.namedItem('month');n.focus();n.setSelectionRange(5,7);n.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowUp',bubbles:true}));return Object.fromEntries(new FormData(f))})()`)
 assert.deepEqual(data,{date:'2026-10-25',time:'13:30','datetime-local':'2026-10-25T13:30',month:'2026-11',later:'09:00'})
 await ev("document.querySelector('#dateCoverageFixture input[name=month]').parentElement.querySelector('button').click()")
 await until("!!document.querySelector('.persian-month-picker[open]')")
 await ev(`(()=>{const spins=document.querySelectorAll('.persian-month-picker input');spins[0].value='۲۰۲۷';spins[1].value='۱۲';spins[1].dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('.persian-month-picker .persian-calendar-actions button').click()})()`)
 assert.equal(await ev("document.querySelector('#dateCoverageFixture input[name=month]').value"),'2027-12')
 // Focused wheel steps the month, retains Gregorian period semantics and year rollover.
 const stepped=await ev(`(()=>{const n=document.querySelector('#dateCoverageFixture input[name=month]');n.focus();n.setSelectionRange(5,7);n.dispatchEvent(new WheelEvent('wheel',{deltaY:-80,bubbles:true,cancelable:true}));const a=n.value;n.readOnly=true;n.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowUp',bubbles:true}));const b=n.value;n.readOnly=false;n.blur();n.dispatchEvent(new WheelEvent('wheel',{deltaY:-80,bubbles:true,cancelable:true}));return [a,b,n.value]})()`)
 assert.deepEqual(stepped,['2028-01','2028-01','2028-01'])
 // Serialization preserves ordinary repeated names and excludes disabled dates.
 await ev(`(()=>{const f=document.getElementById('dateCoverageFixture');const hidden=document.createElement('input');hidden.type='hidden';hidden.name='date';hidden.value='keep-hidden';f.append(hidden);const fieldset=document.createElement('fieldset');fieldset.disabled=true;const n=document.createElement('input');n.type='date';n.name='disabled-date';n.value='2026-10-25';fieldset.append(n);f.append(fieldset)})()`);await pause(30)
 assert.deepEqual(await ev(`(()=>{const data=new FormData(document.getElementById('dateCoverageFixture'));return {dates:data.getAll('date'),disabled:data.has('disabled-date')}})()`),{dates:['2026-10-25','keep-hidden'],disabled:false})
 assert.deepEqual(errors,[])
 console.log(`PASS ${audit.count} existing date/time controls across site; dynamic date/time/datetime/month, late type assignment, Persian numeric entry, month picker, focused wheel, read-only guards and canonical FormData.`)
}finally{await ev("document.querySelector('.persian-month-picker')?.close();document.getElementById('dateCoverageFixture')?.remove();AppOverlays.closeAll()").catch(()=>{});ws.close()}
