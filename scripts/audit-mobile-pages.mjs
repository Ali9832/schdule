import fs from 'node:fs'
const base=process.env.NOVA_BASE_URL||'http://127.0.0.1:3037'
const tabs=await(await fetch('http://127.0.0.1:9227/json/list')).json(),ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl)
await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject});let id=0;const pending=new Map(),errors=[]
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result)}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text)}
const send=(method,params={})=>new Promise((resolve,reject)=>{pending.set(++id,{resolve,reject});ws.send(JSON.stringify({id,method,params}))})
async function ev(expression){const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value}
const pause=ms=>new Promise(r=>setTimeout(r,ms));async function until(expression){for(let i=0;i<120;i++){if(await ev(expression))return;await pause(100)}throw Error('Timeout '+expression)}
const results=[]
try{
 await send('Runtime.enable');await send('Page.enable');await send('Network.enable');await send('Network.setCacheDisabled',{cacheDisabled:true});await send('Network.setBypassServiceWorker',{bypass:true});await send('Page.navigate',{url:base});await until('window.NovaUIReady && !!window.NoavaWorkspace && !!V112_DASH')
 await ev('AppOverlays.closeAll();NoavaWorkspace.overdue=()=>{}')
 const pages=await ev('[...document.querySelectorAll(".page")].map(n=>n.id)')
 for(const width of [320,390,768]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:true})
  for(const page of pages){
   await ev(`goPage(${JSON.stringify(page)})`);await pause(170)
   const result=await ev(`(()=>{const page=document.querySelector('.page:not(.hidden)'),bad=[],narrow=[];for(const n of page.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=hidden]):not([type=color]),select,button,summary')){const r=n.getBoundingClientRect();if(!r.width||!r.height||n.closest('#v116Composer:not(.open),[inert]')||getComputedStyle(n).visibility==='hidden')continue;let scroll=false;for(let p=n.parentElement;p&&p!==page;p=p.parentElement){if(['auto','scroll'].includes(getComputedStyle(p).overflowX)&&p.scrollWidth>p.clientWidth+2){scroll=true;break}}if(scroll)continue;const identity=n.id||n.className||n.tagName;if(r.left<-2||r.right>innerWidth+2)bad.push({id:identity,left:Math.round(r.left),right:Math.round(r.right)});if(n.tagName==='SELECT'&&r.width<100&&n.closest('.v11-filter-row,.v118-filters,.stats-filters,.academic-filters'))narrow.push({id:identity,width:Math.round(r.width)});}return {page:page.id,overflow:document.documentElement.scrollWidth>innerWidth+2,bad,narrow}})()`)
   results.push({width,...result});if(result.overflow||result.bad.length||result.narrow.length)console.log(JSON.stringify({width,...result}))
  }
 }
 fs.writeFileSync('.local/mobile-pages-audit.json',JSON.stringify({results,errors},null,2));console.log(JSON.stringify({pages:pages.length,viewports:3,issues:results.filter(r=>r.overflow||r.bad.length||r.narrow.length).length,errors}));if(results.some(r=>r.overflow||r.bad.length||r.narrow.length)||errors.length)process.exitCode=1
}finally{ws.close()}
