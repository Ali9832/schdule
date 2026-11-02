import assert from 'node:assert/strict'
const base=process.env.NOVA_BASE_URL||'http://127.0.0.1:3036'
const tabs=await(await fetch('http://127.0.0.1:9227/json/list')).json(),ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl)
await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject});let id=0;const pending=new Map(),errors=[]
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result)}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text)}
const send=(method,params={})=>new Promise((resolve,reject)=>{pending.set(++id,{resolve,reject});ws.send(JSON.stringify({id,method,params}))})
async function ev(expression){const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value}
const pause=ms=>new Promise(r=>setTimeout(r,ms));async function until(expression){for(let i=0;i<120;i++){if(await ev(expression))return;await pause(100)}throw Error('Timeout '+expression)}
const title='خرید کتاب برنامه نویسی '+Date.now();let task
async function type(text){await ev('(()=>{const n=document.getElementById("calendarInput-title");n.focus();n.select()})()');await send('Input.insertText',{text})}
try{
 await send('Runtime.enable');await send('Page.enable');await send('Network.enable');await send('Network.setCacheDisabled',{cacheDisabled:true});await send('Network.setBypassServiceWorker',{bypass:true});await send('Page.navigate',{url:base});await until('window.NovaUIReady && !!window.NoavaTaskSuggestions && !!V112_DASH')
 task=await(await fetch(base+'/api/tasks',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title,due_date:'2026-11-12',description:'Existing task'})})).json()
 const initial=await ev('apiFetch("/api/tasks").then(r=>r.length)')
 await ev('AppOverlays.closeAll();openGenericAdd("daily","Task")');await type(title.slice(0,10))
 await until(`!!document.querySelector('.task-suggestions:not([hidden]) [data-task-id="${task.id}"]')`)
 await type(title);await until(`document.querySelector('.task-suggestions:not([hidden]) .task-suggestion')?.dataset.taskId==='${task.id}'`)
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowDown',code:'ArrowDown',windowsVirtualKeyCode:40});await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13})
 await until(`!!document.querySelector('dialog.task-match-dialog[open][data-task-id="${task.id}"]')`)
 assert.equal(await ev('apiFetch("/api/tasks").then(r=>r.length)'),initial,'selecting existing creates nothing')
 await ev('document.querySelector("dialog.task-match-dialog[open] button").click()')
 assert.equal(await ev('BASE_EDIT.id'),task.id);assert.equal(await ev('document.getElementById("genericTitleInput").value'),title)
 await ev('closeGenericAdd();openGenericAdd("daily","Task")');await type(title)
 await ev('document.getElementById("calendarItemForm").requestSubmit()');await until('!!document.querySelector("#taskDuplicateConfirm[open]")')
 await ev('document.querySelector("#taskDuplicateConfirm .task-match-actions button").click()');await until('!UnifiedCalendar.state.busy')
 assert.equal(await ev('apiFetch("/api/tasks").then(r=>r.length)'),initial)
 assert.equal(await ev('document.getElementById("calendarInput-title").value'),title,'cancel keeps draft')
 await ev('document.getElementById("calendarItemForm").requestSubmit()');await until('!!document.querySelector("#taskDuplicateConfirm[open]")')
 await ev('document.querySelector("#taskDuplicateConfirm [data-action=create-anyway]").click()');await until('!UnifiedCalendar.state.busy')
 assert.equal(await ev('apiFetch("/api/tasks").then(r=>r.length)'),initial+1,'explicit confirmation can create separate task')
 await ev(`void(window.__calendarResult=apiFetch('/api/calendar',{method:'POST',body:JSON.stringify({title:${JSON.stringify(title)},kind:'task',date:'2026-11-12'})}).then(()=>true,()=>false))`)
 await until('!!document.querySelector("#taskDuplicateConfirm[open]")');await ev('document.querySelector("#taskDuplicateConfirm .task-match-actions button").click()')
 assert.equal(await ev('window.__calendarResult'),false,'calendar task creation also checks duplicates')
 await ev('openGenericAdd("daily","Task")');await type('مورد کاملاً متفاوت')
 await until('document.querySelector(".task-suggestions")?.innerText.includes("کار مشابهی پیدا نشد")')
 // A failed lookup is surfaced instead of silently asserting that no duplicates exist.
 await ev(`window.__originalSuggestionFetch=window.fetch;window.fetch=(url,options)=>String(url).includes('/api/tasks/suggestions')?Promise.resolve(new Response(JSON.stringify({error:'Test unavailable'}),{status:503,headers:{'Content-Type':'application/json'}})):window.__originalSuggestionFetch(url,options)`)
 await type(title);await until('document.querySelector(".task-suggestions")?.innerText.includes("تلاش دوباره")')
 const beforeFailure=await ev('apiFetch("/api/tasks").then(r=>r.length)');await ev('document.getElementById("calendarItemForm").requestSubmit()');await until('!UnifiedCalendar.state.busy')
 assert.equal(await ev('apiFetch("/api/tasks").then(r=>r.length)'),beforeFailure,'failed duplicate lookup must not silently create')
 assert.equal(await ev('document.getElementById("calendarInput-title").value'),title)
 await ev(`window.fetch=(url,options)=>{if(!String(url).includes('/api/tasks/suggestions'))return window.__originalSuggestionFetch(url,options);const q=new URL(url,location.origin).searchParams.get('q'),old=q==='Older query';if(old)window.__oldQueryStarted=true;return new Promise(resolve=>setTimeout(()=>resolve(new Response(JSON.stringify({items:[{id:'test-result',title:old?'Stale result':'Fresh result',status:'todo'}]}),{status:200,headers:{'Content-Type':'application/json'}})),old?800:10))}`)
 await type('Older query');await until('window.__oldQueryStarted===true');await type('Newer query');await until('document.querySelector(".task-suggestions:not([hidden]) .task-suggestion strong")?.textContent==="Fresh result"');await pause(850)
 assert.equal(await ev('document.querySelector(".task-suggestions:not([hidden]) .task-suggestion strong").textContent'),'Fresh result','late response cannot replace a newer query')
 await ev('window.fetch=window.__originalSuggestionFetch;AppOverlays.closeAll()')
 const matches=await ev(`apiFetch('/api/tasks').then(r=>r.filter(t=>t.title===${JSON.stringify(title)}))`)
 for(const t of matches)await ev(`apiFetch('/api/tasks/${t.id}',{method:'DELETE'})`)
 assert.deepEqual(errors,[]);console.log('PASS live prefix suggestions, keyboard selection, opening/editing existing, cancel/draft preservation, intentional duplicate, calendar guard, failed lookup and stale-response protection')
}finally{ws.close()}
