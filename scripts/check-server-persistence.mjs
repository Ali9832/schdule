import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nova-restart-'))
const filename = path.join(directory, 'memory.json')
const base = 'http://127.0.0.1:3003'
let server
async function api(route, method = 'GET', body) {
  const response = await fetch(base + route, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined })
  const data = await response.json()
  assert.ok(response.ok, `${method} ${route}: ${response.status} ${JSON.stringify(data)}`)
  return data
}
async function start() {
  server = spawn(process.execPath, ['server/index.js'], { stdio: 'ignore', windowsHide: true, env: { ...process.env, PORT: '3003', DATABASE_URL: '', NODE_ENV: 'test', NOVA_LOCAL_STORE: filename } })
  for (let retry = 0; retry < 100; retry++) {
    if (server.exitCode !== null) throw new Error('Test server exited')
    try { await api('/api/health'); return } catch {}
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw new Error('Test server did not start')
}
async function stop() {
  if (!server || server.exitCode !== null) return
  const exited = new Promise(resolve => server.once('exit', resolve))
  server.kill()
  await exited
}
try {
  await start()
  const task = await api('/api/tasks', 'POST', { title: 'Restart durability test', status: 'done' })
  const spiritual = await api('/api/v11.11/spiritual-routines', 'POST', { title: 'Shared routine test' })
  const routine = spiritual.spiritual.routines.find(item => item.title === 'Shared routine test')
  assert.ok(routine)
  const edited = await api('/api/habits/' + routine.id, 'PATCH', { title: 'Shared edited', logs: { '2026-10-09': true } })
  assert.equal(edited.title, 'Shared edited')
  assert.equal((await api('/api/v11.11/integration')).spiritual.routines.find(item => item.id === routine.id).logs['2026-10-09'], true)
  const snapshot = JSON.parse(fs.readFileSync(filename, 'utf8'))
  assert.equal(snapshot.memory.tasks.find(item => item.id === task.id).status, 'done')
  await stop()
  await start()
  assert.equal((await api('/api/tasks')).find(item => item.id === task.id).title, task.title)
  assert.equal((await api('/api/habits')).find(item => item.id === routine.id).title, 'Shared edited')
  await api('/api/habits/' + routine.id, 'DELETE')
  assert.ok(!(await api('/api/habits')).some(item => item.id === routine.id))
  const source = await api('/api/modules/spiritual/items', 'POST', { title: 'Legacy spiritual source' })
  assert.ok((await api('/api/habits')).some(item => item.id === source.id))
  await api('/api/habits/' + source.id, 'DELETE')
  assert.ok(!(await api('/api/habits')).some(item => item.id === source.id))
  await stop()
  await start()
  assert.ok(!(await api('/api/habits')).some(item => item.id === routine.id || item.id === source.id))
  console.log('PASS real server restart: task IDs/status and routine edits/logs retained; routine deletions stay deleted, including legacy sources')
} finally {
  await stop()
  for (const entry of fs.readdirSync(directory)) fs.unlinkSync(path.join(directory, entry))
  fs.rmdirSync(directory)
}
