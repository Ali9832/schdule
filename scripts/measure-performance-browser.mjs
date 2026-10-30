import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
const base=process.env.NOVA_BASE_URL||'http://127.0.0.1:3033',file=process.argv[2]||'.local/performance.json'
if(!['127.0.0.1','localhost'].includes(new URL(base).hostname))throw Error('Local measurement only')
const debug=process.env.NOVA_BROWSER_DEBUG||'http://127.0.0.1:9227'
// A fresh target prevents earlier audit observers from accumulating across runs.
const target=await(await fetch(debug+'/json/new?about:blank',{method:'PUT'})).json()
const socket=new WebSocket(target.webSocketDebuggerUrl)
await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject})
let seq=0;const pending=new Map();let requests=[],responses=[],errors=[]
socket.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result)}if(m.method==='Network.requestWillBeSent')requests.push({url:m.params.request.url,id:m.params.requestId});if(m.method==='Network.responseReceived')responses.push({url:m.params.response.url,status:m.params.response.status,cache:m.params.response.fromDiskCache});if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails)}
const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}))})
async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value}
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
const bootstrap=`window.__perf={long:[],lcp:[],shifts:[],events:[]};for(const [type,key]of [['longtask','long'],['largest-contentful-paint','lcp'],['layout-shift','shifts'],['event','events']])try{new PerformanceObserver(list=>{for(const e of list.getEntries())__perf[key].push({start:e.startTime,duration:e.duration,value:e.value||0,recent:e.hadRecentInput||false,name:e.name,interactionId:e.interactionId||0});}).observe({type,buffered:true,durationThreshold:16})}catch{}`
const samples=[];let scriptId
try{
 await send('Runtime.enable');await send('Page.enable');await send('Network.enable');await send('Performance.enable');await send('Network.setBypassServiceWorker',{bypass:true});scriptId=(await send('Page.addScriptToEvaluateOnNewDocument',{source:bootstrap})).identifier
 const scenarios=[['desktop-cold',1280,1,false],['desktop-cold',1280,1,false],['desktop-cold',1280,1,false],['desktop-warm',1280,1,true],['mobile-cold',390,4,false],['mobile-cold',390,4,false],['mobile-cold',390,4,false]]
 for(const [name,width,cpu,warm]of scenarios){
  await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<600});await send('Emulation.setCPUThrottlingRate',{rate:cpu})
  await send('Network.emulateNetworkConditions',{offline:false,latency:width<600?150:20,downloadThroughput:width<600?200000:1250000,uploadThroughput:500000})
  if(!warm)await send('Network.clearBrowserCache');await send('Network.setCacheDisabled',{cacheDisabled:!warm})
  await send('Page.navigate',{url:'about:blank'});await sleep(100);requests=[];responses=[];errors=[]
  await send('Page.navigate',{url:base});let ready=null
  for(let i=0;i<300;i++){try{ready=await evaluate('!!window.V112_DASH||typeof V112_DASH!=="undefined"&&!!V112_DASH ? performance.now() : null');if(ready)break;}catch{}await sleep(100)}
  await sleep(2500)
  const snapshot=await evaluate(`(()=>{const nav=performance.getEntriesByType('navigation')[0],paints=performance.getEntriesByType('paint'),resources=performance.getEntriesByType('resource');return {readyState:document.readyState,ttfb:nav?.responseStart,domReady:nav?.domContentLoadedEventEnd,load:nav?.loadEventEnd,fcp:paints.find(e=>e.name==='first-contentful-paint')?.startTime,lcp:__perf.lcp.at(-1)?.start||null,cls:__perf.shifts.filter(e=>!e.recent).reduce((s,e)=>s+e.value,0),longTasks:__perf.long.length,blockingMs:__perf.long.reduce((s,e)=>s+Math.max(0,e.duration-50),0),domNodes:document.querySelectorAll('*').length,resources:resources.map(e=>({url:e.name.replace(location.origin,''),ms:e.duration,transfer:e.transferSize,decoded:e.decodedBodySize})),scriptMs:0}})()`)
  const p=(await send('Performance.getMetrics')).metrics;snapshot.scriptMs=p.find(x=>x.name==='ScriptDuration')?.value*1000
  const click=await evaluate(`(async()=>{const started=performance.now();goPage('statistics');while(!document.querySelector('.stats-status')?.textContent.includes('روز')){await new Promise(r=>setTimeout(r,30));if(performance.now()-started>15000)break;}return performance.now()-started})()`)
  samples.push({name,dataReadyMs:ready,statisticsReadyMs:click,...snapshot,requests:requests.map(r=>r.url.replace(base,'')),errors,responses})
  console.log(JSON.stringify({name,dataReadyMs:Math.round(ready||0),fcp:snapshot.fcp,lcp:snapshot.lcp,blockingMs:snapshot.blockingMs,requests:requests.length,statisticsReadyMs:Math.round(click)}))
 }
 const files=['dist/index.html',...fs.readdirSync('dist/assets').filter(f=>/\.(js|css)$/.test(f)).map(f=>'dist/assets/'+f)]
 const sizes=files.map(file=>{const body=fs.readFileSync(file);return {file,bytes:body.length,gzip:zlib.gzipSync(body).length}})
 fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify({at:new Date().toISOString(),base,samples,sizes},null,2))
 console.log('Saved '+file)
}finally{if(scriptId)await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:scriptId});await send('Emulation.setCPUThrottlingRate',{rate:1});await send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});socket.close();await fetch(debug+'/json/close/'+target.id)}
