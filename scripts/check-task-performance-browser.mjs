import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildStatistics} from '../server/statistics.js';
const base=process.env.NOVA_BASE_URL||'http://127.0.0.1:3140';
assert.ok(base.startsWith('http://127.0.0.1:')&&!base.endsWith(':3001'),'Use an isolated test server');
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const shift=n=>new Date(Date.parse(today+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
const source={tasks:[
 {id:'ontime',title:'On time audit',status:'done',created_at:shift(-8),completed_at:shift(-5),completed_due_date:shift(-4)},
 {id:'late',title:'Late audit',status:'done',created_at:shift(-9),completed_at:shift(-1),completed_due_date:shift(-3)},
 {id:'miss',title:'Explicit miss audit',status:'todo',created_at:shift(-8),due_date:shift(-4)},
 {id:'open',title:'Pending audit',status:'todo',created_at:shift(-8),due_date:today},
],calendar_records:[{id:'task:miss',results:[{date:shift(-4),status:'not_done'}]}]};
const report=buildStatistics(source,{from:shift(-29),to:today,types:'tasks'},today);
const tabs=await(await fetch('http://127.0.0.1:9227/json/list')).json();
const ws=new WebSocket(tabs.find(t=>t.type==='page'&&t.url.startsWith('http')).webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
let id=0;const pending=new Map(),errors=[];
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){pending.get(m.id)(m.result);pending.delete(m.id);}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);};
const send=(method,params={})=>new Promise(r=>{pending.set(++id,r);ws.send(JSON.stringify({id,method,params}));});
async function ev(expression){const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;}
async function until(expression){for(let i=0;i<150;i++){if(await ev(expression))return;await new Promise(r=>setTimeout(r,80));}throw Error('Timeout: '+expression);}
try{
 await send('Page.bringToFront');await send('Runtime.enable');await send('Network.enable');await send('Network.setCacheDisabled',{cacheDisabled:true});await send('Network.setBypassServiceWorker',{bypass:true});await send('Page.navigate',{url:base});await until('window.NovaUIReady&&window.NoavaWorkspace');
 // Fixture interception is confined to this browser tab; no records are written.
 await ev(`AppOverlays.closeAll();window.__statsApi=apiFetch;window.__statsEdit=editV11Record;window.apiFetch=async(p,o)=>p.startsWith('/api/statistics?')?${JSON.stringify(report)}:window.__statsApi(p,o);window.editV11Record=(type,id)=>window.__edited={type,id};goPage('statistics')`);
 await until('!!document.querySelector(".stats-types input[value=tasks]")');await ev(`document.querySelector('.stats-types input[value=tasks]').click()`);await until('document.querySelectorAll(".stats-task-table tbody tr").length===4');
 assert.equal(await ev('document.querySelectorAll(".stats-task-details").length'),1);
 assert.equal(await ev('document.querySelectorAll(".stats-chart-grid svg").length'),3,'Creation, deadline and cycle charts');
 await ev(`(()=>{const f=document.querySelector('.stats-task-controls select');f.value='not_done';f.dispatchEvent(new Event('change'))})()`);
 assert.equal(await ev('document.querySelectorAll(".stats-task-table tbody tr").length'),1);assert.ok((await ev('document.querySelector(".stats-task-table").textContent')).includes('Explicit miss audit'));
 await ev(`document.querySelector('.stats-task-table button').click()`);assert.deepEqual(await ev('window.__edited'),{type:'task',id:'miss'});
 await ev(`(()=>{const f=document.querySelector('.stats-task-controls select'),q=document.querySelector('.stats-task-controls input');f.value='';f.dispatchEvent(new Event('change'));q.value='Late audit';q.dispatchEvent(new Event('input'))})()`);
 assert.equal(await ev('document.querySelectorAll(".stats-task-table tbody tr").length'),1);
 for(const width of [1280,390]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<700});
  await ev('setMobileMenu(false)');await new Promise(r=>setTimeout(r,400));
  assert.equal(await ev('document.documentElement.scrollWidth<=innerWidth+1'),true,'No page overflow at '+width);
  assert.equal(await ev('(()=>{const r=document.querySelector(".stats-task-table").getBoundingClientRect();return r.width<=innerWidth})()'),true);
  await ev('document.querySelector(".stats-task-details").scrollIntoView()');fs.mkdirSync('.local',{recursive:true});const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync('.local/task-performance-'+width+'.png',Buffer.from(shot.data,'base64'));
 }
 assert.deepEqual(errors,[]);console.log('PASS task performance charts, results filtering/search, direct item edit, empty-free data and desktop/mobile overflow checks (browser-only fixtures).');
}finally{await ev('if(window.__statsApi)window.apiFetch=window.__statsApi;if(window.__statsEdit)window.editV11Record=window.__statsEdit').catch(()=>{});await send('Emulation.clearDeviceMetricsOverride');ws.close();}
