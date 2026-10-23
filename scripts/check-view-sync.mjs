import fs from 'node:fs'
import vm from 'node:vm'
import assert from 'node:assert/strict'
const html=fs.readFileSync('index.html','utf8')
const apiCode=html.match(/async function apiFetch\(path,options=\{\}\)\{([\s\S]*?)\n\}/)[0]
const headers=[]
const events=[]
const calls=[]
const sandbox=vm.createContext({
 console,
 fetch:async(path,options)=>{headers.push(options.headers);return {ok:true,json:async()=>({id:'task'})}},
 CustomEvent:class {constructor(type,options){this.type=type;this.detail=options.detail}},
 V112_LEGACY_LOADED:true,V112_REFS_LOADED:true,
 v112Invalidate:()=>calls.push('invalidate'),v112RefreshLegacy:async()=>calls.push('legacy'),
 v112RefreshDashboard:async()=>calls.push('dashboard'),reloadV111Tasks:async()=>calls.push('workspace'),
 v112EnsureLegacy:async()=>{},hydrateModuleCards:()=>{},showToast:()=>{},
 window:{dispatchEvent:event=>events.push(event),handleFunctionalPageOpen:async()=>calls.push('open')}
})
vm.runInContext(apiCode,sandbox)
await vm.runInContext('apiFetch("/api/tasks/task",{method:"DELETE"})',sandbox)
assert.equal(headers[0]['Content-Type'],undefined)
await vm.runInContext('apiFetch("/api/tasks/task",{method:"PATCH",body:"{}"})',sandbox)
assert.equal(headers[1]['Content-Type'],'application/json')
sandbox.window.apiFetch=async()=>({id:'task',status:'done'})
const sync=html.match(/<script id="novaViewSync">([\s\S]*?)<\/script>/)[1]
vm.runInContext(sync,sandbox)
await sandbox.window.apiFetch('/api/tasks/task',{method:'PATCH',body:'{}'})
assert.equal(events[0].type,'nova:data-changed')
assert.equal(events[0].detail.result.status,'done')
assert.ok(calls.includes('invalidate'))
assert.equal(sandbox.V112_REFS_LOADED,true,'Task edits do not invalidate unchanged project/area references')
await sandbox.window.handleFunctionalPageOpen('workspace')
assert.ok(!calls.includes('legacy'),'Opening tasks does not download the whole application')
assert.ok(calls.includes('workspace'))
assert.ok(calls.includes('open'))
await sandbox.window.apiFetch('/api/projects/project',{method:'PATCH',body:'{}'})
assert.equal(sandbox.V112_REFS_LOADED,false)
await sandbox.window.handleFunctionalPageOpen('today')
assert.ok(calls.includes('legacy'),'Legacy destinations still synchronize unrelated edits')
console.log('PASS: successful mutations notify shared views, invalidate caches and refresh destinations; empty DELETE requests have no JSON header.')
