import crypto from 'node:crypto'

export const columns = Object.fromEntries(Object.entries({
  areas: 'id name description icon status standard created_at updated_at',
  projects: 'id name description due_date color icon status created_at area_id outcome lifecycle_status review_at last_touched_at version',
  planner_events: 'id title type start_at end_at color project_id notes created_at updated_at area_id version',
  tasks: 'id title description due_date priority status estimate_minutes category tags project_id created_at updated_at area_id context energy waiting_on resume_note source_meeting_id version',
  activity: 'id kind text created_at',
  outcomes: 'id title area_id status target_value current_value unit due_date next_action note metric_name baseline_value target_direction review_at measurement_note version created_at updated_at',
  routines: 'id title area_id routine_type description target_weekly status color created_at updated_at',
  routine_logs: 'id routine_id log_date value',
  resources: 'id title area_id resource_type status url note created_at updated_at author source_name started_at completed_at progress_percent next_action key_takeaways learning_output rating last_reviewed_at version',
  meeting_details: 'event_id area_id participants agenda pre_read summary decisions action_items waiting_items next_meeting_at updated_at',
  entity_links: 'id source_type source_id relation target_type target_id created_at',
  health_metric_definitions: 'id name slug category unit value_type target_min target_max good_direction icon active sort_order created_at updated_at',
  health_metric_logs: 'id metric_id log_date value_numeric value_text note source created_at updated_at',
  people: 'id name relation_type organization contact tags cadence_days last_contact_at next_contact_at important_date important_date_label notes status created_at updated_at',
  relationship_commitments: 'id person_id title direction kind status due_date task_id meeting_event_id note created_at updated_at',
  spiritual_routine_details: 'routine_id intention preferred_time minimum_action reflection_prompt updated_at',
  religious_event_details: 'event_id observance_notes preparation_notes reminder_days source_label updated_at'
}).map(([table, value]) => [table, value.split(' ')]))
export const jsonColumns = new Set(['tags', 'participants', 'decisions', 'action_items', 'waiting_items'])
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const lifeKeys = ['goals','habits','weekly_plan','daily_logs','ideas','finance','modules','execution']

function stableId(value) {
  const hex = crypto.createHash('sha256').update(value).digest('hex').slice(0, 32)
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`
}
function meeting(notes = '') {
  if (!notes.startsWith('NOVA_MEETING::')) return { participants: [], agenda: '', pre_read: '', summary: notes, decisions: [], action_items: [], waiting_items: [] }
  const data = JSON.parse(notes.slice('NOVA_MEETING::'.length))
  const list = value => Array.isArray(value) ? value : String(value || '').split(/\n|،|,/).map(x => x.trim()).filter(Boolean)
  return { participants: list(data.participants), agenda: data.agenda || '', pre_read: data.pre_read || '', summary: data.summary || '', decisions: list(data.decisions), action_items: (Array.isArray(data.actions) ? data.actions : list(data.actions).map(text => ({ text, task_id: null }))), waiting_items: list(data.waiting_items || data.waiting), next_meeting_at: data.next_meeting_at || null }
}

export function buildPlan(bundle, userId) {
  if (bundle.version !== 1 || !bundle.memory || !Array.isArray(bundle.memory.tasks) || !Array.isArray(bundle.memory.projects)) throw new Error('Not a valid NOVA version 1 local snapshot/bundle.')
  if (!uuidPattern.test(userId)) throw new Error('Target user ID must be a UUID.')
  const memory = bundle.memory, v11 = memory.v11 || {}
  const plan = Object.fromEntries(Object.keys(columns).map(table => [table, []]))
  function add(table, data) {
    const row = { user_id: userId }
    for (const field of columns[table]) {
      if (data[field] === undefined) continue
      let value = data[field]
      if ((field.endsWith('_date') || ['review_at','started_at','completed_at','last_reviewed_at','last_contact_at','next_contact_at','important_date','next_meeting_at'].includes(field)) && value === '') value = null
      if ((field === 'id' || field.endsWith('_id')) && value !== null && !uuidPattern.test(value)) throw new Error(`Invalid UUID in ${table}.${field}`)
      row[field] = value
    }
    const key = columns[table][0]
    if (!row[key]) throw new Error(`Missing ${table}.${key}`)
    if (plan[table].some(existing => existing[key] === row[key])) throw new Error(`Duplicate ${table}.${key}`)
    plan[table].push(row)
  }
  const areas = v11.areas || []
  areas.forEach(row => add('areas', row))
  const areaFor = name => areas.find(area => area.name === name)?.id || null
  for (const row of memory.projects) {
    const related = memory.tasks.find(task => task.project_id === row.id && task.category)
    const meta = v11.project_meta?.[row.id] || {}
    add('projects', { ...row, ...meta, area_id: row.area_id || meta.area_id || areaFor(related?.category || 'کار و پروژه'), outcome: row.outcome || meta.outcome || row.description || '', lifecycle_status: row.lifecycle_status || meta.lifecycle_status || (row.status === 'done' ? 'archived' : row.status === 'paused' ? 'incubating' : 'active') })
  }
  for (const row of memory.events || []) {
    add('planner_events', { ...row, area_id: row.area_id || plan.projects.find(project => project.id === row.project_id)?.area_id || null })
    if (row.type === 'meeting') add('meeting_details', { event_id: row.id, ...meeting(row.notes || '') })
  }
  for (const row of memory.tasks) {
    const meta = memory.execution?.task_meta?.[row.id] || {}
    add('tasks', { ...row, area_id: row.area_id || areaFor(row.category), context: row.context || meta.context || '', energy: row.energy || meta.energy || '', waiting_on: row.waiting_on || meta.waiting_on || '', resume_note: row.resume_note || meta.resume_note || '', source_meeting_id: row.source_meeting_id || meta.source_meeting_id || null })
  }
  ;(memory.activity || []).forEach(row => add('activity', row))
  ;(memory.goals || []).forEach(row => add('outcomes', { ...row, area_id: row.area_id || areaFor(row.area) }))
  const spiritual = [...(v11.spiritual_routines || [])]
  for (const item of memory.modules?.spiritual || []) if (!spiritual.some(row => row.id === item.id)) spiritual.push({ ...item, routine_type: 'spiritual', description: item.note || '', target_weekly: 7, status: 'active', area_id: areaFor('معنوی'), logs: {} })
  const routines = [...(memory.habits || []).map(row => ({ ...row, routine_type: 'general', area_id: row.area_id || areaFor('شخصی') })), ...spiritual]
  for (const row of routines) {
    add('routines', row)
    const logs = { ...(row.logs || {}) }
    for (const date of row.completed_dates || row.checkins || []) logs[date] = true
    for (const [date, value] of Object.entries(logs)) add('routine_logs', { id: stableId(`routine:${row.id}:${date}`), routine_id: row.id, log_date: date, value: Boolean(value) })
  }
  const resources = [...(v11.resources || [])]
  for (const idea of memory.ideas || []) if (!resources.some(row => row.id === idea.id)) resources.push({ ...idea, area_id: idea.area_id || areaFor(idea.area), resource_type: 'idea', status: idea.status === 'archived' ? 'archived' : 'backlog', note: idea.note || idea.description || '' })
  resources.forEach(row => add('resources', row))
  ;(v11.links || []).forEach(row => add('entity_links', row))
  ;(v11.health_metrics || []).forEach(row => add('health_metric_definitions', row))
  ;(v11.health_logs || []).forEach(row => add('health_metric_logs', row))
  ;(v11.people || []).forEach(row => add('people', row))
  ;(v11.relationship_commitments || []).forEach(row => add('relationship_commitments', row))
  for (const [routine_id, details] of Object.entries(v11.spiritual_details || {})) add('spiritual_routine_details', { ...details, routine_id })
  for (const [event_id, details] of Object.entries(v11.religious_details || {})) add('religious_event_details', { ...details, event_id })
  const foreignKeys = {
    projects: { area_id: 'areas' }, planner_events: { project_id: 'projects', area_id: 'areas' },
    tasks: { project_id: 'projects', area_id: 'areas', source_meeting_id: 'planner_events' },
    outcomes: { area_id: 'areas' }, routines: { area_id: 'areas' }, routine_logs: { routine_id: 'routines' },
    resources: { area_id: 'areas' }, meeting_details: { event_id: 'planner_events', area_id: 'areas' },
    health_metric_logs: { metric_id: 'health_metric_definitions' },
    relationship_commitments: { person_id: 'people', task_id: 'tasks', meeting_event_id: 'planner_events' },
    spiritual_routine_details: { routine_id: 'routines' }, religious_event_details: { event_id: 'planner_events' }
  }
  for (const [table, fields] of Object.entries(foreignKeys)) for (const row of plan[table]) for (const [field, target] of Object.entries(fields)) {
    if (row[field] && !plan[target].some(parent => parent.id === row[field])) throw new Error(`Dangling reference: ${table}.${field} -> ${target}`)
  }
  const entityTables = { task: 'tasks', project: 'projects', event: 'planner_events', meeting: 'planner_events', area: 'areas', outcome: 'outcomes', goal: 'outcomes', routine: 'routines', resource: 'resources', person: 'people' }
  for (const link of plan.entity_links) for (const side of ['source', 'target']) {
    const table = entityTables[link[side + '_type']]
    if (!table || !plan[table].some(row => row.id === link[side + '_id'])) throw new Error(`Dangling/unknown entity link ${side}`)
  }
  const life = Object.fromEntries(lifeKeys.filter(key => memory[key] !== undefined).map(key => [key, memory[key]]))
  return { tables: plan, life, settings: memory.settings || {}, counts: Object.fromEntries(Object.entries(plan).map(([table, rows]) => [table, rows.length])) }
}

export function bundleFingerprint(bundle) {
  return crypto.createHash('sha256').update(JSON.stringify({ memory: bundle.memory, bank: bundle.bank || null, browserEdits: bundle.browserEdits || null })).digest('hex')
}

export function hasPersonalData(value) {
  if (Array.isArray(value)) return value.length > 0
  if (!value || typeof value !== 'object') return false
  for (const key of ['goals','habits','weekly_plan','daily_logs','ideas']) if (value[key]?.length) return true
  if (Object.values(value.modules || {}).some(rows => rows.length)) return true
  if (Object.values(value.finance || {}).some(rows => Array.isArray(rows) && rows.length)) return true
  const execution = value.execution || {}
  return Boolean(Object.keys(execution.task_meta || {}).length || execution.focus_sessions?.length || execution.current_focus || execution.planning?.current_cycle || execution.planning?.reviews?.length || execution.personalization?.saved_views?.length)
}
