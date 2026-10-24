import assert from 'node:assert/strict'
const base=process.env.NOVA_BASE_URL||'http://127.0.0.1:3020'
const tabs=await(await fetch('http://127.0.0.1:9227/json/list')).json()
const ws=new WebSocket(tabs.find(tab=>tab.type==='page'&&tab.url.startsWith('http://127.0.0.1:')).webSocketDebuggerUrl)
await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject})
let id=0;const pending=new Map(),errors=[]
ws.onmessage=event=>{const m=JSON.parse(event.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result)}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text)}
const send=(method,params={})=>new Promise((resolve,reject)=>{pending.set(++id,{resolve,reject});ws.send(JSON.stringify({id,method,params}))})
async function ev(expression){const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value}
const pause=ms=>new Promise(r=>setTimeout(r,ms))
async function until(expression){for(let i=0;i<100;i++){if(await ev(expression))return;await pause(100)}throw Error('Timeout '+expression)}
async function click(x,y){for(const type of ['mousePressed','mouseReleased'])await send('Input.dispatchMouseEvent',{type,x,y,button:'left',clickCount:1})}
async function open(){await ev('NoavaWorkspace.overdue(true)');await until('!!document.querySelector("#overdueReview[open]")')}
try{
 await send('Runtime.enable');await send('Page.enable');await send('Network.enable');await send('Network.setCacheDisabled',{cacheDisabled:true});await send('Network.setBypassServiceWorker',{bypass:true});await send('Page.navigate',{url:base});await pause(400);await until('!!window.NoavaWorkspace && !!V112_DASH')
 await ev(`AppOverlays.closeAll();window.__overdueApi=apiFetch;window.__overdueWrites=0;window.apiFetch=async(path,options)=>{if(options?.method&&options.method!=='GET'){window.__overdueWrites++;throw Error('No writes allowed in dismissal audit');}if(path==='/api/calendar/overdue')return {entries:Array.from({length:100},(_,i)=>({key:'task:audit-'+i,id:'audit-'+i,source:'task',date:'2026-10-22',title:'Overdue audit '+i}))};return window.__overdueApi(path,options)}`)
 for(const viewport of [{width:1280,height:800,mobile:false},{width:390,height:844,mobile:true},{width:640,height:420,mobile:true}]){
  await send('Emulation.setDeviceMetricsOverride',{...viewport,deviceScaleFactor:1});await open()
  const geometry=await ev(`(()=>{const d=document.getElementById('overdueReview'),list=d.querySelector('.overdue-list'),close=d.querySelector('.overdue-close'),footer=d.querySelector('footer'),r=close.getBoundingClientRect();return {count:list.children.length,scroll:list.scrollHeight>list.clientHeight,closeVisible:r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth,footerVisible:footer.getBoundingClientRect().bottom<=innerHeight&&footer.getBoundingClientRect().top>=0,noOverflow:d.scrollWidth<=d.clientWidth+1}})()`)
  assert.equal(geometry.count,100);assert.ok(geometry.scroll);assert.ok(geometry.closeVisible,JSON.stringify({viewport,geometry}));assert.ok(geometry.footerVisible,JSON.stringify({viewport,geometry}));assert.ok(geometry.noOverflow,JSON.stringify({viewport,geometry}))
  const point=await ev('(()=>{const r=document.querySelector(".overdue-close").getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()');await click(point.x,point.y);await until('!document.getElementById("overdueReview")')
 }
 await open();const inside=await ev('(()=>{const r=document.querySelector(".overdue-heading h2").getBoundingClientRect();return {x:r.x+10,y:r.y+10}})()');await click(inside.x,inside.y);assert.equal(await ev('document.getElementById("overdueReview").open'),true);await click(1,1);await until('!document.getElementById("overdueReview")')
 await open();await ev('document.getElementById("overdueReview").close();NoavaWorkspace.overdue(true)');await pause(150);assert.equal(await ev('document.querySelectorAll("#overdueReview[open]").length'),1,'old close event must not remove the reopened dialog');await ev('document.querySelector(".overdue-close").click()');await until('!document.getElementById("overdueReview")')
 await ev(`sessionStorage.removeItem('noava.overdue:local-demo:'+DateContext.today());document.getElementById('globalSearch').focus();NoavaWorkspace.overdue(false)`);await pause(150);assert.equal(await ev('!!document.querySelector("#overdueReview[open]")'),false,'automatic review must not interrupt typing')
 assert.equal(await ev('window.__overdueWrites'),0);assert.deepEqual(errors,[])
 console.log('PASS: 100 overdue rows, visible close/footer on desktop/mobile/landscape, internal scrolling, real close/backdrop clicks, inside click, reopen race, focus protection and zero data writes.')
}finally{await ev('document.getElementById("overdueReview")?.close();if(window.__overdueApi)window.apiFetch=window.__overdueApi').catch(()=>{});await send('Emulation.clearDeviceMetricsOverride');ws.close()}
