import assert from 'node:assert/strict'
import fs from 'node:fs'
const base=process.env.NOVA_BASE_URL||'http://127.0.0.1:3021'
const tabs=await(await fetch('http://127.0.0.1:9227/json/list')).json(),ws=new WebSocket(tabs.find(t=>t.type==='page'&&t.url.startsWith('http://127.0.0.1:')).webSocketDebuggerUrl)
await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject})
let id=0;const pending=new Map(),errors=[]
ws.onmessage=event=>{const m=JSON.parse(event.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result)}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text)}
const send=(method,params={})=>new Promise((resolve,reject)=>{pending.set(++id,{resolve,reject});ws.send(JSON.stringify({id,method,params}))})
async function ev(expression){const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value}
const pause=ms=>new Promise(r=>setTimeout(r,ms))
async function until(expression){for(let i=0;i<100;i++){if(await ev(expression))return;await pause(100)}throw Error('Timeout '+expression)}
try{
 await send('Runtime.enable');await send('Page.enable');await send('Network.enable');await send('Network.setCacheDisabled',{cacheDisabled:true});await send('Network.setBypassServiceWorker',{bypass:true})
 for(const width of [1920,3200,1280,390]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:1080,deviceScaleFactor:1,mobile:width===390});await send('Page.navigate',{url:base});await pause(350);await until('!!window.NoavaWorkspace && !!V112_DASH');
  await ev(`sessionStorage.setItem('noava.overdue:local-demo:'+DateContext.today(),'1');AppOverlays.closeAll();goPage('dashboard')`);await pause(150)
  assert.equal(await ev(`document.querySelectorAll('#pageHeader #themeToggle,#pageHeader .avatar,#pageHeader #app-version,#pageHeader [title="فرمان سریع"]').length`),0)
  assert.equal(await ev(`document.getElementById('themeToggle').closest('.page').id`),'settings')
  assert.equal(await ev(`document.getElementById('app-version').closest('.page').id`),'settings')
  assert.equal(await ev(`getComputedStyle(document.getElementById('todayStrip')).display`),'none')
  assert.equal(await ev(`document.getElementById('pageHeader').getBoundingClientRect().height<150`),true)
  const geometry=await ev(`(()=>{const main=document.querySelector('main.main'),bar=main.querySelector('.topbar'),page=document.getElementById('dashboard'),r=page.getBoundingClientRect(),m=main.getBoundingClientRect(),b=bar.getBoundingClientRect();return {width:innerWidth,mainWidth:m.width,pageWidth:r.width,headerHeight:b.height,top:r.top,headerBottom:b.bottom,allPagesInMain:[...document.querySelectorAll('.page')].every(n=>n.parentElement===main),nestedPages:bar.querySelectorAll('.page').length,actions:bar.querySelectorAll('.top-actions').length}})()`)
  assert.equal(geometry.allPagesInMain,true,JSON.stringify(geometry));assert.equal(geometry.nestedPages,0);assert.equal(geometry.actions,1);assert.ok(geometry.top>=geometry.headerBottom-1);assert.ok(geometry.pageWidth>=Math.min(geometry.mainWidth*.9,1550),JSON.stringify(geometry));assert.ok(geometry.headerHeight<120)
  const pages=await ev('[...document.querySelectorAll(".page")].map(n=>n.id)');
  for(const page of pages){
   await ev(`goPage(${JSON.stringify(page)})`);
   const shared=await ev(`(()=>{const h=document.getElementById('pageHeader'),b=[...document.querySelectorAll('.planning-date-bar:not([hidden])')],r=h.getBoundingClientRect();return {active:b.map(n=>n.dataset.planningPage),tools:h.contains(document.querySelector('.topbar')),summary:h.contains(document.getElementById('todayStrip')),outside:document.querySelectorAll('#pageHeader .planning-date-bar').length,overflow:document.documentElement.scrollWidth>innerWidth+1,headerWithin:r.width<=innerWidth}})()`);
   assert.deepEqual(shared.active,['dashboard','today','daily','workspace','meetings','finance','academic'].includes(page)?[page]:[]);assert.ok(shared.tools&&shared.summary&&shared.headerWithin);assert.equal(shared.outside,0);assert.equal(shared.overflow,false,JSON.stringify({page,width,shared}));
  }
  await ev('goPage("dashboard")');
  if(width===1920){
   await ev(`goPage('today');document.querySelector('[data-planning-page="today"] .planning-date-label').click()`)
   assert.equal(await ev(`!!document.querySelector('dialog.persian-calendar[open]')`),true,'clicking the readable date must open the Persian picker')
   await ev(`AppOverlays.closeAll();goPage('settings');window.__beforeTheme=document.body.classList.contains('theme-dark');document.getElementById('themeToggle').click()`)
   assert.equal(await ev(`document.body.classList.contains('theme-dark')!==window.__beforeTheme`),true)
   await ev(`document.getElementById('themeToggle').click();goPage('dashboard')`)
  }
  if(width===1920||width===390){fs.mkdirSync('.local',{recursive:true});const screenshot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(`.local/noava-header-${width}.png`,Buffer.from(screenshot.data,'base64'))}
  console.log(JSON.stringify(geometry))
 }
 assert.deepEqual(errors,[]);console.log('PASS page hierarchy and compact shared header and contextual page controls at desktop, zoom-equivalent wide viewport and mobile sizes.')
}finally{await send('Emulation.clearDeviceMetricsOverride');ws.close()}
