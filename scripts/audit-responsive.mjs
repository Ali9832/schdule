import assert from 'node:assert/strict'
const targets=await(await fetch('http://127.0.0.1:9227/json/list')).json()
const socket=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl)
await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject})
let sequence=0;const pending=new Map(),errors=[]
socket.onmessage=event=>{const m=JSON.parse(event.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result)}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails)}
function send(method,params={}){return new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}))})}
async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value}
const pause=ms=>new Promise(r=>setTimeout(r,ms))
const widths=(process.env.NOVA_AUDIT_WIDTHS||'320,390,768,1440').split(',').map(Number)
const results=[]
try{
 await send('Runtime.enable');await send('Network.enable');await send('Network.setBypassServiceWorker',{bypass:true});await send('Page.reload',{ignoreCache:true});await pause(2000);errors.length=0
 const pages=await evaluate('[...new Set([...document.querySelectorAll(".nav-item[data-page]")].map(e=>e.dataset.page))]')
 for(const width of widths){
  await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<768})
  for(const page of pages){
   await evaluate(`goPage(${JSON.stringify(page)})`);await pause(180)
   const state=await evaluate(`(()=>{
    const width=document.documentElement.clientWidth;
    function inScroller(el){for(let p=el.parentElement;p&&p!==document.body;p=p.parentElement){const s=getComputedStyle(p);if(['auto','scroll','hidden'].includes(s.overflowX)&&p.scrollWidth>p.clientWidth+2)return true}return false}
    const offenders=[...document.querySelectorAll('.main *')].filter(el=>{
     if(!el.getClientRects().length||!el.closest('.page:not(.hidden),.topbar,.today-strip')||el.closest('.v116-composer:not(.open),.v118-composer:not(.open),.v11-inspector:not(.open)'))return false;
     const r=el.getBoundingClientRect();return r.width>0&&(r.left< -2||r.right>width+2)&&!inScroller(el)
    }).map(el=>({tag:el.tagName,id:el.id,class:el.className,left:Math.round(el.getBoundingClientRect().left),width:Math.round(el.getBoundingClientRect().width)}));
    return {width,scrollWidth:document.documentElement.scrollWidth,offenders:offenders.slice(0,7)};
   })()`)
   results.push({page,viewport:width,...state})
  }
  if(width<=390){
   await evaluate('setMobileMenu(true)');await pause(240)
   assert.equal(await evaluate('document.getElementById("mobileMenuToggle").getAttribute("aria-expanded")'),'true')
   assert.equal(await evaluate('document.getElementById("mainSidebar").inert'),false)
   await evaluate('document.querySelector("[data-nav-group=review]").open=true;document.querySelector(".nav-item[data-page=settings]").click()');await pause(180)
   assert.equal(await evaluate('document.body.classList.contains("mobile-menu-open")'),false)
   assert.equal(await evaluate('document.querySelector(".page:not(.hidden)").id'),'settings')
   const cases=[
    ['workspace','openGenericAdd("daily","Test")','#genericModalBg .modal','closeGenericAdd()'],
    ['meetings','v116OpenNew()','#v116Composer','v116CloseComposer()'],
    ['goals','v117OpenOutcome()','#v117Composer','v117CloseOutcome()'],
    ['resources','v118OpenComposer()','#v118Composer','v118CloseComposer()'],
   ]
   for(const [page,open,selector,close] of cases){
    await evaluate(`goPage(${JSON.stringify(page)})`);await pause(200);await evaluate(open);await pause(250)
    const state=await evaluate(`(()=>{const root=document.querySelector(${JSON.stringify(selector)}),width=document.documentElement.clientWidth;const offenders=[root,...root.querySelectorAll('input,select,textarea,button')].filter(e=>{if(!e.getClientRects().length)return false;const r=e.getBoundingClientRect();return r.left< -2||r.right>width+2}).map(e=>({id:e.id,class:e.className}));return {width,scrollWidth:document.documentElement.scrollWidth,offenders}})()`)
    results.push({page:'dialog:'+page,viewport:width,...state});await evaluate(close)
   }
  }
 }
 console.log(JSON.stringify({checked:results.length,failures:results.filter(r=>r.scrollWidth>r.width+2||r.offenders.length),runtimeErrors:errors}))
 if(process.env.NOVA_AUDIT_ASSERT==='1'){assert.ok(results.every(r=>r.scrollWidth<=r.width+2&&!r.offenders.length));assert.equal(errors.length,0)}
 await evaluate('goPage("dashboard")')
}finally{socket.close()}
