const tabs=await(await fetch('http://127.0.0.1:9227/json/list')).json(),s=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl)
await new Promise(r=>s.onopen=r);let id=0;const pending=new Map()
s.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result)}}
const send=(method,params={})=>new Promise((resolve,reject)=>{pending.set(++id,{resolve,reject});s.send(JSON.stringify({id,method,params}))})
try{
 const width=Number(process.env.NOVA_AUDIT_WIDTH||390),mobile=width<600
 await send('Page.enable');await send('Network.enable');await send('Network.setBypassServiceWorker',{bypass:true});await send('Network.setCacheDisabled',{cacheDisabled:true});await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile});await send('Emulation.setCPUThrottlingRate',{rate:mobile?4:1});await send('Network.emulateNetworkConditions',{offline:false,latency:mobile?150:20,downloadThroughput:mobile?200000:1250000,uploadThroughput:500000})
 const script=await send('Page.addScriptToEvaluateOnNewDocument',{source:`window.layoutAudit=[];new PerformanceObserver(list=>{for(const e of list.getEntries())if(!e.hadRecentInput)layoutAudit.push({at:e.startTime,value:e.value,nodes:e.sources?.map(s=>({node:s.node?.id||s.node?.className||s.node?.nodeName,from:s.previousRect.toJSON(),to:s.currentRect.toJSON()}))})}).observe({type:'layout-shift',buffered:true})`})
 await send('Page.navigate',{url:process.env.NOVA_BASE_URL||'http://127.0.0.1:3033'});await new Promise(r=>setTimeout(r,10000))
 const out=await send('Runtime.evaluate',{expression:'layoutAudit',returnByValue:true});console.log(JSON.stringify(out.result.value,null,2))
 await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:script.identifier})
}finally{await send('Emulation.setCPUThrottlingRate',{rate:1});await send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});s.close()}
