import assert from 'node:assert/strict';
import fs from 'node:fs';
const base=process.env.NOVA_BASE_URL||'http://127.0.0.1:3001';
if(!base.startsWith('http://127.0.0.1:'))throw Error('Local browser review required');
const tabs=await(await fetch('http://127.0.0.1:9227/json/list')).json();
const ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
let seq=0;const pending=new Map(),errors=[];
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){pending.get(m.id)(m.result);pending.delete(m.id);}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);};
const send=(method,params={})=>new Promise(resolve=>{pending.set(++seq,resolve);ws.send(JSON.stringify({id:seq,method,params}));});
async function ev(expression){const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;}
const pause=ms=>new Promise(r=>setTimeout(r,ms));async function until(expression){for(let n=0;n<120;n++){if(await ev(expression))return;await pause(80);}throw Error('Timeout '+expression);}
let wasDark=false;
try{
await send('Runtime.enable');await send('Page.enable');await send('Network.enable');await send('Network.setCacheDisabled',{cacheDisabled:true});await send('Network.setBypassServiceWorker',{bypass:true});await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1080,deviceScaleFactor:1,mobile:false});await send('Page.navigate',{url:base});await until('window.NovaUIReady&&window.RelationshipsNetwork');
await ev('AppOverlays.closeAll();goPage("relationships");RelationshipsNetwork.load()');await until('document.querySelectorAll(".rn-person").length>1');wasDark=await ev('document.body.classList.contains("theme-dark")');

const ids=await ev('[...document.querySelectorAll(".rn-person")].map(n=>n.dataset.personId)');
assert.equal(await ev('document.querySelectorAll(".rn-person").length===V1110_DATA.people.length'),true);
assert.equal(await ev('document.querySelectorAll(".rn-person-picker,.rn-directory-list").length'),0);
assert.equal(await ev('[...document.querySelectorAll(".rn-person")].every(c=>c.querySelector(".rn-identity-section>h4")&&c.querySelector(".rn-assigned-section>h4")&&c.querySelector(".rn-promises-section>h4")&&!c.querySelector("details.rn-person-network"))'),true);
assert.equal(await ev('[...document.querySelectorAll(".rn-person")].every(c=>{const p=V1110_DATA.people.find(p=>p.id===c.dataset.personId);return [...c.querySelectorAll(".rn-task")].every(t=>p.assigned_tasks.some(x=>x.id===t.dataset.taskId))&&[...c.querySelectorAll(".rn-commitment")].every(t=>p.commitments.some(x=>x.id===t.dataset.commitmentId));})'),true,'Records stay in their own person card');
await ev('document.getElementById("v1110Search").value="NO_MATCH_7da5a88b";renderV1110People()');assert.equal(await ev('document.querySelectorAll(".rn-person").length'),0);assert.equal(await ev('!!document.querySelector("#v1110People>.rn-empty")'),true);
await ev('RelationshipsNetwork.openPerson('+JSON.stringify(ids[0])+')');assert.equal(await ev('document.querySelectorAll(".rn-person").length'),ids.length);assert.equal(await ev('document.getElementById("v1110Search").value'),'');
await ev('RelationshipsNetwork.load()');assert.equal(await ev('document.querySelectorAll(".rn-person").length'),ids.length);
await ev('document.querySelector("#relationships .v1110-hero button").click()');assert.equal(await ev('document.getElementById("peopleCreatePanel").open'),true);await ev('document.querySelector("#peopleCreatePanel .v1110-form-actions button:last-child").click()');assert.equal(await ev('document.getElementById("peopleCreatePanel").open'),false);
fs.mkdirSync('.local',{recursive:true});
for(const dark of [false,true]){
await ev(`document.body.classList.toggle('theme-dark',${dark})`);
assert.equal(await ev('getComputedStyle(document.querySelector("#relationships .v1110-hero")).backgroundImage'),'none','Plain header in both themes');
assert.equal(await ev('getComputedStyle(document.querySelector("#v1110Summary>div")).backgroundColor'),'rgba(0, 0, 0, 0)','Quiet summary strip in both themes');
for(const width of [1440,960,780,390,320]){
await send('Emulation.setDeviceMetricsOverride',{width,height:1080,deviceScaleFactor:1,mobile:width<800});await ev('setMobileMenu(false);window.scrollTo(0,0)');await pause(100);
assert.equal(await ev('document.documentElement.scrollWidth<=innerWidth+1'),true,'Page overflow '+width+' '+dark);
assert.equal(await ev('(()=>{const r=document.querySelector(".rn-person").getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1})()'),true,'Selected person fits '+width);
assert.equal(await ev('document.querySelectorAll(".rn-person").length'),ids.length);
assert.equal(await ev('(()=>{const cards=[...document.querySelectorAll(".rn-person")];return cards.every((c,i)=>!i||c.getBoundingClientRect().top>=cards[i-1].getBoundingClientRect().bottom+20)})()'),true,'Independent spaced cards '+width);
if(width===1440||width===390){const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(`.local/relationships-directory-${width}-${dark?'dark':'light'}.png`,Buffer.from(shot.data,'base64'));}
}
}
assert.deepEqual(errors,[]);console.log('PASS stacked person dossiers, three visible sections, correct record ownership, search/empty state, direct links, add/cancel and five-width light/dark layouts.');
}finally{await ev(`document.body.classList.toggle('theme-dark',${wasDark});setMobileMenu(false)`).catch(()=>{});await send('Emulation.clearDeviceMetricsOverride');ws.close();}
