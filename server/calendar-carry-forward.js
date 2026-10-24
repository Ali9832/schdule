import { validDate, occurrences, shiftDays } from './calendar-rules.js'
import { normalizeCalendarState } from './calendar.js'

const sources = { task: 'tasks', event: 'events', project: 'projects', outcome: 'outcomes' }
const tables = { task: 'tasks', event: 'planner_events', project: 'projects', outcome: 'outcomes' }
const uuid = '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
const bad = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode })
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const difference = (a, b) => Math.round((Date.parse(a) - Date.parse(b)) / 86400000)

// Pure planning: no record is changed until every selected record has passed validation.
export function planCarryForward(items, records, storedCalendar, target) {
  if (!validDate(target)) throw bad('تاریخ مقصد معتبر نیست.')
  const calendar = normalizeCalendarState(storedCalendar), patches = {}, updates = { task: [], event: [], project: [], outcome: [] }
  const maps = Object.fromEntries(Object.entries(sources).map(([source, key]) => [source, new Map((records[key] || []).map(row => [row.id, row]))]))
  const seen = new Set(), moved = [], unchanged = []
  for (const item of items) {
    const { source, id, occurrence_date: occurrence } = item
    if (!Object.hasOwn(sources, source)) throw bad('نوع آیتم معتبر نیست.')
    const identity = source + ':' + id + '@' + (occurrence || '')
    if (seen.has(identity)) continue
    seen.add(identity)
    const current = maps[source].get(id)
    if (!current) throw bad('یکی از آیتم‌ها پیدا نشد؛ فهرست را تازه کنید.', 404)
    const key = source + ':' + id, old = calendar[key] || {}
    const start = String(current.start_at || current.due_date || '').slice(0, 10)
    const result = { source, id, occurrence_date: occurrence || null }
    if (old.recurrence) {
      if (!validDate(occurrence) || !validDate(start) || !occurrences(start, old.recurrence, occurrence, occurrence).length) throw bad('یکی از نوبت‌های انتخاب‌شده دیگر در مجموعه نیست؛ فهرست را تازه کنید.')
      const exception = old.exceptions?.[occurrence] || {}, date = exception.moved_to || occurrence
      if (exception.done || exception.skipped) throw bad('یکی از نوبت‌ها انجام یا حذف شده است؛ فهرست را تازه کنید.')
      if (exception.moved_to === target) { unchanged.push(result); continue }
      const end = String(current.end_at || current.start_at || current.due_date || '').slice(0, 10), duration = source === 'event' ? difference(end, start) : 0
      if (date >= target || shiftDays(date, duration) >= target) throw bad('یکی از نوبت‌ها هنوز عقب‌افتاده نیست؛ فهرست را تازه کنید.')
      patches[key] ||= { ...old, exceptions: { ...old.exceptions } }
      patches[key].exceptions[occurrence] = { ...exception, moved_to: target }
    } else {
      if (occurrence) throw bad('برای آیتم بدون تکرار، نوبت جداگانه انتخاب نکنید.')
      if (!validDate(start) || (source === 'event' && old.done) || current.status === 'done') throw bad('یکی از آیتم‌ها دیگر عقب‌افتاده نیست؛ فهرست را تازه کنید.')
      if (start === target) { unchanged.push(result); continue }
      if (start > target) throw bad('یکی از آیتم‌ها برای آینده برنامه‌ریزی شده است؛ فهرست را تازه کنید.')
      if (source === 'event') {
        const end = String(current.end_at || current.start_at).slice(0, 10), duration = difference(end, start)
        if (!validDate(end) || end >= target) throw bad('یکی از برنامه‌ها هنوز پایان نیافته است؛ فهرست را تازه کنید.')
        updates.event.push({ id, start_at: target + String(current.start_at).slice(10), end_at: shiftDays(target, duration) + String(current.end_at || current.start_at).slice(10) })
      } else updates[source].push({ id, due_date: target })
      if (old.due_date) patches[key] = { ...old, due_date: shiftDays(old.due_date, difference(target, start)) }
    }
    moved.push(result)
  }
  return { updates, calendar: patches, result: { ok: true, date: target, moved_count: moved.length, unchanged_count: unchanged.length, moved, unchanged } }
}

export function memoryCarryForward(getMemory, clock = today) {
  return async (userId, items) => {
    const memory = getMemory(userId), calendar = memory.execution?.calendar || {}
    const plan = planCarryForward(items, { tasks: memory.tasks, events: memory.events, projects: memory.projects, outcomes: memory.goals }, calendar, clock())
    // No awaits during the commit: readers cannot see half of an in-memory batch.
    for (const [source, updates] of Object.entries(plan.updates)) {
      const key = source === 'outcome' ? 'goals' : sources[source], byId = new Map(updates.map(row => [row.id, row]))
      if (updates.length) memory[key] = memory[key].map(row => byId.has(row.id) ? { ...row, ...byId.get(row.id), ...(source === 'project' ? {} : { updated_at: new Date().toISOString() }) } : row)
    }
    if (Object.keys(plan.calendar).length) memory.execution = { ...memory.execution, calendar: { ...calendar, ...plan.calendar } }
    return plan.result
  }
}

export function postgresCarryForward(pool, clock = today) {
  return async (userId, items) => {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', ['calendar-carry-forward:' + userId])
      await client.query("INSERT INTO user_life_data (user_id,data) VALUES ($1,'{}'::jsonb) ON CONFLICT (user_id) DO NOTHING", [userId])
      const life = await client.query("SELECT data#>'{execution,calendar}' AS calendar FROM user_life_data WHERE user_id=$1 FOR UPDATE", [userId])
      const records = {}
      // At most one scoped read and one set-based write per source, independent of item count.
      for (const [source, table] of Object.entries(tables)) {
        const ids = [...new Set(items.filter(item => item.source === source).map(item => item.id))]
        const columns = source === 'event' ? 'id,start_at,end_at' : 'id,due_date,status'
        records[sources[source]] = ids.length ? (await client.query(`SELECT ${columns} FROM ${table} WHERE user_id=$1 AND id=ANY($2::uuid[]) ORDER BY id FOR UPDATE`, [userId, ids])).rows : []
      }
      const plan = planCarryForward(items, records, life.rows[0]?.calendar || {}, clock())
      for (const [source, rows] of Object.entries(plan.updates)) {
        if (!rows.length) continue
        if (source === 'event') await client.query('UPDATE planner_events AS e SET start_at=b.start_at,end_at=b.end_at,updated_at=NOW() FROM jsonb_to_recordset($2::jsonb) AS b(id uuid,start_at timestamptz,end_at timestamptz) WHERE e.user_id=$1 AND e.id=b.id', [userId, JSON.stringify(rows)])
        else await client.query(`UPDATE ${tables[source]} AS e SET due_date=b.due_date${source === 'project' ? '' : ',updated_at=NOW()'} FROM jsonb_to_recordset($2::jsonb) AS b(id uuid,due_date date) WHERE e.user_id=$1 AND e.id=b.id`, [userId, JSON.stringify(rows)])
      }
      if (Object.keys(plan.calendar).length) {
        // Patch only calendar metadata; do not overwrite finance or other life-data sections.
        await client.query(`UPDATE user_life_data SET data=jsonb_set(data,'{execution}',
          (CASE WHEN jsonb_typeof(data->'execution')='object' THEN data->'execution' ELSE '{}'::jsonb END) ||
          jsonb_build_object('calendar',(CASE WHEN jsonb_typeof(data#>'{execution,calendar}')='object' THEN data#>'{execution,calendar}' ELSE '{}'::jsonb END) || $2::jsonb),true),updated_at=NOW() WHERE user_id=$1`, [userId, JSON.stringify(plan.calendar)])
      }
      await client.query('COMMIT')
      return plan.result
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally { client.release() }
  }
}

export function registerCalendarCarryForward(app, carryForward) {
  const schema = { type: 'object', additionalProperties: false, required: ['items'], properties: { items: { type: 'array', minItems: 1, maxItems: 10000, items: { type: 'object', additionalProperties: false, required: ['source', 'id'], properties: { source: { type: 'string', enum: Object.keys(sources) }, id: { type: 'string', pattern: uuid }, occurrence_date: { anyOf: [{ type: 'null' }, { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' }] } } } } } }
  app.post('/api/calendar/carry-forward', { schema: { body: schema } }, request => carryForward(request.user.id, request.body.items))
}
