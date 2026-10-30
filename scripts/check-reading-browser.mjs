import assert from 'node:assert/strict'
const base=process.env.NOVA_BASE_URL||'http://127.0.0.1:3032'
assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname),'Use an isolated local test store')
const debug=process.env.NOVA_BROWSER_DEBUG||'http://127.0.0.1:9227'
const tabs=await(await fetch(debug+'/json/list')).json()
const socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl)
await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject})
let seq=0;const pending=new Map(),errors=[]
socket.onmessage=event=>{const m=JSON.parse(event.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result)}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails)}
const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}))})
const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value}
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
async function until(expression){for(let i=0;i<100;i++){if(await evaluate(expression))return;await sleep(100)}throw Error('Timeout: '+expression)}
const click=text=>evaluate(`Array.from(document.querySelectorAll('#reading button, .reading-dialog button')).find(b=>b.textContent===${JSON.stringify(text)}).click()`)
const title='Reading UI '+Date.now()
try{
 await send('Runtime.enable');await send('Network.enable');await send('Page.enable')
 await send('Network.setBypassServiceWorker',{bypass:true});await send('Network.setCacheDisabled',{cacheDisabled:true})
 await send('Page.navigate',{url:base});await until('window.NovaUIReady===true && typeof V112_DASH!=="undefined" && !!V112_DASH && !!document.querySelector("#readingBody")')
 await evaluate('goPage("reading")');await until('!!document.querySelector(".reading-heading")')
 await click('＋ افزودن کتاب');await until('!!document.querySelector(".reading-dialog[open]")')
 await evaluate(`document.querySelector('[name=title]').value=${JSON.stringify(title)};document.querySelector('[name=author]').value='Writer';document.querySelector('.reading-dialog form').requestSubmit()`)
 await until(`!document.querySelector('.reading-dialog') && document.querySelector('#reading').textContent.includes(${JSON.stringify(title)})`)
 await evaluate(`window.testBook=Array.from(document.querySelectorAll('.reading-book')).find(b=>b.querySelector('h2').textContent===${JSON.stringify(title)});testBook.querySelectorAll('button')[1].click()`)
 await until('!!document.querySelector(".reading-dialog[open]")')
 await evaluate(`document.querySelector('[name=minutes]').value='7';document.querySelector('[name=note]').value='Chapter 1';document.querySelector('.reading-dialog form').requestSubmit()`)
 await until(`!document.querySelector('.reading-dialog') && document.querySelector('#reading').textContent.includes('Chapter 1')`)
 assert.equal(await evaluate(`Array.from(document.querySelectorAll('.reading-book')).find(b=>b.querySelector('h2').textContent===${JSON.stringify(title)}).textContent.includes('۷ دقیقه')`),true)
 await evaluate(`Array.from(document.querySelectorAll('.reading-book')).find(b=>b.querySelector('h2').textContent===${JSON.stringify(title)}).querySelector('button').click()`)
 await until('!!document.querySelector(".reading-timer")');await sleep(1200)
 // Refreshing the page preserves the server timer.
 await send('Page.reload');await until('window.NovaUIReady===true && typeof V112_DASH!=="undefined" && !!V112_DASH');await evaluate('goPage("reading")');await until('!!document.querySelector(".reading-timer")')
 await click('توقف و ثبت زمان');await until('!!document.querySelector(".reading-dialog[open]")');await evaluate(`document.querySelector('.reading-dialog form').requestSubmit()`);await until('!document.querySelector(".reading-timer")&&!document.querySelector(".reading-dialog")')
 await evaluate(`Array.from(document.querySelectorAll('.reading-book')).find(b=>b.querySelector('h2').textContent===${JSON.stringify(title)}).querySelectorAll('button')[2].click()`)
 await until('!!document.querySelector(".reading-dialog[open]")')
 await evaluate(`document.querySelector('[name=reminder_enabled]').checked=true;document.querySelector('[name=reminder_time]').value='00:00';document.querySelector('.reading-dialog form').requestSubmit()`)
 await until('!document.querySelector(".reading-dialog")')
 await evaluate(`window.readingNotifications=[];window.readingPermissionRequests=0;window.Notification=class {static permission='granted';static async requestPermission(){readingPermissionRequests++;return 'granted'}constructor(title,options){readingNotifications.push({title,...options})}};navigator.serviceWorker.getRegistration=async()=>undefined;`)
 await click('فعال‌کردن اعلان مرورگر');assert.equal(await evaluate('readingPermissionRequests'),1)
 await evaluate('window.dispatchEvent(new Event("focus"))');await until('readingNotifications.length>=1')
 await evaluate('window.dispatchEvent(new Event("focus"))');await sleep(400)
 assert.equal(await evaluate(`readingNotifications.filter(n=>n.body.includes(${JSON.stringify(title)})).length`),1,'daily reminder is deduplicated')
 // An API failure shows a retry, retaining server data without inventing books.
 await evaluate(`window.originalReadingFetch=window.fetch;window.fetch=(url,...args)=>String(url)==='/api/reading'?Promise.resolve(new Response(JSON.stringify({error:'test outage'}),{status:503})):originalReadingFetch(url,...args);window.dispatchEvent(new Event('focus'));`)
 await until(`document.querySelector('#readingBody').textContent.includes('test outage')`)
 await evaluate('window.fetch=originalReadingFetch');await click('تلاش دوباره');await until('!!document.querySelector(".reading-heading")')
 for(const width of [390,1280,1920]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<600});await sleep(150)
  assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'),'page fits '+width)
  await click('＋ افزودن کتاب');await sleep(100)
  assert.ok(await evaluate('document.querySelector(".reading-dialog").getBoundingClientRect().right<=innerWidth+1'),'dialog fits '+width)
  await click('انصراف')
 }
 assert.deepEqual(errors,[])
 console.log('PASS reading browser: forms, saved minutes, timer after reload, daily notification deduplication, API failure recovery and responsive layouts')
}finally{socket.close()}
