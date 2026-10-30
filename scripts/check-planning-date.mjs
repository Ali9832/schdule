import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { planningDate, tasksForDay } from '../server/planning-date.js'
assert.equal(planningDate('2028-02-29'), '2028-02-29')
for (const value of ['2026-02-29', '2026-13-01', '1405/08/01', '2026-01-01T12:00', '1899-12-31', ['2026-01-01']]) assert.throws(() => planningDate(value), /تاریخ/)
assert.equal(planningDate(undefined, '2026-10-23'), '2026-10-23')
const rows = [{ id: 1, due_date: '2026-10-23' }, { id: 2, due_date: '2026-10-24' }, { id: 3 }]
assert.deepEqual(tasksForDay(rows, '2026-10-23').map(x => x.id), [1, 3])
assert.deepEqual(tasksForDay(rows, '2026-10-23', false).map(x => x.id), [1])
let now = '2026-10-23T20:29:00Z'
class ClockDate extends Date { constructor(...args) { super(...(args.length ? args : [now])) } }
const events = []
const context = vm.createContext({ Date: ClockDate, Intl, Map, setInterval() {}, document: { addEventListener() {} }, CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options?.detail } }, Event: class { constructor(type) { this.type = type } } })
context.window = context; context.dispatchEvent = event => events.push(event)
vm.runInContext(fs.readFileSync('public/assets/date-context.js', 'utf8'), context)
const ctx = context.DateContext
assert.equal(ctx.date, '2026-10-23')
now = '2026-10-23T20:31:00Z'; ctx.checkDay(); assert.equal(ctx.date, '2026-10-24')
assert.ok(events.some(e => e.type === 'nova:date-changed'))
assert.equal(ctx.set('2026-02-30'), false)
ctx.set('2026-12-01'); now = '2026-10-24T20:31:00Z'; ctx.checkDay(); assert.equal(ctx.date, '2026-12-01')
assert.equal(ctx.today(), '2026-10-25'); assert.equal(ctx.shift('2026-12-31', 1), '2027-01-01')
assert.equal(ctx.scoped('workspace'),false);assert.equal(ctx.scoped('meetings'),false);assert.equal(ctx.scoped('finance'),false);assert.equal(ctx.scoped('today'),true)
assert.equal(ctx.matches('2026-12-02','workspace'),true,'all-day task list must be the default')
ctx.setScope('workspace',true)
assert.equal(ctx.matches('', 'workspace'), true); assert.equal(ctx.matches('2026-12-02', 'workspace'), false)
ctx.setScope('workspace', false); assert.equal(ctx.matches('2026-12-02', 'workspace'), true)
assert.equal(ctx.query('/api/check?a=1'), '/api/check?a=1&date=2026-12-01')
console.log('Planning date passed: validation, date-only task filtering, Tehran midnight rollover, independent real clock, manual-day preservation and scope toggles.')
