import assert from 'node:assert/strict'
import fs from 'node:fs'
import crypto from 'node:crypto'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { buildPlan, bundleFingerprint, hasPersonalData, columns } from './lib/postgres-import-plan.mjs'

const areaId=crypto.randomUUID(),projectId=crypto.randomUUID(),taskId=crypto.randomUUID(),habitId=crypto.randomUUID()
const source = {version:1,memory:{
  tasks:[{id:taskId,title:'تسک فارسی',project_id:projectId,category:'شخصی'}],
  projects:[{id:projectId,name:'Test project'}],events:[],activity:[],goals:[],
  habits:[{id:habitId,title:'Test routine',logs:{'2026-10-08':true}}],
  finance:{accounts:[{id:crypto.randomUUID(),name:'Test account',balance:50}]},
  execution:{task_meta:{[taskId]:{context:'home'}},focus_sessions:[]},
  v11:{areas:[{id:areaId,name:'شخصی'}],project_meta:{[projectId]:{area_id:areaId,outcome:'Test outcome'}},
    spiritual_routines:[],health_metrics:[{id:crypto.randomUUID(),name:'Energy',slug:'energy'}],links:[]}
}}
const user = crypto.randomUUID()
const reportId=crypto.randomUUID()
source.memory.project_reports={[reportId]:{id:reportId,project_id:projectId,user_id:'local-demo',text:'Project update',report_date:'2026-10-23',version:1,created_at:'2026-10-23T09:00:00Z',updated_at:'2026-10-23T09:00:00Z'}}
const plan = buildPlan(source,user)
assert.equal(plan.tables.project_reports[0].text,'Project update')
assert.equal(plan.tables.project_reports[0].user_id,user)
assert.equal(plan.counts.tasks,source.memory.tasks.length)
assert.equal(plan.counts.routines,source.memory.habits.length+source.memory.v11.spiritual_routines.length)
assert.deepEqual(plan.life.finance,source.memory.finance)
assert.deepEqual(plan.life.execution,source.memory.execution)
assert.deepEqual(plan.tables.tasks.map(row=>row.id),source.memory.tasks.map(row=>row.id))
assert.ok(Object.values(plan.tables).flat().every(row=>row.user_id===user))
assert.equal(plan.tables.projects[0].area_id,source.memory.v11.project_meta[source.memory.projects[0].id].area_id)
assert.deepEqual(plan.tables.health_metric_definitions.map(row=>row.id),source.memory.v11.health_metrics.map(row=>row.id))
const unchecked=structuredClone(source)
unchecked.memory.habits[0].logs['2026-10-09']=false
assert.ok(buildPlan(unchecked,user).tables.routine_logs.some(row=>row.value===false))
assert.deepEqual(buildPlan(source,user).tables.routine_logs,plan.tables.routine_logs)
assert.equal(bundleFingerprint(source),bundleFingerprint({...source,savedAt:'different export time'}))
assert.notEqual(bundleFingerprint(source),bundleFingerprint({...source,browserEdits:{'MI-1':{status:true}}}))
assert.equal(hasPersonalData({habits:[]}),false)
assert.equal(hasPersonalData({execution:{task_meta:{example:{}}}}),true)
assert.equal(hasPersonalData({finance:{accounts:[{}]}}),true)
const bad=structuredClone(source);bad.memory.tasks[0].project_id=crypto.randomUUID()
assert.throws(()=>buildPlan(bad,user),/Dangling reference/)
const invalid=structuredClone(source);invalid.memory.tasks[0].id='SQL injection text'
assert.throws(()=>buildPlan(invalid,user),/Invalid UUID/)
const duplicate=structuredClone(source);duplicate.memory.tasks.push(duplicate.memory.tasks[0])
assert.throws(()=>buildPlan(duplicate,user),/Duplicate/)
const link=structuredClone(source);link.memory.v11.links.push({id:crypto.randomUUID(),source_type:'task',source_id:link.memory.tasks[0].id,relation:'in_project',target_type:'project',target_id:link.memory.projects[0].id})
assert.equal(buildPlan(link,user).counts.entity_links,1)
link.memory.v11.links[0].target_id=crypto.randomUUID()
assert.throws(()=>buildPlan(link,user),/Dangling\/unknown/)
const schema=fs.readFileSync('server/schema.sql','utf8')
for(const [table,fields] of Object.entries(columns)) {
  const block=schema.match(new RegExp(`CREATE TABLE IF NOT EXISTS ${table} \\(([\\s\\S]*?)\\n\\);`))?.[1]
  assert.ok(block,table)
  for(const field of fields) assert.ok(new RegExp(`\\b${field}\\b`).test(block)||new RegExp(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${field}\\b`).test(schema),`${table}.${field}`)
}
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'nova-import-check-'))
try {
  const filename=path.join(temporary,'fixture.json')
  fs.writeFileSync(filename,JSON.stringify(source))
  const preview=spawnSync(process.execPath,['scripts/import-local-to-postgres.mjs','--source',filename],{encoding:'utf8',env:{...process.env,NOVA_IMPORT_DATABASE_URL:'postgresql://must-not-connect.invalid/nova'}})
  assert.equal(preview.status,0,preview.stderr)
  assert.match(preview.stdout,/OFFLINE PREVIEW/)
} finally {
  for(const entry of fs.readdirSync(temporary))fs.unlinkSync(path.join(temporary,entry))
  fs.rmdirSync(temporary)
}
console.log('PASS migration plan: source IDs, all domains, canonical metadata/logs, FK checks, duplicates, receipt fingerprint, schema columns, offline safety')
