import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawnSync } from 'node:child_process'

const root = process.cwd()
const failures = []
const passes = []
const pass = (m) => passes.push(m)
const fail = (m) => failures.push(m)
const read = (p) => fs.readFileSync(path.join(root,p),'utf8')
const exists = (p) => fs.existsSync(path.join(root,p))
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex')

function syntaxCheck(file){
  const r=spawnSync(process.execPath,['--check',file],{cwd:root,encoding:'utf8'})
  if(r.status===0) pass(`Syntax: ${file}`); else fail(`Syntax: ${file} — ${(r.stderr||r.stdout).trim()}`)
}

for (const f of ['package.json','index.html','dist/index.html','server/index.js','server/schema.sql','manifest.webmanifest','sw.js','public/manifest.webmanifest','public/sw.js']) {
  exists(f) ? pass(`Exists: ${f}`) : fail(`Missing: ${f}`)
}
syntaxCheck('server/index.js')
syntaxCheck('server/finance-editor.js')
syntaxCheck('server/planning-date.js')
syntaxCheck('public/assets/date-context.js')
syntaxCheck('public/assets/date-context-ui.js')
syntaxCheck('public/assets/fast-mutations.js')
syntaxCheck('public/assets/today-tasks.js')
const fastMutationsCheck=spawnSync(process.execPath,['scripts/check-fast-mutations.mjs'],{cwd:root,encoding:'utf8'})
fastMutationsCheck.status===0 ? pass('Confirmed task updates and scoped reconciliation verified') : fail(`Fast mutations: ${(fastMutationsCheck.stderr||fastMutationsCheck.stdout).trim()}`)
const planningDateCheck=spawnSync(process.execPath,['scripts/check-planning-date.mjs'],{cwd:root,encoding:'utf8'})
planningDateCheck.status===0 ? pass('Planning date, Tehran midnight rollover and date filtering verified') : fail(`Planning date: ${(planningDateCheck.stderr||planningDateCheck.stdout).trim()}`)
syntaxCheck('public/assets/finance-editor.js')
const financeCheck=spawnSync(process.execPath,['scripts/check-finance-editor.mjs'],{cwd:root,encoding:'utf8'})
financeCheck.status===0 ? pass('Finance creation, editing, settlement and accounting verified') : fail(`Finance: ${(financeCheck.stderr||financeCheck.stdout).trim()}`)
syntaxCheck('server/postgres-config.js')
const postgresConfigCheck=spawnSync(process.execPath,['scripts/check-postgres-config.mjs'],{cwd:root,encoding:'utf8'})
postgresConfigCheck.status===0 ? pass('Prisma connection options and PostgreSQL dates verified') : fail(`PostgreSQL config: ${(postgresConfigCheck.stderr||postgresConfigCheck.stdout).trim()}`)
syntaxCheck('server/local-store.js')
syntaxCheck('server/calendar.js')
syntaxCheck('server/calendar-rules.js')
syntaxCheck('server/calendar-attachments.js')
syntaxCheck('public/assets/calendar-extras.js')
syntaxCheck('public/assets/calendar.js')
syntaxCheck('public/assets/auth.js')
syntaxCheck('api/index.js')
const vercelCheck=spawnSync(process.execPath,['scripts/check-vercel.mjs'],{cwd:root,encoding:'utf8'})
vercelCheck.status===0 ? pass('Vercel handler and persistent production configuration verified') : fail(`Vercel: ${(vercelCheck.stderr||vercelCheck.stdout).trim()}`)
const calendarCheck=spawnSync(process.execPath,['scripts/check-calendar.mjs'],{cwd:root,encoding:'utf8'})
calendarCheck.status===0 ? pass('Calendar validation, persistence and multi-source actions verified') : fail(`Calendar: ${(calendarCheck.stderr||calendarCheck.stdout).trim()}`)
syntaxCheck('scripts/import-local-to-postgres.mjs')
syntaxCheck('scripts/lib/postgres-import-plan.mjs')
const importCheck=spawnSync(process.execPath,['scripts/check-postgres-import.mjs'],{cwd:root,encoding:'utf8'})
importCheck.status===0 ? pass('PostgreSQL import mapping, references and offline safety verified') : fail(`PostgreSQL import: ${(importCheck.stderr||importCheck.stdout).trim()}`)
const localCheck=spawnSync(process.execPath,['scripts/check-local-store.mjs'],{cwd:root,encoding:'utf8'})
localCheck.status===0 ? pass('Local data persistence and corrupt-file protection verified') : fail(`Local store: ${(localCheck.stderr||localCheck.stdout).trim()}`)
syntaxCheck('server.js')

const html = read('index.html')
const distHtml = read('dist/index.html')
sha(html.replace(/\r\n/g,'\n'))===sha(distHtml.replace(/\r\n/g,'\n')) ? pass('index.html and dist/index.html are synchronized') : fail('index.html and dist/index.html differ')
syntaxCheck('public/assets/master-bank.js')
const bankCheck=spawnSync(process.execPath,['scripts/check-bank.mjs'],{cwd:root,encoding:'utf8'})
bankCheck.status===0 ? pass('Master bank data, filtering, escaping and local edits verified') : fail(`Master bank: ${(bankCheck.stderr||bankCheck.stdout).trim()}`)
const viewCheck=spawnSync(process.execPath,['scripts/check-view-sync.mjs'],{cwd:root,encoding:'utf8'})
viewCheck.status===0 ? pass('Shared view updates, cache invalidation and delete requests verified') : fail(`Shared views: ${(viewCheck.stderr||viewCheck.stdout).trim()}`)

const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1])
let scriptErrors=0
scripts.forEach((code,i)=>{ try{ new Function(code) } catch(e){ scriptErrors++; fail(`Inline script ${i+1}: ${e.message}`) } })
if(!scriptErrors) pass(`Inline JavaScript syntax: ${scripts.length}/${scripts.length}`)

const ids=[...html.matchAll(/\bid=["']([^"']+)["']/g)].map(m=>m[1])
const counts=new Map(); ids.forEach(x=>counts.set(x,(counts.get(x)||0)+1))
const dupIds=[...counts.entries()].filter(([,n])=>n>1)
dupIds.length ? fail(`Duplicate HTML ids: ${dupIds.map(([x,n])=>`${x}×${n}`).join(', ')}`) : pass(`Unique HTML ids: ${ids.length}`)

const server=read('server/index.js')+'\n'+read('server/calendar.js')+'\n'+read('server/calendar-attachments.js')+'\n'+read('server/finance-editor.js')
const routeRe=/\b(?:fastify|app)\.(get|post|put|patch|delete)\(\s*[`'"]([^`'"]+)/gi
const routes=[]; let rm
while((rm=routeRe.exec(server))) routes.push([rm[1].toUpperCase(),rm[2]])
const routeKeys=routes.map(([m,p])=>`${m} ${p}`)
const dupRoutes=routeKeys.filter((x,i,a)=>a.indexOf(x)!==i)
;[...new Set(dupRoutes)].length ? fail(`Duplicate routes: ${[...new Set(dupRoutes)].join(', ')}`) : pass(`Unique backend routes: ${routes.length}`)

const frontRefs=[...new Set([...(html+'\n'+read('public/assets/calendar.js')+'\n'+read('public/assets/calendar-extras.js')+'\n'+read('public/assets/finance-editor.js')+'\n'+read('public/assets/date-context-ui.js')).matchAll(/["'`]((?:\/api\/)[^"'`\s?]*)/g)].map(m=>m[1]))]
const split=(p)=>p.replace(/\$\{[^}]+\}/g,':x').replace(/\/$/,'').split('/')
const routeMatches=(f,b)=>{const F=split(f),B=split(b); return F.length===B.length && F.every((v,i)=>B[i]?.startsWith(':') || v===B[i])}
const unmatched=frontRefs.filter(f=>!routes.some(([,b])=>routeMatches(f,b)))
unmatched.length ? fail(`Frontend API refs without backend route: ${unmatched.join(', ')}`) : pass(`Frontend API references mapped: ${frontRefs.length}/${frontRefs.length}`)

const migrations=['011_canonical_entities.sql','012_outcome_area_control.sql','013_resource_learning_pipeline.sql','014_health_energy_system.sql','015_relationship_people_commitments.sql','016_spiritual_religious_integration.sql','017_calendar_attachments.sql']
const missingM=migrations.filter(f=>!exists(`server/migrations/${f}`))
missingM.length ? fail(`Missing migrations: ${missingM.join(', ')}`) : pass(`Migrations present: ${migrations.length}`)

const critical=['/api/health','/api/release','/api/v11.2/dashboard','/api/v11/tasks/paged','/api/v11.6/meetings','/api/v11.7/control','/api/v11.8/learning','/api/v11.9/health-system','/api/v11.10/relationships','/api/v11.11/integration','/api/v11.12/finance']
const routePaths=new Set(routes.map(([,p])=>p))
const missingCritical=critical.filter(p=>!routePaths.has(p))
missingCritical.length ? fail(`Critical routes missing: ${missingCritical.join(', ')}`) : pass(`Critical integration routes present: ${critical.length}`)

const pkg=JSON.parse(read('package.json'))
const lock=JSON.parse(read('package-lock.json'))
const validVersion=/^\d+\.\d+\.\d+$/.test(pkg.version)
validVersion && pkg.name==='mllibden' && lock.version===pkg.version && lock.packages[''].version===pkg.version ? pass(`Package and lockfile: mllibden ${pkg.version}`) : fail('Package and lockfile versions differ')
html.includes(`id="app-version" dir="ltr">v${pkg.version}</small>`) ? pass('Visible version matches package') : fail('Visible version differs from package')
read('CHANGELOG.md').includes(`## [${pkg.version}]`) ? pass('Current release has a changelog entry') : fail('Current release changelog is missing')
html.includes('<title>نوا — فضای شخصی molibden</title>') && !html.includes('مهسا رضایی') ? pass('Product identity is current') : fail('Product identity is stale')
;['sw.js','public/sw.js','dist/sw.js'].every(file=>read(file).includes(`molibden-v${pkg.version}`)) ? pass('PWA cache namespace updated and synchronized') : fail('PWA cache namespace is stale')

console.log('\nNOVA FINAL STATIC QA')
console.log('====================')
for(const x of passes) console.log(`PASS  ${x}`)
for(const x of failures) console.log(`FAIL  ${x}`)
console.log(`\nResult: ${passes.length} passed, ${failures.length} failed`)
if(failures.length) process.exit(1)
