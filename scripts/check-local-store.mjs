import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createLocalStore } from '../server/local-store.js'

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nova-store-'))
const filename = path.join(directory, 'memory.json')
try {
  const store = createLocalStore(filename)
  assert.equal(store.load(), null)
  const memory = { tasks: [{ id: 'retained-id', title: 'عنوان فارسی', status: 'done' }], projects: [], v11: { people: [{ status: 'archived' }] } }
  store.save(memory)
  assert.deepEqual(createLocalStore(filename).load(), memory)
  memory.tasks = []
  store.save(memory)
  assert.deepEqual(createLocalStore(filename).load().tasks, [])
  assert.ok(!fs.existsSync(filename + '.tmp'))
  fs.writeFileSync(filename, '{broken')
  assert.throws(() => createLocalStore(filename).load())
  assert.equal(fs.readFileSync(filename, 'utf8'), '{broken')
  console.log('PASS local persistence: IDs, Unicode, hidden records, empty lists, atomic writes, corrupt-file protection')
} finally {
  for (const entry of fs.readdirSync(directory)) fs.unlinkSync(path.join(directory, entry))
  fs.rmdirSync(directory)
}
