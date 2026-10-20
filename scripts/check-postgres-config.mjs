import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import pg from 'pg'
import { postgresOptions } from '../server/postgres-config.js'

const options = postgresOptions({ VERCEL: '1', scdule_DATABASE_URL: 'postgresql://example.invalid/nova' })
assert.equal(options.connectionString, 'postgresql://example.invalid/nova')
assert.equal(options.max, 1)
assert.equal(postgresOptions({ DATABASE_URL: 'explicit', scdule_DATABASE_URL: 'fallback' }).connectionString, 'explicit')
const parse = oid => options.types.getTypeParser(oid)
const due = parse(pg.types.builtins.DATE)('2026-10-20')
const updated = parse(pg.types.builtins.TIMESTAMPTZ)('2026-10-20 10:00:00+03:30')
assert.equal(due, '2026-10-20')
assert.equal(updated, '2026-10-20T06:30:00.000Z')
assert.equal(parse(pg.types.builtins.INT4)('24'), 24)
assert.deepEqual(parse(pg.types.builtins.JSONB)('{"ok":true}'), { ok: true })
assert.ok(pg.types.getTypeParser(pg.types.builtins.DATE)('2026-10-20') instanceof Date)

const source = fs.readFileSync(new URL('../server/index.js', import.meta.url), 'utf8')
const statsSource = source.slice(source.indexOf('function buildStats('), source.indexOf('function extractAssistantTaskTitle('))
const buildStats = vm.runInNewContext(`${statsSource}; buildStats`, { today: () => due, Date, Intl })
const stats = buildStats([
  { status: 'todo', due_date: due, estimate_minutes: 25 },
  { status: 'done', due_date: due, updated_at: updated }
], [], [{ start_at: updated }])
assert.equal(stats.due_today, 1)
assert.equal(stats.completed_today, 1)
assert.equal(stats.events_today, 1)
assert.equal(stats.focus_minutes, 25)
console.log('PASS Prisma variable fallback, serverless pool, PostgreSQL date decoding, statistics and unchanged global parsers')
