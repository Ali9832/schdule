import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
let page='workspace',query='date=2026-10-23',renders=0,reads=0
const shared=[]
const sandbox=vm.createContext({ console,URLSearchParams,Set,Map,Number,Array,String,clearTimeout(){},setTimeout(){},
 document:{querySelector:()=>({id:page})},BASE_DATA:{tasks:shared},BASE_TASKS:shared,V11_DATA:{tasks:shared},V111_PAGE:{items:shared,total:0},
 V112_DASH:{today:'2026-10-23',now:{today_total:0,today_done:0,today_open:0,next_actions:[]}},
 DateContext:{date:'2026-10-23'},v111TaskParams:()=>query,todayIso:()=> '2026-10-23',renderV111Workspace:()=>renders++,renderTodayBase:()=>renders++,renderDailyTaskManager:()=>renders++,v112RenderDashboard:()=>renders++,reloadV111Tasks:async()=>reads++,v112RefreshDashboard:async()=>reads++,showToast(){}
})
sandbox.window=sandbox
vm.runInContext(fs.readFileSync('public/assets/fast-mutations.js','utf8'),sandbox)
const ui=sandbox.NovaFastUI
const task={id:'one',title:'Saved',due_date:'2026-10-23',status:'todo',priority:'medium'}
assert.equal(ui.applyMutation('/api/tasks','POST',task),true)
assert.equal(shared.length,1);assert.equal(sandbox.V111_PAGE.items.length,1);assert.equal(sandbox.V111_PAGE.total,1)
assert.equal(sandbox.V112_DASH.now.today_total,1);assert.equal(renders,1);assert.equal(reads,0)
ui.applyMutation('/api/tasks','POST',task)
assert.equal(shared.length,1);assert.equal(sandbox.V111_PAGE.total,1);assert.equal(sandbox.V112_DASH.now.today_total,1)
ui.applyMutation('/api/v11/tasks/one','PATCH',{...task,status:'done'})
assert.equal(shared[0].status,'done');assert.equal(sandbox.V112_DASH.now.today_done,1)
query='date=2026-10-24'
ui.applyMutation('/api/tasks/two','PATCH',{...task,id:'two'})
assert.equal(shared.length,2);assert.equal(sandbox.V111_PAGE.items.some(x=>x.id==='two'),false)
assert.equal(ui.applyMutation('/api/tasks','POST',{error:'Not saved'}),false)
assert.equal(ui.applyMutation('/api/projects','POST',{id:'project',name:'Project'}),false)
query='date=2026-10-23'
ui.applyMutation('/api/tasks/one','DELETE',{ok:true})
assert.equal(shared.some(x=>x.id==='one'),false);assert.equal(sandbox.V112_DASH.now.today_done,0)
assert.ok(ui.revision>=4)
await ui.refreshVisible();assert.equal(reads,1)
// A dashboard request started before a write cannot overwrite the confirmed result.
let snapshots=0,painted
sandbox.v112Get=async()=>{
  snapshots++
  if(snapshots===1)ui.applyMutation('/api/tasks','POST',{...task,id:'newer'})
  return {today:'2026-10-23',now:{today_total:snapshots===1?0:99}}
}
sandbox.v112SeedCanonicalFromDashboard=()=>{}
sandbox.v112RenderDashboard=data=>{painted=data.now.today_total}
const dashboard=fs.readFileSync('index.html','utf8').match(/async function v112RefreshDashboard\(force=false\)\{[^\n]+/)[0]
vm.runInContext(dashboard,sandbox)
await sandbox.v112RefreshDashboard(true)
assert.equal(snapshots,2);assert.equal(painted,99)
console.log('Fast mutations passed: confirmed-only updates, alias safety, no duplicate rows, task scopes, completion/delete counters and one visible-view reconciliation.')
