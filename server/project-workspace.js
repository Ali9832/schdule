import crypto from 'node:crypto'
import { planningDate } from './planning-date.js'

const failure = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode })
const uuid = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || ''))
function meetingMeta(notes) {
  try { const meta = String(notes).startsWith('NOVA_MEETING::') ? JSON.parse(notes.slice(14)) : { summary: String(notes || '') }; return meta && typeof meta === 'object' && !Array.isArray(meta) ? meta : { summary: String(notes || '') } }
  catch { return { summary: String(notes || '') } }
}
export function projectMeeting(row) {
  const meta = meetingMeta(row.notes)
  const status = ['follow_up', 'closed'].includes(meta.phase) ? 'held' : new Date(row.end_at || row.start_at).getTime() < Date.now() ? 'past' : 'scheduled'
  return { id: row.id, title: row.title, start_at: row.start_at, end_at: row.end_at, project_id: row.project_id, summary: String(meta.summary || ''), status }
}
export function registerProjectWorkspace(app, { project, projects, meetings, createEvent, updateEvent, reports }) {
  async function owner(request) {
    if (!uuid(request.params.id)) throw failure('پروژه پیدا نشد.', 404)
    const row = await project(request.user.id, request.params.id)
    if (!row) throw failure('پروژه پیدا نشد.', 404)
    return row
  }
  const reportBody = body => {
    if (typeof body?.text !== 'string' || !body.text.trim() || body.text.length > 8000) throw failure('متن گزارش الزامی است؛ حداکثر ۸۰۰۰ نویسه.')
    return { text: body.text.trim(), report_date: planningDate(body.report_date) }
  }
  app.get('/api/projects/:id/workspace', async request => {
    const row = await owner(request)
    const [events, history] = await Promise.all([meetings(request.user.id, row.id), reports.list(request.user.id, row.id)])
    return { project: { id: row.id, name: row.name }, meetings: events.map(projectMeeting), reports: history }
  })
  app.post('/api/projects/:id/reports', async (request, reply) => {
    const row = await owner(request), body = reportBody(request.body)
    const report = { id: crypto.randomUUID(), project_id: row.id, user_id: request.user.id, ...body, version: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
    await reports.create(report)
    return reply.code(201).send(report)
  })
  app.patch('/api/projects/:id/reports/:reportId', async request => {
    const row = await owner(request)
    if (!uuid(request.params.reportId)) throw failure('گزارش پیدا نشد.', 404)
    const current = await reports.get(request.user.id, row.id, request.params.reportId)
    if (!current) throw failure('گزارش پیدا نشد.', 404)
    const body = reportBody(request.body), version = Number(request.body.version)
    if (!Number.isInteger(version) || version !== current.version) throw failure('این گزارش در جای دیگری تغییر کرده است؛ آن را دوباره باز کنید.', 409)
    const next = { ...current, ...body, version: version + 1, updated_at: new Date().toISOString() }
    if (!await reports.update(next, version)) throw failure('گزارش هم‌زمان تغییر کرده است؛ دوباره باز کنید.', 409)
    return next
  })
  app.get('/api/project-reports', async request => {
    const owned = new Map((await projects(request.user.id)).map(row => [row.id, row.name]))
    return { reports: (await reports.list(request.user.id)).filter(row => owned.has(row.project_id)).map(row => ({ ...row, project_name: owned.get(row.project_id) })) }
  })
  app.post('/api/projects/:id/meetings', async (request, reply) => {
    const row = await owner(request), body = request.body || {}
    const title = String(body.title || '').trim(), date = planningDate(body.date)
    const time = String(body.time || '09:00'), duration = Number(body.duration ?? 45)
    if (!title || title.length > 300) throw failure('عنوان جلسه الزامی است؛ حداکثر ۳۰۰ نویسه.')
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time) || !Number.isInteger(duration) || duration < 5 || duration > 1440) throw failure('ساعت یا مدت جلسه معتبر نیست.')
    if (!['scheduled', 'held'].includes(body.status || 'scheduled')) throw failure('وضعیت جلسه معتبر نیست.')
    if (typeof body.summary !== 'undefined' && (typeof body.summary !== 'string' || body.summary.length > 2000)) throw failure('توضیحات جلسه حداکثر ۲۰۰۰ نویسه است.')
    const start = new Date(`${date}T${time}:00+03:30`), end = new Date(start.getTime() + duration * 60000)
    const saved = await createEvent(request.user.id, { title, type: 'meeting', project_id: row.id, start_at: start.toISOString(), end_at: end.toISOString(), color: '#356d70', notes: 'NOVA_MEETING::' + JSON.stringify({ phase: body.status === 'held' ? 'follow_up' : 'prepare', summary: body.summary || '', participants: [], actions: [], decisions: [] }) })
    return reply.code(201).send(projectMeeting(saved))
  })
  app.patch('/api/projects/:id/meetings/:meetingId', async request => {
    const row = await owner(request), current = (await meetings(request.user.id, row.id)).find(event => event.id === request.params.meetingId)
    if (!current) throw failure('جلسهٔ این پروژه پیدا نشد.', 404)
    const status = request.body?.status
    if (!['scheduled', 'held'].includes(status)) throw failure('وضعیت جلسه معتبر نیست.')
    const meta = meetingMeta(current.notes)
    meta.phase = status === 'held' ? 'follow_up' : 'prepare'
    const saved = await updateEvent(request.user.id, current.id, { ...current, notes: 'NOVA_MEETING::' + JSON.stringify(meta) })
    if (!saved) throw failure('جلسه پیدا نشد.', 404)
    return projectMeeting(saved)
  })
}
