import Fastify from 'fastify'
import cors from '@fastify/cors'
import postgres from '@fastify/postgres'
import fastifyStatic from '@fastify/static'
import dotenv from 'dotenv'
import crypto from 'node:crypto'
import { promisify } from 'node:util'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import OpenAI from 'openai'
import { createLocalStore } from './local-store.js'
import { registerCalendar, normalizeCalendarState } from './calendar.js'

dotenv.config()

const app = Fastify({ logger: true })
app.setErrorHandler((error, request, reply) => {
  if (error.validation) {
    return reply.code(400).send({ error: 'ورودی نامعتبر است.', details: error.validation.map((item) => ({ field: item.instancePath || item.params?.missingProperty || item.params?.additionalProperty || '', message: item.message })) })
  }
  request.log.error(error)
  return reply.code(error.statusCode && error.statusCode < 500 ? error.statusCode : 500).send({ error: error.statusCode && error.statusCode < 500 ? error.message : 'خطای داخلی سرور.' })
})
const PORT = Number(process.env.PORT || 3001)
const RELEASE_VERSION = 'V1.1'
const RELEASE_STAGE = 16
const RELEASE_NAME = 'mllibden 1.1'
let hasDatabase = Boolean(process.env.DATABASE_URL)
let openaiClient
const scrypt = promisify(crypto.scrypt)
const deployedRuntime=process.env.NODE_ENV==='production'||Boolean(process.env.VERCEL)
if (deployedRuntime && !process.env.AUTH_SECRET) {
  throw new Error('AUTH_SECRET must be set in production.')
}
if(deployedRuntime&&!process.env.DATABASE_URL)throw new Error('DATABASE_URL must be set for persistent production storage.')
const authSecret = process.env.AUTH_SECRET || crypto.randomBytes(32).toString('hex')
const currentDir = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.join(currentDir, '..', 'dist')
const clientIndex = path.join(distDir, 'index.html')
const localStore = !process.env.VERCEL && process.env.NODE_ENV !== 'production' && process.env.NOVA_LOCAL_STORE !== 'off'
  ? createLocalStore(process.env.NOVA_LOCAL_STORE || path.join(currentDir, '..', '.local', `memory-${PORT}.json`))
  : null

const defaultSettings = {
  display_name: 'molibden',
  workspace_name: 'NOVA',
  theme: 'light',
  page_titles: {}
}

function signToken(payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = crypto.createHmac('sha256', authSecret).update(encoded).digest('base64url')
  return `${encoded}.${signature}`
}

function verifyToken(token) {
  const [encoded, signature] = String(token || '').split('.')
  if (!encoded || !signature) return null
  const expected = crypto.createHmac('sha256', authSecret).update(encoded).digest('base64url')
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'))
    return payload.exp > Date.now() ? payload : null
  } catch { return null }
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = await scrypt(password, salt, 64)
  return `${salt}:${Buffer.from(hash).toString('hex')}`
}

async function verifyPassword(password, storedHash) {
  const [salt, hash] = String(storedHash || '').split(':')
  if (!salt || !hash) return false
  const derived = Buffer.from(await scrypt(password, salt, 64)).toString('hex')
  return derived.length === hash.length && crypto.timingSafeEqual(Buffer.from(derived), Buffer.from(hash))
}

function publicUser(user) {
  return { id: user.id, email: user.email, display_name: user.display_name }
}

function issueSession(user) {
  return {
    token: signToken({ sub: user.id, exp: Date.now() + 30 * 24 * 60 * 60 * 1000 }),
    user: publicUser(user)
  }
}

await app.register(cors, {
  origin: process.env.CLIENT_ORIGIN ? [process.env.CLIENT_ORIGIN] : true
})

if (hasDatabase) {
  await app.register(postgres, { connectionString: process.env.DATABASE_URL })
}

if (!process.env.VERCEL && fs.existsSync(distDir)) {
  await app.register(fastifyStatic, { root: distDir, prefix: '/', wildcard: false })
}

app.setNotFoundHandler((request, reply) => {
  if (request.method === 'GET' && fs.existsSync(clientIndex) && !request.url.startsWith('/api/')) {
    return reply.type('text/html').send(fs.createReadStream(clientIndex))
  }
  return reply.code(404).send({ error: 'مسیر پیدا نشد.' })
})

const publicApiPaths = new Set(['/api/health', '/api/release', '/api/auth/register', '/api/auth/login'])
app.addHook('preHandler', async (request, reply) => {
  if (!request.url.startsWith('/api/') || publicApiPaths.has(request.url.split('?')[0])) return
  // Local demo mode: keep the original project usable without PostgreSQL.
  // All requests share one local workspace; production still requires authenticated PostgreSQL users.
  if (!hasDatabase) {
    request.user = { id: 'local-demo', email: 'local@nova.test', display_name: memory?.settings?.display_name || 'کاربر محلی NOVA' }
    return
  }
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, '')
  const payload = verifyToken(token)
  if (!payload?.sub) return reply.code(401).send({ error: 'لطفاً وارد حساب کاربری خود شوید.' })
  const { rows } = await app.pg.query('SELECT id, email, display_name FROM users WHERE id = $1', [payload.sub])
  if (!rows[0]) return reply.code(401).send({ error: 'نشست کاربری معتبر نیست.' })
  request.user = rows[0]
})

app.post('/api/auth/register', async (request, reply) => {
  if (!hasDatabase) return reply.code(503).send({ error: 'برای ساخت حساب، PostgreSQL را در محیط اجرا فعال کنید.' })
  const email = String(request.body?.email || '').trim().toLowerCase()
  const displayName = String(request.body?.display_name || '').trim()
  const password = String(request.body?.password || '')
  if (!/^\S+@\S+\.\S+$/.test(email)) return reply.code(400).send({ error: 'ایمیل معتبر وارد کنید.' })
  if (displayName.length < 2 || displayName.length > 80) return reply.code(400).send({ error: 'نام باید بین ۲ تا ۸۰ کاراکتر باشد.' })
  if (password.length < 8) return reply.code(400).send({ error: 'رمز عبور باید حداقل ۸ کاراکتر باشد.' })
  const user = { id: id(), email, display_name: displayName, password_hash: await hashPassword(password) }
  try {
    await app.pg.transact(async (client) => {
      await client.query('INSERT INTO users (id, email, display_name, password_hash) VALUES ($1, $2, $3, $4)', [user.id, user.email, user.display_name, user.password_hash])
      await client.query('INSERT INTO user_settings (user_id, data) VALUES ($1, $2::jsonb)', [user.id, JSON.stringify({ ...defaultSettings, display_name: displayName })])
      await client.query('INSERT INTO user_life_data (user_id, data) VALUES ($1, $2::jsonb)', [user.id, JSON.stringify(normalizeLifeData())])
    })
    return reply.code(201).send(issueSession(user))
  } catch (error) {
    if (error.code === '23505') return reply.code(409).send({ error: 'این ایمیل قبلاً ثبت شده است.' })
    throw error
  }
})

app.post('/api/auth/login', async (request, reply) => {
  if (!hasDatabase) return reply.code(503).send({ error: 'برای ورود، PostgreSQL را در محیط اجرا فعال کنید.' })
  const email = String(request.body?.email || '').trim().toLowerCase()
  const password = String(request.body?.password || '')
  const { rows } = await app.pg.query('SELECT id, email, display_name, password_hash FROM users WHERE email = $1', [email])
  if (!rows[0] || !(await verifyPassword(password, rows[0].password_hash))) return reply.code(401).send({ error: 'ایمیل یا رمز عبور نادرست است.' })
  return issueSession(rows[0])
})

app.get('/api/auth/me', async (request) => ({ user: publicUser(request.user) }))

const memory = {
  tasks: [],
  projects: [],
  activity: [],
  events: [],
  goals: [],
  habits: [],
  weekly_plan: [],
  daily_logs: [],
  ideas: [],
  finance: {
    accounts: [],
    transactions: [],
    debts: [],
    budgets: [],
    commitments: []
  },
  modules: {
    spiritual: [],
    religious: [],
    health: [],
    learning: [],
    relations: [],
    review: []
  },
  execution: { task_meta: {}, focus_sessions: [], current_focus: null },
  v11: { areas: [], resources: [], links: [], project_meta: {}, people: [], relationship_commitments: [], relationship_seeded: false },
  settings: {
    display_name: 'molibden',
    workspace_name: 'NOVA',
    theme: 'light',
    page_titles: {
      dashboard: 'نمای کلی',
      today: 'امروز',
      tasks: 'تسک‌ها',
      projects: 'پروژه‌ها',
      calendar: 'تقویم تمرکز',
      analytics: 'تحلیل عملکرد',
      settings: 'تنظیمات'
    }
  }
}

const today = () => new Date().toISOString().slice(0, 10)
const addDays = (days) => {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}
const dateOffset = (days) => addDays(days)
const id = () => crypto.randomUUID()
// Persist before sending responses, including lazy initialization during reads.
app.addHook('onSend', async () => {
  if (!hasDatabase) localStore?.save(memory)
})
const priorityLabels = { high: 'بالا', medium: 'متوسط', low: 'کم' }

function seedMemory() {
  if (memory.tasks.length || memory.projects.length) return
  const projectIds = {
    site: id(),
    health: id(),
    learning: id()
  }
  memory.projects.push(
    { id: projectIds.site, name: 'رسیدگی به کارهای شخصی', description: 'مرتب‌کردن کارهای عقب‌افتاده و برنامه‌های این ماه.', due_date: addDays(18), color: '#7165f3', icon: '⌘', status: 'in_progress', created_at: new Date().toISOString() },
    { id: projectIds.health, name: 'ریتم سالم صبحگاهی', description: 'ساختن صبح‌هایی که انرژی روز را تنظیم می‌کنند.', due_date: addDays(11), color: '#45b98c', icon: '☼', status: 'in_progress', created_at: new Date().toISOString() },
    { id: projectIds.learning, name: 'یادگیری زبان اسپانیایی', description: '۲۰ دقیقه تمرین پیوسته، بدون فشار اضافه.', due_date: addDays(32), color: '#e8996b', icon: '✦', status: 'in_progress', created_at: new Date().toISOString() }
  )
  memory.tasks.push(
    { id: id(), title: 'مرور هدف‌های فصل پاییز', description: 'سه نتیجه مهم فصل را روی کاغذ بیاور.', due_date: today(), priority: 'high', status: 'in_progress', estimate_minutes: 25, project_id: projectIds.site, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: id(), title: 'هماهنگی زمان یک قرار', description: 'یک زمان مناسب برای قرار پیدا کن و با طرف مقابل هماهنگ کن.', due_date: today(), priority: 'medium', status: 'todo', estimate_minutes: 35, project_id: projectIds.site, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: id(), title: 'پیاده‌روی عصرگاهی', description: 'سی دقیقه بدون هدفون، فقط برای خالی‌کردن ذهن.', due_date: today(), priority: 'low', status: 'todo', estimate_minutes: 30, project_id: projectIds.health, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: id(), title: 'تمرین درس ۴ اسپانیایی', description: 'مرور واژه‌ها و ساخت پنج جمله جدید.', due_date: addDays(1), priority: 'medium', status: 'todo', estimate_minutes: 20, project_id: projectIds.learning, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: id(), title: 'مرتب‌کردن مدارک شخصی', description: 'مدارک مهم را دسته‌بندی و در جای مشخص نگهداری کن.', due_date: addDays(-1), priority: 'high', status: 'done', estimate_minutes: 50, project_id: projectIds.site, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: id(), title: 'خرید میوه و سبزی', description: 'برای آماده‌سازی میان‌وعده‌های هفته.', due_date: addDays(2), priority: 'low', status: 'todo', estimate_minutes: 25, project_id: projectIds.health, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
  )
  const seededTasks = memory.tasks
  if (seededTasks[0]) memory.execution.task_meta[seededTasks[0].id] = { context: 'فکر عمیق', energy: 'high', waiting_on: '', resume_note: 'مرور سه نتیجه فصل و انتخاب یکی برای تبدیل به اقدام هفتگی.', blocked_on: '', updated_at: new Date().toISOString() }
  if (seededTasks[1]) memory.execution.task_meta[seededTasks[1].id] = { context: 'کامپیوتر', energy: 'medium', waiting_on: 'بازخورد سارا', resume_note: '', blocked_on: '', updated_at: new Date().toISOString() }
  if (seededTasks[2]) memory.execution.task_meta[seededTasks[2].id] = { context: 'بیرون', energy: 'low', waiting_on: '', resume_note: '', blocked_on: '', updated_at: new Date().toISOString() }

  memory.activity.push(
    { id: id(), kind: 'done', text: 'تسک «مرتب‌کردن مدارک شخصی» انجام شد.', created_at: new Date(Date.now() - 1000 * 60 * 42).toISOString() },
    { id: id(), kind: 'project', text: 'پروژه «ریتم سالم صبحگاهی» ساخته شد.', created_at: new Date(Date.now() - 1000 * 60 * 160).toISOString() },
    { id: id(), kind: 'assistant', text: 'همراه NOVA یک برنامه سبک پیشنهاد داد.', created_at: new Date(Date.now() - 1000 * 60 * 300).toISOString() }
  )
  memory.events.push(
    { id: id(), title: 'بلوک تمرکز عمیق', type: 'focus', start_at: `${today()}T10:30:00`, end_at: `${today()}T12:00:00`, color: '#7165f3', project_id: projectIds.site, notes: 'اعلان‌ها خاموش', created_at: new Date().toISOString() },
    { id: id(), title: 'مرور هفتگی', type: 'review', start_at: `${today()}T16:00:00`, end_at: `${today()}T16:30:00`, color: '#e8996b', project_id: null, notes: 'سه برد و یک اصلاح کوچک', created_at: new Date().toISOString() },
    { id: id(), title: 'پیاده‌روی عصرگاهی', type: 'health', start_at: `${today()}T18:30:00`, end_at: `${today()}T19:00:00`, color: '#45b98c', project_id: projectIds.health, notes: '', created_at: new Date().toISOString() },
    { id: id(), title: 'جلسه هماهنگی هفتگی', type: 'meeting', start_at: `${today()}T14:00:00`, end_at: `${today()}T14:45:00`, color: '#8f4268', project_id: null, notes: 'NOVA_MEETING::{"unit":"داخلی","participants":"تیم اصلی","agenda":"مرور وضعیت پروژه‌ها و تعیین اولویت هفته","summary":"مرور کارهای هفته و تصمیم درباره اولویت‌های بعدی","decisions":"تمرکز هفته روی تحویل نسخه اولیه سایت باشد.","actions":[{"id":"seed-action-1","text":"هماهنگی زمان یک قرار","task_id":null},{"id":"seed-action-2","text":"جمع‌بندی تصمیم‌های جلسه در پروژه","task_id":null}],"notes":"اقدام‌های بعدی ثبت و پیگیری شوند."}', created_at: new Date().toISOString() }
  )
  memory.goals.push(
    { id: id(), area: 'سلامت', title: 'سه جلسه حرکت در هفته', target: 3, current: 2, unit: 'جلسه', due_date: addDays(45), status: 'in_progress', priority: 'high', next_action: 'رزرو زمان سه‌شنبه', note: 'هدف کوچک، پایدار و قابل اندازه‌گیری.' },
    { id: id(), area: 'یادگیری', title: 'تمام‌کردن دوره مدیریت تمرکز', target: 12, current: 7, unit: 'فصل', due_date: addDays(62), status: 'in_progress', priority: 'medium', next_action: 'مطالعه فصل هشتم', note: '' },
    { id: id(), area: 'مالی', title: 'ساخت صندوق آرامش', target: 300000000, current: 120000000, unit: 'تومان', due_date: addDays(180), status: 'in_progress', priority: 'high', next_action: 'انتقال ماهانه', note: '' }
  )
  memory.habits.push(
    { id: id(), title: 'خواب قبل از ۲۳:۰۰', target: 6, color: '#7165f3', logs: { [dateOffset(-6)]: true, [dateOffset(-4)]: true, [dateOffset(-3)]: true, [dateOffset(-1)]: true } },
    { id: id(), title: 'نوشیدن آب کافی', target: 7, color: '#45b98c', logs: { [dateOffset(-6)]: true, [dateOffset(-5)]: true, [dateOffset(-3)]: true, [dateOffset(-2)]: true, [dateOffset(-1)]: true } },
    { id: id(), title: 'مطالعه عمیق', target: 5, color: '#e8996b', logs: { [dateOffset(-6)]: true, [dateOffset(-4)]: true, [dateOffset(-2)]: true } },
    { id: id(), title: 'پیاده‌روی یا ورزش', target: 3, color: '#5fa8ff', logs: { [dateOffset(-5)]: true, [dateOffset(-2)]: true } }
  )
  const weekDays = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه']
  memory.weekly_plan.push(
    { id: id(), day: weekDays[new Date().getDay() % 7], date: today(), start: '08:30', end: '09:00', title: 'مرور روز و انتخاب سه اولویت', category: 'برنامه‌ریزی', status: 'planned', color: '#7165f3' },
    { id: id(), day: weekDays[new Date().getDay() % 7], date: today(), start: '10:30', end: '12:00', title: 'بلوک تمرکز عمیق', category: 'کار', status: 'planned', color: '#5fa8ff' },
    { id: id(), day: weekDays[new Date().getDay() % 7], date: today(), start: '18:30', end: '19:00', title: 'پیاده‌روی عصرگاهی', category: 'سلامت', status: 'planned', color: '#45b98c' }
  )
  memory.daily_logs.push(
    { id: id(), date: today(), top_task: 'مرور هدف‌های فصل', energy: 8, mood: 'متمرکز', note: 'صبح امروز تمرکز خوبی داشتم.' },
    { id: id(), date: addDays(-1), top_task: 'مرتب‌کردن مدارک شخصی', energy: 7, mood: 'خوب', note: 'یک قدم کوچک اما واقعی.' }
  )
  memory.ideas.push(
    { id: id(), title: 'خبرنامه هفتگی تمرکز', area: 'محتوا', impact: 'بالا', status: 'idea', next_action: 'نمونه‌سازی قالب', note: '' },
    { id: id(), title: 'کارگاه مدیریت زمان برای دوستان', area: 'یادگیری', impact: 'متوسط', status: 'reviewing', next_action: 'مصاحبه با سه نفر', note: '' }
  )
  memory.finance.accounts.push(
    { id: id(), name: 'حساب اصلی', masked: '**** 1234', balance: 82000000, status: 'active', note: 'حساب روزمره' },
    { id: id(), name: 'پس‌انداز', masked: '**** 9012', balance: 120000000, status: 'active', note: 'صندوق آرامش' },
    { id: id(), name: 'کیف نقدی', masked: '—', balance: 2500000, status: 'active', note: 'هزینه‌های کوچک' }
  )
  memory.finance.transactions.push(
    { id: id(), date: today(), type: 'income', amount: 95000000, category: 'درآمد', description: 'حقوق ماهانه', account: 'حساب اصلی', status: 'confirmed' },
    { id: id(), date: addDays(-1), type: 'expense', amount: 12000000, category: 'مسکن', description: 'اجاره', account: 'حساب اصلی', status: 'confirmed' },
    { id: id(), date: addDays(-2), type: 'expense', amount: 3500000, category: 'خوراک', description: 'خرید هفتگی', account: 'کیف نقدی', status: 'confirmed' },
    { id: id(), date: addDays(-3), type: 'expense', amount: 2500000, category: 'یادگیری', description: 'کتاب', account: 'حساب اصلی', status: 'pending' }
  )
  memory.finance.debts.push(
    { id: id(), title: 'وام مسکن', creditor: 'بانک', amount: 1850000000, installment: 45000000, next_due: addDays(28), status: 'active' },
    { id: id(), title: 'قرض دوستانه', creditor: 'دوست', amount: 30000000, installment: 5000000, next_due: addDays(12), status: 'active' }
  )
  memory.finance.budgets.push(
    { id: id(), name: 'خوراک', category: 'خوراک', period: today().slice(0,7), limit_amount: 18000000, note: 'بودجه ماه جاری' },
    { id: id(), name: 'یادگیری', category: 'یادگیری', period: today().slice(0,7), limit_amount: 8000000, note: 'کتاب و دوره' },
    { id: id(), name: 'تفریح', category: 'تفریح', period: today().slice(0,7), limit_amount: 6000000, note: '' }
  )
  memory.finance.commitments.push(
    { id: id(), title: 'قسط وام', amount: 45000000, due_date: addDays(6), direction: 'pay', status: 'open', category: 'بدهی', account: 'حساب اصلی', note: 'پرداخت ماهانه', task_id: null, event_id: null },
    { id: id(), title: 'دریافت فاکتور پروژه', amount: 28000000, due_date: addDays(10), direction: 'receive', status: 'open', category: 'درآمد', account: 'حساب اصلی', note: 'پیگیری وصول', task_id: null, event_id: null }
  )
}

  if (!memory.modules.spiritual.length) {
    memory.modules.spiritual.push(
      { id: id(), title: 'نماز اول وقت', done: true, state: 'انجام', priority: 'high', created_at: new Date().toISOString() },
      { id: id(), title: 'تلاوت / مطالعه معنوی', done: true, state: 'انجام', priority: 'medium', created_at: new Date().toISOString() },
      { id: id(), title: 'ذکر و مراقبه', done: false, state: 'باز', priority: 'medium', created_at: new Date().toISOString() },
      { id: id(), title: 'شکرگزاری', done: true, state: 'انجام', priority: 'medium', created_at: new Date().toISOString() },
      { id: id(), title: 'خلوت و محاسبه نفس', done: false, state: 'شب', priority: 'low', created_at: new Date().toISOString() }
    )
    memory.modules.religious.push(
      { id: id(), title: 'مرور برنامه مناسبت بعدی', done: true, state: 'انجام', priority: 'medium', created_at: new Date().toISOString() },
      { id: id(), title: 'آماده‌سازی مطالعه / محتوا', done: false, state: 'باز', priority: 'medium', created_at: new Date().toISOString() },
      { id: id(), title: 'تنظیم یادآور و زمان‌بندی', done: false, state: 'برنامه', priority: 'low', created_at: new Date().toISOString() }
    )
    memory.modules.health.push(
      { id: id(), title: 'پیاده‌روی روزانه', done: true, state: 'انجام', priority: 'medium', created_at: new Date().toISOString() },
      { id: id(), title: '۷.۵ ساعت خواب', done: false, state: 'کمتر از هدف', priority: 'high', created_at: new Date().toISOString() },
      { id: id(), title: 'مصرف آب کافی', done: true, state: 'خوب', priority: 'medium', created_at: new Date().toISOString() },
      { id: id(), title: 'تمرین کششی', done: false, state: 'باز', priority: 'low', created_at: new Date().toISOString() }
    )
    memory.modules.learning.push(
      { id: id(), title: 'مطالعه کتاب جاری', done: true, state: 'انجام', priority: 'medium', created_at: new Date().toISOString() },
      { id: id(), title: 'دوره تخصصی تحلیل داده', done: true, state: 'پیشرفت', priority: 'high', created_at: new Date().toISOString() },
      { id: id(), title: 'مرور یادداشت‌های آموزشی', done: false, state: 'باز', priority: 'medium', created_at: new Date().toISOString() }
    )
    memory.modules.relations.push(
      { id: id(), title: 'تماس با خانواده', done: true, state: 'انجام', priority: 'high', created_at: new Date().toISOString() },
      { id: id(), title: 'پیگیری دوست قدیمی', done: false, state: 'باز', priority: 'low', created_at: new Date().toISOString() },
      { id: id(), title: 'جلسه شبکه‌سازی', done: false, state: 'برنامه', priority: 'medium', created_at: new Date().toISOString() }
    )
    memory.modules.review.push(
      { id: id(), title: 'مرور هفتگی کامل', done: false, state: 'عقب‌افتاده', priority: 'high', created_at: new Date().toISOString() },
      { id: id(), title: 'جمع‌بندی تصمیمات باز', done: false, state: 'باز', priority: 'high', created_at: new Date().toISOString() },
      { id: id(), title: 'مرور اهداف ماه', done: true, state: 'انجام', priority: 'medium', created_at: new Date().toISOString() }
    )
  }

async function initDatabase() {
  if (!hasDatabase) {
    const saved = localStore?.load()
    if (saved) Object.assign(memory, saved)
    else seedMemory()
    localStore?.save(memory)
    return
  }
  try {
    await app.pg.query('SELECT 1')
  } catch (error) {
    if(deployedRuntime)throw new Error('PostgreSQL connection failed; refusing temporary production storage.',{cause:error})
    app.log.warn({ err: error }, 'PostgreSQL unavailable; using memory fallback')
    hasDatabase = false
    const saved = localStore?.load()
    if (saved) Object.assign(memory, saved)
    else seedMemory()
    localStore?.save(memory)
    return
  }
  await app.pg.query(fs.readFileSync(path.join(currentDir, 'schema.sql'), 'utf8'))
  if(deployedRuntime)return
  const { rows } = await app.pg.query('SELECT COUNT(*)::int AS count FROM tasks')
  if (!rows[0].count) {
    // Keep the first-run experience useful even with a fresh PostgreSQL database.
    seedMemory()
    await app.pg.query('BEGIN')
    try {
      for (const project of memory.projects) {
        await app.pg.query('INSERT INTO projects (id, name, description, due_date, color, icon, status, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', [project.id, project.name, project.description, project.due_date, project.color, project.icon, project.status, project.created_at])
      }
      for (const task of memory.tasks) {
        await app.pg.query('INSERT INTO tasks (id, title, description, due_date, priority, status, estimate_minutes, category, tags, project_id, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12)', [task.id, task.title, task.description, task.due_date, task.priority, task.status, task.estimate_minutes, task.category || 'شخصی', JSON.stringify(task.tags || []), task.project_id, task.created_at, task.updated_at])
      }
      for (const activityItem of memory.activity) {
        await app.pg.query('INSERT INTO activity (id, kind, text, created_at) VALUES ($1,$2,$3,$4)', [activityItem.id, activityItem.kind, activityItem.text, activityItem.created_at])
      }
      for (const event of memory.events) {
        await app.pg.query('INSERT INTO planner_events (id, title, type, start_at, end_at, color, project_id, notes, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)', [event.id, event.title, event.type, event.start_at, event.end_at, event.color, event.project_id, event.notes, event.created_at])
      }
      await app.pg.query('INSERT INTO planner_settings (id, data) VALUES (1, $1::jsonb) ON CONFLICT (id) DO NOTHING', [JSON.stringify(memory.settings)])
      await app.pg.query('INSERT INTO life_data (id, data) VALUES (1, $1::jsonb) ON CONFLICT (id) DO NOTHING', [JSON.stringify({
        goals: memory.goals,
        habits: memory.habits,
        weekly_plan: memory.weekly_plan,
        daily_logs: memory.daily_logs,
        ideas: memory.ideas,
        finance: memory.finance,
        modules: memory.modules
      })])
      await app.pg.query('COMMIT')
    } catch (error) {
      await app.pg.query('ROLLBACK')
      throw error
    } finally {
      memory.tasks = []
      memory.projects = []
      memory.activity = []
      memory.events = []
    }
  }
  const settings = await app.pg.query('SELECT data FROM planner_settings WHERE id = 1')
  if (!settings.rows[0]) {
    await app.pg.query('INSERT INTO planner_settings (id, data) VALUES (1, $1::jsonb)', [JSON.stringify(memory.settings)])
  }
  const lifeData = await app.pg.query('SELECT data FROM life_data WHERE id = 1')
  if (lifeData.rows[0]?.data) {
    Object.assign(memory, lifeData.rows[0].data)
  } else {
    seedMemory()
    await app.pg.query('INSERT INTO life_data (id, data) VALUES (1, $1::jsonb)', [JSON.stringify({
      goals: memory.goals,
      habits: memory.habits,
      weekly_plan: memory.weekly_plan,
      daily_logs: memory.daily_logs,
      ideas: memory.ideas,
      finance: memory.finance
    })])
  }
}

async function listTasks(userId) {
  if (!hasDatabase) return [...memory.tasks].sort(sortTasks)
  const { rows } = await app.pg.query('SELECT * FROM tasks WHERE user_id = $1 ORDER BY due_date NULLS LAST, CASE priority WHEN \'high\' THEN 1 WHEN \'medium\' THEN 2 ELSE 3 END, created_at DESC', [userId])
  return rows
}
async function listProjects(userId) {
  if (!hasDatabase) return enrichProjects(memory.projects, memory.tasks)
  const { rows } = await app.pg.query(`
    SELECT p.*, COUNT(t.id)::int AS task_count,
      COALESCE(ROUND(AVG(CASE WHEN t.status = 'done' THEN 100 ELSE 0 END)), 0)::int AS progress
    FROM projects p LEFT JOIN tasks t ON t.project_id = p.id AND t.user_id = $1
    WHERE p.user_id = $1 GROUP BY p.id ORDER BY p.created_at DESC
  `, [userId])
  return rows
}
function sortTasks(a, b) {
  const dateA = a.due_date || '9999-12-31'
  const dateB = b.due_date || '9999-12-31'
  if (dateA !== dateB) return dateA.localeCompare(dateB)
  const rank = { high: 1, medium: 2, low: 3 }
  return (rank[a.priority] || 4) - (rank[b.priority] || 4)
}
function enrichProjects(projects, tasks) {
  return projects.map((project) => {
    const related = tasks.filter((task) => task.project_id === project.id)
    const done = related.filter((task) => task.status === 'done').length
    return { ...project, task_count: related.length, progress: related.length ? Math.round((done / related.length) * 100) : 0 }
  })
}
async function listActivity(userId) {
  if (!hasDatabase) return [...memory.activity].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  const { rows } = await app.pg.query('SELECT * FROM activity WHERE user_id = $1 ORDER BY created_at DESC LIMIT 12', [userId])
  return rows
}
async function listEvents(userId, from, to) {
  if (!hasDatabase) {
    return [...memory.events]
      .filter((event) => (!from || event.start_at.slice(0, 10) >= from) && (!to || event.start_at.slice(0, 10) <= to))
      .sort((a, b) => new Date(a.start_at) - new Date(b.start_at))
  }
  const params = [userId]
  const where = ['user_id = $1']
  if (from) { params.push(from); where.push(`start_at >= $${params.length}::date`) }
  if (to) { params.push(to); where.push(`start_at < ($${params.length}::date + INTERVAL '1 day')`) }
  const query = `SELECT * FROM planner_events ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY start_at ASC`
  const { rows } = await app.pg.query(query, params)
  return rows
}
async function listSettings(userId) {
  if (!hasDatabase) return memory.settings
  const { rows } = await app.pg.query('SELECT data FROM user_settings WHERE user_id = $1', [userId])
  return rows[0]?.data || defaultSettings
}
async function updateSettings(userId, payload = {}) {
  const current = await listSettings(userId)
  const next = {
    ...current,
    ...payload,
    page_titles: { ...(current.page_titles || {}), ...(payload.page_titles || {}) }
  }
  if (!hasDatabase) memory.settings = next
  else await app.pg.query('INSERT INTO user_settings (user_id, data, updated_at) VALUES ($1, $2::jsonb, NOW()) ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()', [userId, JSON.stringify(next)])
  await addActivity(userId, 'settings', 'تنظیمات فضای شخصی به‌روزرسانی شد.')
  return next
}
async function addActivity(userId, kind, text) {
  const event = { id: id(), kind, text, created_at: new Date().toISOString() }
  if (!hasDatabase) { memory.activity.unshift(event); return event }
  await app.pg.query('INSERT INTO activity (id, user_id, kind, text, created_at) VALUES ($1,$2,$3,$4,$5)', [event.id, userId, event.kind, event.text, event.created_at])
  return event
}

function lifeDataSnapshot(source = memory) {
  return {
    goals: (source.goals || []).map(normalizeGoal),
    habits: (source.habits || []).map(normalizeHabit),
    weekly_plan: source.weekly_plan || [],
    daily_logs: source.daily_logs || [],
    ideas: source.ideas || [],
    finance: source.finance || { accounts: [], transactions: [], debts: [], budgets: [], commitments: [] },
    modules: source.modules && typeof source.modules === 'object' ? source.modules : { spiritual: [], religious: [], health: [], learning: [], relations: [], review: [] },
    execution: normalizeExecution(source.execution || {})
  }
}

function normalizeGoal(input = {}) {
  const target = Math.max(0, Number(input.target_value ?? input.target ?? 0) || 0)
  const current = Math.max(0, Number(input.current_value ?? input.current ?? 0) || 0)
  const progress = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : Math.min(100, Math.max(0, Number(input.progress_percent ?? input.progress ?? 0) || 0))
  return {
    id: input.id || id(),
    title: String(input.title || '').trim(),
    area: String(input.area || 'عمومی').trim() || 'عمومی',
    current_value: current,
    target_value: target,
    progress_percent: progress,
    unit: String(input.unit || '').trim(),
    status: ['active', 'in_progress', 'done', 'paused'].includes(input.status) ? input.status : (progress >= 100 ? 'done' : 'active'),
    priority: ['high', 'medium', 'low'].includes(input.priority) ? input.priority : 'medium',
    due_date: input.due_date || null,
    next_action: String(input.next_action || '').trim(),
    note: String(input.note || input.notes || '').trim(),
    metric_name: String(input.metric_name || '').trim(),
    baseline_value: Math.max(0, Number(input.baseline_value ?? 0) || 0),
    target_direction: ['increase','decrease','maintain'].includes(input.target_direction) ? input.target_direction : 'increase',
    review_at: input.review_at || null,
    measurement_note: String(input.measurement_note || '').trim(),
    created_at: input.created_at || new Date().toISOString(),
    updated_at: input.updated_at || new Date().toISOString()
  }
}

function normalizeHabit(input = {}) {
  const logs = {}
  if (input.logs && typeof input.logs === 'object' && !Array.isArray(input.logs)) {
    for (const [date, value] of Object.entries(input.logs)) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) logs[date] = Boolean(value)
    }
  }
  for (const date of (Array.isArray(input.completed_dates) ? input.completed_dates : (Array.isArray(input.checkins) ? input.checkins : []))) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) logs[date] = true
  }
  const recentDates = Object.entries(logs).filter(([date, done]) => done && (Date.now() - new Date(`${date}T12:00:00`).getTime()) <= 7 * 86400000)
  const targetWeekly = Math.max(1, Math.min(7, Number(input.target_weekly ?? input.target ?? 1) || 1))
  return {
    id: input.id || id(),
    title: String(input.title || '').trim(),
    description: String(input.description || '').trim(),
    target_weekly: targetWeekly,
    logs,
    adherence_percent: Math.min(100, Math.round((recentDates.length / targetWeekly) * 100)),
    color: /^#[0-9a-f]{6}$/i.test(input.color || '') ? input.color : '#7165f3',
    status: input.status === 'paused' ? 'paused' : 'active',
    created_at: input.created_at || new Date().toISOString(),
    updated_at: input.updated_at || new Date().toISOString()
  }
}


function normalizeExecution(input = {}) {
  const rawMeta = input.task_meta && typeof input.task_meta === 'object' && !Array.isArray(input.task_meta) ? input.task_meta : {}
  const task_meta = Object.fromEntries(Object.entries(rawMeta).map(([taskId, meta]) => [taskId, {
    context: String(meta?.context || '').slice(0, 60),
    energy: ['high','medium','low'].includes(meta?.energy) ? meta.energy : '',
    waiting_on: String(meta?.waiting_on || '').slice(0, 300),
    resume_note: String(meta?.resume_note || '').slice(0, 1000),
    blocked_on: String(meta?.blocked_on || '').slice(0, 300),
    source_meeting_id: meta?.source_meeting_id || null,
    updated_at: meta?.updated_at || new Date().toISOString()
  }]))
  const focus_sessions = (Array.isArray(input.focus_sessions) ? input.focus_sessions : []).slice(-200).map((x) => ({
    id: x.id || id(), task_id: x.task_id || null, started_at: x.started_at || new Date().toISOString(), ended_at: x.ended_at || null,
    planned_minutes: Math.max(0, Number(x.planned_minutes) || 0), elapsed_minutes: Math.max(0, Number(x.elapsed_minutes) || 0),
    summary: String(x.summary || '').slice(0, 1000), resume_note: String(x.resume_note || '').slice(0, 1000), blocked_on: String(x.blocked_on || '').slice(0, 300)
  }))
  const cf = input.current_focus && typeof input.current_focus === 'object' ? input.current_focus : null
  const rawPlanning = input.planning && typeof input.planning === 'object' && !Array.isArray(input.planning) ? input.planning : {}
  const rc = rawPlanning.current_cycle && typeof rawPlanning.current_cycle === 'object' ? rawPlanning.current_cycle : null
  const current_cycle = rc ? {
    id: rc.id || id(), start_date: String(rc.start_date || '').slice(0,10), end_date: String(rc.end_date || '').slice(0,10),
    theme: String(rc.theme || '').slice(0,200), capacity_hours: Math.max(0, Math.min(168, Number(rc.capacity_hours) || 0)),
    wip_limit: Math.max(1, Math.min(20, Number(rc.wip_limit) || 3)), project_ids: Array.isArray(rc.project_ids) ? rc.project_ids.slice(0,20) : [],
    must: Array.isArray(rc.must) ? rc.must.map(String).filter(Boolean).slice(0,30) : [],
    should: Array.isArray(rc.should) ? rc.should.map(String).filter(Boolean).slice(0,30) : [],
    could: Array.isArray(rc.could) ? rc.could.map(String).filter(Boolean).slice(0,30) : [],
    wont: Array.isArray(rc.wont) ? rc.wont.map(String).filter(Boolean).slice(0,30) : [],
    notes: String(rc.notes || '').slice(0,3000), updated_at: rc.updated_at || new Date().toISOString()
  } : null
  const reviews = (Array.isArray(rawPlanning.reviews) ? rawPlanning.reviews : []).slice(-120).map((r) => ({
    id: r.id || id(), type: ['daily','weekly','monthly','seasonal'].includes(r.type) ? r.type : 'weekly',
    date: String(r.date || today()).slice(0,10), wins: String(r.wins || '').slice(0,3000), lessons: String(r.lessons || '').slice(0,3000),
    stop: String(r.stop || '').slice(0,2000), start: String(r.start || '').slice(0,2000), continue: String(r.continue || '').slice(0,2000),
    next_theme: String(r.next_theme || '').slice(0,300), note: String(r.note || '').slice(0,4000), created_at: r.created_at || new Date().toISOString()
  }))
  const rawPersonal = input.personalization && typeof input.personalization === 'object' && !Array.isArray(input.personalization) ? input.personalization : {}
  const rawAttention = rawPersonal.attention && typeof rawPersonal.attention === 'object' ? rawPersonal.attention : {}
  const rawDash = rawPersonal.dashboard && typeof rawPersonal.dashboard === 'object' ? rawPersonal.dashboard : {}
  const saved_views = (Array.isArray(rawPersonal.saved_views) ? rawPersonal.saved_views : []).slice(-40).map((v) => ({
    id: v.id || id(), name: String(v.name || 'نمای ذخیره‌شده').slice(0,120), filters: v.filters && typeof v.filters === 'object' ? v.filters : {}, created_at: v.created_at || new Date().toISOString()
  }))
  const personalization = {
    default_context: String(rawPersonal.default_context || '').slice(0,60),
    default_energy: ['high','medium','low'].includes(rawPersonal.default_energy) ? rawPersonal.default_energy : '',
    default_minutes: [15,30,60,120].includes(Number(rawPersonal.default_minutes)) ? Number(rawPersonal.default_minutes) : 30,
    attention: { stale_project_days: Math.max(1,Math.min(180,Number(rawAttention.stale_project_days)||14)), waiting_days: Math.max(1,Math.min(90,Number(rawAttention.waiting_days)||3)) },
    dashboard: { now: rawDash.now !== false, decision: rawDash.decision !== false, attention: rawDash.attention !== false, projects: rawDash.projects !== false, areas: rawDash.areas !== false, routines: rawDash.routines !== false, review: rawDash.review !== false },
    saved_views
  }
  return { task_meta, focus_sessions, current_focus: cf ? { task_id: cf.task_id || null, started_at: cf.started_at || new Date().toISOString(), planned_minutes: Math.max(0, Number(cf.planned_minutes) || 25) } : null, planning: { current_cycle, reviews }, personalization, calendar: normalizeCalendarState(input.calendar) }
}

function normalizeLifeData(input = {}) {
  const normalizeIdea = (item = {}) => ({
    ...item,
    id: item.id || id(),
    title: String(item.title || item.text || '').trim(),
    area: String(item.area || item.category || 'عمومی').trim() || 'عمومی',
    description: String(item.description || item.note || item.notes || '').trim(),
    status: String(item.status || 'idea'),
    impact: String(item.impact || 'متوسط'),
    next_action: String(item.next_action || '').trim(),
    created_at: item.created_at || item.date || new Date().toISOString(),
    updated_at: item.updated_at || new Date().toISOString()
  })
  const normalizeJournal = (item = {}) => ({
    ...item,
    id: item.id || id(),
    date: item.date || (item.created_at ? String(item.created_at).slice(0, 10) : today()),
    energy: item.energy === '' || item.energy == null ? null : Math.min(10, Math.max(0, Number(item.energy) || 0)),
    mood: String(item.mood || '').trim(),
    focus: String(item.focus || item.top_task || '').trim(),
    note: String(item.note || item.notes || '').trim(),
    created_at: item.created_at || new Date().toISOString(),
    updated_at: item.updated_at || new Date().toISOString()
  })
  return {
    goals: Array.isArray(input.goals) ? input.goals.map(normalizeGoal).filter((item) => item.title) : [],
    habits: Array.isArray(input.habits) ? input.habits.map(normalizeHabit).filter((item) => item.title) : [],
    weekly_plan: Array.isArray(input.weekly_plan) ? input.weekly_plan : [],
    daily_logs: Array.isArray(input.daily_logs) ? input.daily_logs.map(normalizeJournal) : [],
    ideas: Array.isArray(input.ideas) ? input.ideas.map(normalizeIdea).filter((item) => item.title) : [],
    finance: input.finance && typeof input.finance === 'object'
      ? {
          accounts: Array.isArray(input.finance.accounts) ? input.finance.accounts : [],
          transactions: Array.isArray(input.finance.transactions) ? input.finance.transactions : [],
          debts: Array.isArray(input.finance.debts) ? input.finance.debts : [],
          budgets: Array.isArray(input.finance.budgets) ? input.finance.budgets : [],
          commitments: Array.isArray(input.finance.commitments) ? input.finance.commitments : []
        }
      : { accounts: [], transactions: [], debts: [], budgets: [], commitments: [] },
    modules: input.modules && typeof input.modules === 'object'
      ? Object.fromEntries(Object.entries(input.modules).map(([key, value]) => [key, Array.isArray(value) ? value : []]))
      : { spiritual: [], religious: [], health: [], learning: [], relations: [], review: [] },
    execution: normalizeExecution(input.execution || {})
  }
}

async function persistLifeData(userId, life) {
  if (!hasDatabase) {
    const normalized = normalizeLifeData(life)
    memory.goals = normalized.goals
    memory.habits = normalized.habits
    memory.weekly_plan = normalized.weekly_plan
    memory.daily_logs = normalized.daily_logs
    memory.ideas = normalized.ideas
    memory.finance = normalized.finance
    memory.modules = normalized.modules
    memory.execution = normalized.execution
    return
  }
  await app.pg.query(
    'INSERT INTO user_life_data (user_id, data, updated_at) VALUES ($1, $2::jsonb, NOW()) ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()',
    [userId, JSON.stringify(lifeDataSnapshot(life))]
  )
}

async function getLifeData(userId) {
  if (hasDatabase) {
    const result = await app.pg.query('SELECT data FROM user_life_data WHERE user_id = $1', [userId])
    if (result.rows[0]?.data) {
      return normalizeLifeData(result.rows[0].data)
    }
  }
  return normalizeLifeData(lifeDataSnapshot(memory))
}

async function updateLifeCollection(userId, collection, payload = {}) {
  const current = await getLifeData(userId)
  const items = Array.isArray(current[collection]) ? current[collection] : []
  const incoming = Array.isArray(payload.items) ? payload.items : [payload]
  const normalizer = collection === 'goals' ? normalizeGoal : collection === 'habits' ? normalizeHabit : (item) => ({
    ...item,
    id: item.id || id(),
    created_at: item.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString()
  })
  const updated = incoming.map(normalizer)
  if (['goals', 'habits'].includes(collection) && updated.some((item) => !item.title)) throw new Error(collection === 'goals' ? 'عنوان هدف الزامی است.' : 'عنوان عادت الزامی است.')
  const replace = payload.replace === true
  const next = { ...current, [collection]: replace ? updated : [...items, ...updated] }
  await persistLifeData(userId, next)
  await addActivity(userId, 'system', `${updated.length} مورد در بخش ${collection} ثبت شد.`)
  return next[collection]
}

async function updateLifeItem(userId, collection, itemId, payload = {}) {
  const current = await getLifeData(userId)
  const items = Array.isArray(current[collection]) ? current[collection] : []
  const index = items.findIndex((item) => item.id === itemId)
  if (index < 0) return null
  const next = { ...items[index], ...payload, id: itemId, created_at: items[index].created_at || new Date().toISOString(), updated_at: new Date().toISOString() }
  await persistLifeData(userId, { ...current, [collection]: items.map((item, itemIndex) => itemIndex === index ? next : item) })
  return next
}

async function deleteLifeItem(userId, collection, itemId) {
  const current = await getLifeData(userId)
  const items = Array.isArray(current[collection]) ? current[collection] : []
  const removed = items.find((item) => item.id === itemId)
  if (!removed) return null
  await persistLifeData(userId, { ...current, [collection]: items.filter((item) => item.id !== itemId) })
  return removed
}

function normalizeTask(input = {}) {
  return {
    title: String(input.title || '').trim(),
    description: String(input.description || '').trim(),
    due_date: input.due_date || null,
    priority: ['high', 'medium', 'low'].includes(input.priority) ? input.priority : 'medium',
    status: ['todo', 'in_progress', 'done'].includes(input.status) ? input.status : 'todo',
    estimate_minutes: Math.max(0, Number(input.estimate_minutes) || 0),
    project_id: input.project_id || null,
    category: String(input.category || 'شخصی').trim() || 'شخصی',
    tags: Array.isArray(input.tags) ? input.tags.slice(0, 8) : []
  }
}
const taskBodySchema = {
  type: 'object', additionalProperties: false,
  properties: {
    id: { type: 'string' }, title: { type: 'string', minLength: 1, maxLength: 200 },
    description: { type: 'string', maxLength: 4000 }, due_date: { type: ['string', 'null'], pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
    priority: { type: 'string', enum: ['high', 'medium', 'low'] }, status: { type: 'string', enum: ['todo', 'in_progress', 'done'] },
    estimate_minutes: { type: 'integer', minimum: 0, maximum: 1440 }, project_id: { type: ['string', 'null'] },
    category: { type: 'string', maxLength: 80 }, tags: { type: 'array', maxItems: 8, items: { type: 'string', maxLength: 40 } }
  }
}
const projectBodySchema = {
  type: 'object', additionalProperties: false,
  properties: {
    id: { type: 'string' }, name: { type: 'string', minLength: 1, maxLength: 160 },
    description: { type: 'string', maxLength: 4000 }, due_date: { type: ['string', 'null'], pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
    color: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' }, icon: { type: 'string', maxLength: 2 },
    status: { type: 'string', enum: ['in_progress', 'done', 'paused'] }
  }
}
const eventBodySchema = {
  type: 'object', additionalProperties: false,
  properties: {
    id: { type: 'string' }, title: { type: 'string', minLength: 1, maxLength: 200 },
    type: { type: 'string', enum: ['focus', 'review', 'health', 'personal', 'meeting', 'religious', 'appointment', 'deadline'] },
    start_at: { type: 'string', minLength: 10, maxLength: 40 }, end_at: { type: 'string', minLength: 10, maxLength: 40 },
    color: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' }, project_id: { type: ['string', 'null'] }, notes: { type: 'string', maxLength: 4000 }
  }
}
const idParamsSchema = { type: 'object', additionalProperties: false, required: ['id'], properties: { id: { type: 'string', minLength: 1, maxLength: 100 } } }
const goalBodySchema = {
  type: 'object', additionalProperties: false,
  properties: {
    id: { type: 'string' }, title: { type: 'string', minLength: 1, maxLength: 200 },
    area: { type: 'string', maxLength: 80 }, current_value: { type: 'number', minimum: 0, maximum: 1000000000000 },
    target_value: { type: 'number', minimum: 0, maximum: 1000000000000 }, unit: { type: 'string', maxLength: 40 },
    status: { type: 'string', enum: ['active', 'in_progress', 'done', 'paused'] },
    priority: { type: 'string', enum: ['high', 'medium', 'low'] }, due_date: { type: ['string', 'null'], pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
    next_action: { type: 'string', maxLength: 500 }, note: { type: 'string', maxLength: 4000 }
  }
}
const habitBodySchema = {
  type: 'object', additionalProperties: false,
  properties: {
    id: { type: 'string' }, title: { type: 'string', minLength: 1, maxLength: 200 },
    description: { type: 'string', maxLength: 1000 }, target_weekly: { type: 'integer', minimum: 1, maximum: 7 },
    color: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' }, status: { type: 'string', enum: ['active', 'paused'] },
    logs: { type: 'object', additionalProperties: { type: 'boolean' } }
  }
}
const weeklyBodySchema = {
  type: 'object', additionalProperties: false,
  properties: {
    id: { type: 'string' }, day: { type: 'string', enum: ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'] },
    date: { type: ['string', 'null'], pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
    start: { type: 'string', pattern: '^([01]\\d|2[0-3]):[0-5]\\d$' }, end: { type: 'string', pattern: '^([01]\\d|2[0-3]):[0-5]\\d$' },
    title: { type: 'string', minLength: 1, maxLength: 200 }, category: { type: 'string', maxLength: 80 },
    status: { type: 'string', maxLength: 40 }, color: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' }
  }
}
const ideaBodySchema = {
  type: 'object', additionalProperties: false,
  properties: {
    id: { type: 'string' }, title: { type: 'string', minLength: 1, maxLength: 200 },
    area: { type: 'string', maxLength: 80 }, description: { type: 'string', maxLength: 4000 },
    status: { type: 'string', maxLength: 40 }, impact: { type: 'string', maxLength: 30 }, next_action: { type: 'string', maxLength: 500 }
  }
}
const journalBodySchema = {
  type: 'object', additionalProperties: false,
  properties: {
    id: { type: 'string' }, date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
    energy: { type: ['number', 'null'], minimum: 0, maximum: 10 }, mood: { type: 'string', maxLength: 80 },
    focus: { type: 'string', maxLength: 500 }, note: { type: 'string', maxLength: 5000 }
  }
}
function normalizeProject(input = {}) {
  return {
    name: String(input.name || '').trim(),
    description: String(input.description || '').trim(),
    due_date: input.due_date || null,
    color: /^#[0-9a-f]{6}$/i.test(input.color || '') ? input.color : '#7165f3',
    icon: String(input.icon || '✦').slice(0, 2),
    status: ['in_progress', 'done', 'paused'].includes(input.status) ? input.status : 'in_progress'
  }
}
function normalizeEvent(input = {}) {
  const start = input.start_at || input.start || `${today()}T09:00:00`
  const end = input.end_at || input.end || new Date(new Date(start).getTime() + 30 * 60 * 1000).toISOString()
  if (Number.isNaN(new Date(start).getTime()) || Number.isNaN(new Date(end).getTime())) throw new Error('تاریخ رویداد معتبر نیست.')
  if (new Date(end) <= new Date(start)) throw new Error('پایان رویداد باید بعد از شروع آن باشد.')
  return {
    title: String(input.title || '').trim(),
    type: ['focus', 'review', 'health', 'personal', 'meeting', 'religious', 'appointment', 'deadline'].includes(input.type) ? input.type : 'focus',
    start_at: start,
    end_at: end,
    color: /^#[0-9a-f]{6}$/i.test(input.color || '') ? input.color : '#7165f3',
    project_id: input.project_id || null,
    notes: String(input.notes || '').trim()
  }
}

async function createTask(userId, payload) {
  const task = normalizeTask(payload)
  if (!task.title) throw new Error('عنوان تسک الزامی است.')
  if (task.project_id && !(await listProjects(userId)).some((project) => project.id === task.project_id)) throw new Error('پروژه مرتبط پیدا نشد.')
  const created = { ...task, id: id(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
  if (!hasDatabase) memory.tasks.push(created)
  else {
    await app.pg.query('INSERT INTO tasks (id,user_id,title,description,due_date,priority,status,estimate_minutes,category,tags,project_id,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13)', [created.id, userId, created.title, created.description, created.due_date, created.priority, created.status, created.estimate_minutes, created.category, JSON.stringify(created.tags || []), created.project_id, created.created_at, created.updated_at])
  }
  await addActivity(userId, 'assistant', `تسک «${created.title}» به برنامه اضافه شد.`)
  return created
}

async function createProject(userId, payload) {
  const project = normalizeProject(payload)
  if (!project.name) throw new Error('نام پروژه الزامی است.')
  const created = { ...project, id: id(), created_at: new Date().toISOString() }
  if (!hasDatabase) memory.projects.push(created)
  else await app.pg.query('INSERT INTO projects (id,user_id,name,description,due_date,color,icon,status,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)', [created.id, userId, created.name, created.description, created.due_date, created.color, created.icon, created.status, created.created_at])
  await addActivity(userId, 'project', `پروژه «${created.name}» ساخته شد.`)
  return created
}

async function updateTask(userId, taskId, payload) {
  const currentTasks = await listTasks(userId)
  const current = currentTasks.find((task) => task.id === taskId)
  if (!current) return null
  const next = { ...normalizeTask({ ...current, ...payload }), id: taskId, created_at: current.created_at, updated_at: new Date().toISOString() }
  if (!next.title) throw new Error('عنوان تسک الزامی است.')
  if (next.project_id && !(await listProjects(userId)).some((project) => project.id === next.project_id)) throw new Error('پروژه مرتبط پیدا نشد.')
  if (!hasDatabase) {
    const index = memory.tasks.findIndex((task) => task.id === taskId)
    memory.tasks[index] = next
  } else await app.pg.query('UPDATE tasks SET title=$1,description=$2,due_date=$3,priority=$4,status=$5,estimate_minutes=$6,category=$7,tags=$8::jsonb,project_id=$9,updated_at=$10 WHERE id=$11 AND user_id=$12', [next.title, next.description, next.due_date, next.priority, next.status, next.estimate_minutes, next.category, JSON.stringify(next.tags || []), next.project_id, next.updated_at, taskId, userId])
  if (payload.status === 'done') await addActivity(userId, 'done', `تسک «${next.title}» انجام شد.`)
  return next
}

async function updateProject(userId, projectId, payload) {
  const projects = await listProjects(userId)
  const current = projects.find((project) => project.id === projectId)
  if (!current) return null
  const next = { ...normalizeProject({ ...current, ...payload }), id: projectId, created_at: current.created_at }
  if (!hasDatabase) {
    const index = memory.projects.findIndex((project) => project.id === projectId)
    memory.projects[index] = next
  } else await app.pg.query('UPDATE projects SET name=$1,description=$2,due_date=$3,color=$4,icon=$5,status=$6 WHERE id=$7 AND user_id=$8', [next.name, next.description, next.due_date, next.color, next.icon, next.status, projectId, userId])
  return next
}

async function createEvent(userId, payload) {
  const event = normalizeEvent(payload)
  if (!event.title) throw new Error('عنوان رویداد الزامی است.')
  if (event.project_id && !(await listProjects(userId)).some((project) => project.id === event.project_id)) throw new Error('پروژه مرتبط پیدا نشد.')
  const created = { ...event, id: id(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
  if (!hasDatabase) memory.events.push(created)
  else await app.pg.query('INSERT INTO planner_events (id,user_id,title,type,start_at,end_at,color,project_id,notes,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)', [created.id, userId, created.title, created.type, created.start_at, created.end_at, created.color, created.project_id, created.notes, created.created_at, created.updated_at])
  await addActivity(userId, 'event', `رویداد «${created.title}» به تقویم اضافه شد.`)
  return created
}

async function updateEvent(userId, eventId, payload) {
  const currentEvents = await listEvents(userId)
  const current = currentEvents.find((event) => event.id === eventId)
  if (!current) return null
  const next = { ...normalizeEvent({ ...current, ...payload }), id: eventId, created_at: current.created_at, updated_at: new Date().toISOString() }
  if (!next.title) throw new Error('عنوان رویداد الزامی است.')
  if (next.project_id && !(await listProjects(userId)).some((project) => project.id === next.project_id)) throw new Error('پروژه مرتبط پیدا نشد.')
  if (!hasDatabase) {
    const index = memory.events.findIndex((event) => event.id === eventId)
    memory.events[index] = next
  } else await app.pg.query('UPDATE planner_events SET title=$1,type=$2,start_at=$3,end_at=$4,color=$5,project_id=$6,notes=$7,updated_at=$8 WHERE id=$9 AND user_id=$10', [next.title, next.type, next.start_at, next.end_at, next.color, next.project_id, next.notes, next.updated_at, eventId, userId])
  await addActivity(userId, 'event', `رویداد «${next.title}» ویرایش شد.`)
  return next
}

async function deleteEvent(userId, eventId) {
  if (!hasDatabase) {
    const index = memory.events.findIndex((event) => event.id === eventId)
    if (index < 0) return false
    const [removed] = memory.events.splice(index, 1)
    await addActivity(userId, 'event', `رویداد «${removed.title}» حذف شد.`)
    return true
  }
  const result = await app.pg.query('DELETE FROM planner_events WHERE id=$1 AND user_id=$2 RETURNING title', [eventId, userId])
  if (!result.rowCount) return false
  await addActivity(userId, 'event', `رویداد «${result.rows[0].title}» حذف شد.`)
  return true
}

function buildStats(tasks, projects, events = [], life = {}) {
  const currentDay = today()
  const open = tasks.filter((task) => task.status !== 'done').length
  const completed = tasks.filter((task) => task.status === 'done').length
  const activeProjects = projects.filter((project) => project.status !== 'done').length
  const completedToday = tasks.filter((task) => task.status === 'done' && (task.updated_at || '').slice(0, 10) === currentDay).length
  const dueToday = tasks.filter((task) => task.due_date === currentDay && task.status !== 'done').length
  const focusMinutes = tasks.filter((task) => task.status !== 'done' && task.due_date === currentDay)
    .reduce((total, task) => total + (Number(task.estimate_minutes) || 0), 0)
  const weekly = Array.from({ length: 7 }, (_, index) => {
    const day = new Date()
    day.setDate(day.getDate() - (6 - index))
    const key = day.toISOString().slice(0, 10)
    return {
      date: key,
      label: new Intl.DateTimeFormat('fa-IR', { weekday: 'short' }).format(day),
      planned: tasks.filter((task) => task.due_date === key).length,
      done: tasks.filter((task) => task.status === 'done' && (task.updated_at || '').slice(0, 10) === key).length
    }
  })
  const categories = [...new Set(tasks.map((task) => task.category || 'شخصی'))].map((category) => ({
    category,
    total: tasks.filter((task) => (task.category || 'شخصی') === category).length,
    done: tasks.filter((task) => (task.category || 'شخصی') === category && task.status === 'done').length
  })).sort((a, b) => b.total - a.total)
  const goals = Array.isArray(life.goals) ? life.goals : []
  const habits = Array.isArray(life.habits) ? life.habits : []
  const transactions = Array.isArray(life.finance?.transactions) ? life.finance.transactions : []
  const accounts = Array.isArray(life.finance?.accounts) ? life.finance.accounts : []
  const debts = Array.isArray(life.finance?.debts) ? life.finance.debts : []
  const income = transactions.filter((item) => item.type === 'income').reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const expense = transactions.filter((item) => item.type === 'expense').reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const habitScore = habits.length
    ? Math.round(habits.reduce((sum, habit) => sum + (Number(habit.adherence_percent ?? habit.adherence ?? 0) / 100), 0) / habits.length * 100)
    : 0
  return {
    today: currentDay,
    total_tasks: tasks.length,
    open_tasks: open,
    completed_tasks: completed,
    completed_today: completedToday,
    due_today: dueToday,
    completion_rate: tasks.length ? Math.round((completed / tasks.length) * 100) : 0,
    active_projects: activeProjects,
    events_today: events.filter((event) => event.start_at.slice(0, 10) === currentDay).length,
    focus_minutes: focusMinutes,
    focus_hours: Math.round((focusMinutes / 60) * 10) / 10,
    rhythm_score: Math.min(98, 72 + completed * 4),
    task_trend: '+۱۲٪',
    total_balance: accounts.reduce((sum, item) => sum + Number(item.balance || 0), 0),
    month_income: income,
    month_expense: expense,
    cash_flow: income - expense,
    total_debt: debts.reduce((sum, item) => sum + Number(item.amount || 0), 0),
    habit_score: habitScore,
    goal_progress: goals.length ? Math.round(goals.reduce((sum, goal) => sum + (Number(goal.progress_percent ?? goal.progress ?? 0) / 100), 0) / goals.length * 100) : 0,
    active_goals: goals.filter((goal) => goal.status !== 'done').length,
    weekly,
    categories,
    priority_breakdown: ['high', 'medium', 'low'].map((priority) => ({
      priority,
      count: tasks.filter((task) => task.priority === priority && task.status !== 'done').length
    }))
  }
}

function extractAssistantTaskTitle(message) {
  let title = String(message || '').trim()
  title = title.replace(/[؟?!،؛:]/g, ' ').replace(/\s+/g, ' ').trim()
  title = title.replace(/^(?:لطفاً?|لطفا|برایم|برام|این|یک|یه)\s+/i, '')
  title = title.replace(/^(?:تسک|کار|یادآور|task|todo)\s*/i, '')
  title = title.replace(/^(?:برای|جهت|to|for)\s+/i, '')
  title = title.replace(/^(?:add|create)\s+(?:a\s+)?(?:task|todo)\s*(?:to|for)?\s*/i, '')
  title = title.replace(/\s+(?:را\s+)?(?:اضافه کن|بذار|بزار|بساز|ثبت کن|یادآوری کن|add|create)\s*$/i, '')
  title = title.replace(/\b(?:امروز|فردا|پس‌فردا|today|tomorrow)\b/gi, '')
  return title.replace(/\s+/g, ' ').trim().slice(0, 70) || 'مرور برنامه روزانه'
}

function extractAssistantProjectName(message) {
  let name = String(message || '').trim()
  name = name.replace(/[؟?!،؛:]/g, ' ').replace(/\s+/g, ' ').trim()
  name = name.replace(/^(?:این|یک|یه|لطفاً?|لطفا)\s+/i, '')
  name = name.replace(/^(?:ایده|پروژه)\s*/i, '')
  name = name.replace(/^(?:را|رو)\s*/i, '')
  name = name.replace(/^(?:به\s+پروژه\s+)?(?:تبدیل\s+کن|بساز|ایجاد\s+کن|create|launch)\s*/i, '')
  name = name.replace(/\s+(?:به\s+پروژه\s+)?(?:تبدیل\s+کن|بساز|ایجاد\s+کن|create|launch)\s*$/i, '')
  return name.trim().slice(0, 58) || 'پروژه تازه من'
}

function localAssistant(message, tasks, projects) {
  const lower = message.toLowerCase()
  const actions = []
  const created = []
  const isProject = /پروژه|راه.?اندازی|برنامه جامع|هدف بزرگ|project|launch/i.test(message)
  const priority = /فوری|مهم|ضروری|urgent|important|امروز/.test(lower) ? 'high' : /بعداً|کم.?اهمیت|آرام|low/i.test(lower) ? 'low' : 'medium'
  const dueDate = /پس.?فردا/.test(lower) ? addDays(2) : /فردا|tomorrow/i.test(lower) ? addDays(1) : /امروز|today/.test(lower) ? today() : addDays(3)
  if (isProject) {
    const name = extractAssistantProjectName(message)
    const project = { name: name.charAt(0).toUpperCase() + name.slice(1), description: 'پروژه‌ای که با کمک همراه NOVA از ایده به مسیر اجرایی تبدیل می‌شود.', due_date: addDays(21), color: '#7165f3', icon: '✦' }
    created.push({ type: 'project', payload: project })
    actions.push('ساخت پروژه', 'تقسیم به قدم‌های کوچک', 'تعیین ضرب‌العجل')
    return { reply: `این ایده ظرفیت یک پروژه را دارد. من آن را به‌عنوان «${project.name}» در نظر گرفتم. اگر تأییدش کنی، قدم‌های اول را هم می‌چینیم.`, actions, created }
  }
  const title = extractAssistantTaskTitle(message)
  const shouldCreate = /اضافه|بذار|بزار|بساز|ثبت|یادآور|task|add|create/i.test(lower)
  if (shouldCreate) {
    created.push({ type: 'task', payload: { title, description: 'ساخته‌شده از گفت‌وگو با همراه NOVA.', due_date: dueDate, priority, status: 'todo', estimate_minutes: 30 } })
    actions.push(`اولویت ${priorityLabels[priority]}`, `تاریخ ${formatPersianDate(dueDate)}`, 'زمان تخمینی ۳۰ دقیقه')
    return { reply: `انجام شد. «${title}» را برای ${formatPersianDate(dueDate)} با اولویت ${priorityLabels[priority]} آماده کردم.`, actions, created }
  }
  if (/اولویت|priority|برنامه|plan|امروز|فردا|tomorrow|today/i.test(lower)) {
    const openTasks = tasks.filter((task) => task.status !== 'done')
      .sort((a, b) => ({ high: 1, medium: 2, low: 3 }[a.priority] || 4) - ({ high: 1, medium: 2, low: 3 }[b.priority] || 4))
      .slice(0, 3)
    const planLines = openTasks.length
      ? openTasks.map((task, index) => `${index + 1}) ${task.title} (${priorityLabels[task.priority] || 'متوسط'})`).join('، ')
      : 'یک کار کوچک و مشخص تعریف کن'
    return {
      reply: `برای سبک نگه‌داشتن روز، این ترتیب را پیشنهاد می‌کنم: ${planLines}. بین هر قدم یک مکث کوتاه بگذار و اگر انرژی‌ات پایین بود، فقط قدم اول را انجام بده.`,
      actions: ['شروع قدم اول', 'رزرو ۳۰ دقیقه تمرکز', 'بازبینی عصر']
    }
  }
  const openTasks = tasks.filter((task) => task.status !== 'done').slice(0, 3).map((task) => `«${task.title}»`)
  const projectHint = projects[0]?.name ? ` پروژه «${projects[0].name}» هم در مسیر ${projects[0].progress || 0}% است.` : ''
  return { reply: `برای شروع، پیشنهاد می‌کنم فقط یک قدم بعدی را انتخاب کنی: ${openTasks.join('، ') || 'یک تسک کوچک و مشخص تعریف کن'}.${projectHint} اگر بخواهی، همین حالا آن را برایت به تسک تبدیل می‌کنم.`, actions: ['اولویت‌بندی امروز', 'ساخت تسک', 'برنامه فردا'] }
}
function formatPersianDate(dateString) {
  return new Intl.DateTimeFormat('fa-IR', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(`${dateString}T12:00:00`))
}

const assistantSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    reply: { type: 'string' },
    actions: { type: 'array', items: { type: 'string' } },
    operations: {
      type: 'array',
      maxItems: 8,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          type: { type: 'string', enum: ['create_task', 'create_project', 'update_task', 'update_project', 'none'] },
          id: { type: 'string' },
          title: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string' },
          due_date: { type: 'string' },
          priority: { type: 'string', enum: ['high', 'medium', 'low', ''] },
          status: { type: 'string', enum: ['todo', 'in_progress', 'done', 'paused', ''] },
          estimate_minutes: { type: 'integer', minimum: 0 },
          project_id: { type: 'string' },
          color: { type: 'string' },
          icon: { type: 'string' }
        },
        required: ['type', 'id', 'title', 'name', 'description', 'due_date', 'priority', 'status', 'estimate_minutes', 'project_id', 'color', 'icon']
      }
    }
  },
  required: ['reply', 'actions', 'operations']
}

function getOpenAiClient() {
  if (!process.env.OPENAI_API_KEY) return null
  if (!openaiClient) openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return openaiClient
}

function compactOperation(operation) {
  const payload = {}
  if (operation.title) payload.title = operation.title
  if (operation.name) payload.name = operation.name
  if (operation.description) payload.description = operation.description
  if (operation.due_date) payload.due_date = operation.due_date
  if (operation.priority) payload.priority = operation.priority
  if (operation.status) payload.status = operation.status
  if (Number.isFinite(operation.estimate_minutes) && operation.estimate_minutes > 0) payload.estimate_minutes = operation.estimate_minutes
  if (operation.project_id) payload.project_id = operation.project_id
  if (operation.color) payload.color = operation.color
  if (operation.icon) payload.icon = operation.icon
  return payload
}

async function applyAssistantOperations(userId, operations = []) {
  const applied = []
  for (const operation of operations) {
    if (!operation || operation.type === 'none') continue
    const payload = compactOperation(operation)
    if (operation.type === 'create_task' && payload.title) {
      const task = await createTask(userId, payload)
      applied.push({ type: 'task', id: task.id, title: task.title })
    } else if (operation.type === 'create_project' && payload.name) {
      const project = await createProject(userId, payload)
      applied.push({ type: 'project', id: project.id, title: project.name })
    } else if (operation.type === 'update_task' && operation.id && Object.keys(payload).length) {
      const task = await updateTask(userId, operation.id, payload)
      if (task) applied.push({ type: 'task_update', id: task.id, title: task.title })
    } else if (operation.type === 'update_project' && operation.id && Object.keys(payload).length) {
      const project = await updateProject(userId, operation.id, payload)
      if (project) applied.push({ type: 'project_update', id: project.id, title: project.name })
    }
  }
  return applied
}

async function openAiAssistantStructured(userId, message, context) {
  const client = getOpenAiClient()
  if (!client) throw new Error('OPENAI_API_KEY is not configured')
  const instructions = `You are NOVA, a warm Persian-speaking personal productivity coach.
Turn the user's natural-language request into a short Persian reply plus safe, explicit planner operations.
You may create or update tasks and projects, but never invent IDs: use only IDs present in the supplied context.
Use ISO dates (YYYY-MM-DD); when the user says today or tomorrow, resolve relative to the server date.
If information is missing, leave the corresponding string empty (and use 0 for an unknown estimate) and ask a concise follow-up in reply.
Only propose operations that are clearly requested. Do not claim an operation happened; the server will execute valid operations after your response.
Return the exact JSON schema requested by the API.
Current server date: ${today()}
Existing context: ${JSON.stringify(context).slice(0, 12000)}`
  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
    instructions,
    input: message,
    temperature: 0.25,
    store: false,
    text: {
      format: {
        type: 'json_schema',
        name: 'nova_planner_action',
        strict: true,
        schema: assistantSchema
      }
    }
  })
  let parsed
  try {
    parsed = JSON.parse(response.output_text || '{}')
  } catch {
    throw new Error('OpenAI returned an invalid planner response')
  }
  const applied = await applyAssistantOperations(userId, parsed.operations)
  return { reply: parsed.reply || 'پاسخی دریافت نشد.', actions: parsed.actions || [], created: applied, provider: 'openai' }
}


// ============================================================
// NOVA V11 — Canonical entities + linked views
// This layer keeps legacy V10.x endpoints compatible while exposing
// Areas, Outcomes, Routines, Resources and typed Links as one graph.
// ============================================================
const V11_AREA_DEFAULTS = [
  ['شخصی','◎'],['کار و پروژه','▣'],['سلامت','♥'],['مالی','◈'],['یادگیری','◫'],['روابط','👥'],['معنوی','✦']
]

function ensureMemoryV11() {
  if (!memory.v11 || typeof memory.v11 !== 'object') memory.v11 = { areas: [], resources: [], links: [], project_meta: {}, people: [], relationship_commitments: [], relationship_seeded: false }
  memory.v11.areas ||= []
  memory.v11.resources ||= []
  memory.v11.links ||= []
  memory.v11.project_meta ||= {}
  memory.v11.health_metrics ||= []
  memory.v11.health_logs ||= []
  memory.v11.people ||= []
  memory.v11.relationship_commitments ||= []
  if (typeof memory.v11.relationship_seeded !== 'boolean') memory.v11.relationship_seeded = false
  const wanted = new Map(V11_AREA_DEFAULTS)
  for (const task of memory.tasks || []) if (task.category) wanted.set(task.category, '◫')
  for (const goal of memory.goals || []) if (goal.area) wanted.set(goal.area, '🎯')
  for (const [name, icon] of wanted.entries()) {
    if (!memory.v11.areas.some((a) => a.name === name)) memory.v11.areas.push({ id: id(), name, description: '', icon, status: 'active', standard: '', created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
  }
  if (!memory.v11.resources.length && Array.isArray(memory.ideas)) {
    memory.v11.resources.push(...memory.ideas.map((idea) => ({
      id: idea.id || id(), title: idea.title || 'منبع', area_id: memory.v11.areas.find((a)=>a.name===idea.area)?.id || null,
      resource_type: 'idea', status: idea.status === 'archived' ? 'archived' : 'backlog', url: '', note: idea.description || idea.note || '',
      created_at: idea.created_at || new Date().toISOString(), updated_at: idea.updated_at || new Date().toISOString()
    })))
  }
  for (const project of memory.projects || []) {
    const related = (memory.tasks || []).filter((t)=>t.project_id===project.id)
    const areaName = related.find((t)=>t.category)?.category || 'کار و پروژه'
    const area = memory.v11.areas.find((a)=>a.name===areaName) || memory.v11.areas[0]
    memory.v11.project_meta[project.id] ||= { area_id: area?.id || null, outcome: project.description || '', lifecycle_status: project.status === 'paused' ? 'incubating' : project.status === 'done' ? 'archived' : 'active', review_at: null, last_touched_at: project.created_at || new Date().toISOString() }
  }
}

function parseMeetingNotesV11(notes='') {
  const raw = String(notes || '')
  const prefix = 'NOVA_MEETING::'
  if (!raw.startsWith(prefix)) return { participants: [], agenda: '', pre_read: '', summary: raw, decisions: [], action_items: [], waiting_items: [], next_meeting_at: null }
  try {
    const m = JSON.parse(raw.slice(prefix.length))
    const list = (value) => Array.isArray(value) ? value : String(value || '').split(/\n|،|,/).map((x)=>x.trim()).filter(Boolean)
    return {
      participants: list(m.participants), agenda: String(m.agenda || ''), pre_read: String(m.pre_read || ''), summary: String(m.summary || ''),
      decisions: list(m.decisions), action_items: Array.isArray(m.actions) ? m.actions : list(m.actions).map((text)=>({ id:id(), text, task_id:null })),
      waiting_items: list(m.waiting_items || m.waiting), next_meeting_at: m.next_meeting_at || null
    }
  } catch { return { participants: [], agenda: '', pre_read: '', summary: raw, decisions: [], action_items: [], waiting_items: [], next_meeting_at: null } }
}

async function ensureV11CanonicalData(userId) {
  if (!hasDatabase) { ensureMemoryV11(); return }
  const [tasks, projects, events, life] = await Promise.all([listTasks(userId), listProjects(userId), listEvents(userId), getLifeData(userId)])
  const areaNames = new Map(V11_AREA_DEFAULTS)
  tasks.forEach((t)=>{ if(t.category) areaNames.set(t.category,'◫') })
  ;(life.goals||[]).forEach((g)=>{ if(g.area) areaNames.set(g.area,'🎯') })
  for (const [name, icon] of areaNames.entries()) {
    await app.pg.query(`INSERT INTO areas (id,user_id,name,icon) VALUES ($1,$2,$3,$4) ON CONFLICT (user_id,name) DO NOTHING`, [id(), userId, name, icon])
  }
  const { rows: areaRows } = await app.pg.query('SELECT * FROM areas WHERE user_id=$1', [userId])
  const areaByName = new Map(areaRows.map((a)=>[a.name,a]))

  // Canonicalize task -> Area in one SQL statement; copy only the small metadata map row-by-row.
  await app.pg.query(`UPDATE tasks t SET area_id=a.id FROM areas a WHERE t.user_id=$1 AND a.user_id=$1 AND t.area_id IS NULL AND a.name=t.category`, [userId])
  for (const [taskId, meta] of Object.entries(life.execution?.task_meta || {})) {
    await app.pg.query(`UPDATE tasks SET context=CASE WHEN context='' THEN $1 ELSE context END,
      energy=CASE WHEN energy='' THEN $2 ELSE energy END, waiting_on=CASE WHEN waiting_on='' THEN $3 ELSE waiting_on END,
      resume_note=CASE WHEN resume_note='' THEN $4 ELSE resume_note END, source_meeting_id=COALESCE(source_meeting_id,$5)
      WHERE id=$6 AND user_id=$7`, [meta.context||'', meta.energy||'', meta.waiting_on||'', meta.resume_note||'', meta.source_meeting_id||null, taskId, userId])
  }
  for (const project of projects) {
    const related = tasks.filter((t)=>t.project_id===project.id)
    const areaId = project.area_id || areaByName.get(related.find((t)=>t.category)?.category || 'کار و پروژه')?.id || null
    await app.pg.query(`UPDATE projects SET area_id=COALESCE(area_id,$1), outcome=CASE WHEN outcome='' THEN $2 ELSE outcome END,
      lifecycle_status=CASE WHEN lifecycle_status IS NULL OR lifecycle_status='' THEN $3 ELSE lifecycle_status END,
      last_touched_at=COALESCE(last_touched_at,created_at,NOW()) WHERE id=$4 AND user_id=$5`,
      [areaId, project.description||'', project.status==='paused'?'incubating':project.status==='done'?'archived':'active', project.id, userId])
  }

  for (const goal of life.goals || []) {
    await app.pg.query(`INSERT INTO outcomes (id,user_id,title,area_id,status,target_value,current_value,unit,due_date,next_action,note,metric_name,baseline_value,target_direction,review_at,measurement_note,created_at,updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
      ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title,area_id=EXCLUDED.area_id,status=EXCLUDED.status,target_value=EXCLUDED.target_value,current_value=EXCLUDED.current_value,unit=EXCLUDED.unit,due_date=EXCLUDED.due_date,next_action=EXCLUDED.next_action,note=EXCLUDED.note,metric_name=EXCLUDED.metric_name,baseline_value=EXCLUDED.baseline_value,target_direction=EXCLUDED.target_direction,review_at=EXCLUDED.review_at,measurement_note=EXCLUDED.measurement_note,updated_at=EXCLUDED.updated_at`,
      [goal.id||id(),userId,goal.title,areaByName.get(goal.area)?.id||null,goal.status||'active',goal.target_value||0,goal.current_value||0,goal.unit||'',goal.due_date||null,goal.next_action||'',goal.note||'',goal.metric_name||'',goal.baseline_value||0,goal.target_direction||'increase',goal.review_at||null,goal.measurement_note||'',goal.created_at||new Date().toISOString(),goal.updated_at||new Date().toISOString()])
  }
  for (const habit of life.habits || []) {
    const rid = habit.id || id()
    await app.pg.query(`INSERT INTO routines (id,user_id,title,area_id,routine_type,description,target_weekly,status,color,created_at,updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title,description=EXCLUDED.description,target_weekly=EXCLUDED.target_weekly,status=EXCLUDED.status,color=EXCLUDED.color,updated_at=EXCLUDED.updated_at`,
      [rid,userId,habit.title,areaByName.get('شخصی')?.id||null,'general',habit.description||'',habit.target_weekly||1,habit.status||'active',habit.color||'#7165f3',habit.created_at||new Date().toISOString(),habit.updated_at||new Date().toISOString()])
    for (const [logDate, value] of Object.entries(habit.logs||{})) {
      await app.pg.query(`INSERT INTO routine_logs (id,user_id,routine_id,log_date,value) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (user_id,routine_id,log_date) DO UPDATE SET value=EXCLUDED.value,updated_at=NOW()`,[id(),userId,rid,logDate,Boolean(value)])
    }
  }
  for (const idea of life.ideas || []) {
    await app.pg.query(`INSERT INTO resources (id,user_id,title,area_id,resource_type,status,note,created_at,updated_at) VALUES ($1,$2,$3,$4,'idea',$5,$6,$7,$8)
      ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title,area_id=COALESCE(resources.area_id,EXCLUDED.area_id),note=CASE WHEN resources.note='' THEN EXCLUDED.note ELSE resources.note END,updated_at=GREATEST(resources.updated_at,EXCLUDED.updated_at)`,
      [idea.id||id(),userId,idea.title,areaByName.get(idea.area)?.id||null,idea.status==='archived'?'archived':'backlog',idea.description||idea.note||'',idea.created_at||new Date().toISOString(),idea.updated_at||new Date().toISOString()])
  }
  for (const event of events.filter((e)=>e.type==='meeting')) {
    const details = parseMeetingNotesV11(event.notes)
    await app.pg.query(`INSERT INTO meeting_details (event_id,user_id,area_id,participants,agenda,pre_read,summary,decisions,action_items,waiting_items,next_meeting_at)
      VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8::jsonb,$9::jsonb,$10::jsonb,$11)
      ON CONFLICT (event_id) DO NOTHING`, [event.id,userId,event.area_id||null,JSON.stringify(details.participants),details.agenda,details.pre_read,details.summary,JSON.stringify(details.decisions),JSON.stringify(details.action_items),JSON.stringify(details.waiting_items),details.next_meeting_at])
  }
}

function v11AreaForName(areas, name) { return areas.find((a)=>a.name===name) || null }
function v11DerivedLinks({tasks=[],projects=[],events=[],areas=[],explicit=[]}) {
  const links = [...explicit]
  const key = (x)=>`${x.source_type}:${x.source_id}:${x.relation}:${x.target_type}:${x.target_id}`
  const seen = new Set(links.map(key))
  const push = (source_type,source_id,relation,target_type,target_id) => {
    if (!source_id || !target_id) return
    const x={id:`derived-${source_type}-${source_id}-${relation}-${target_type}-${target_id}`,source_type,source_id,relation,target_type,target_id,derived:true}
    if(!seen.has(key(x))){seen.add(key(x));links.push(x)}
  }
  for (const task of tasks) {
    push('task',task.id,'belongs_to','project',task.project_id)
    push('task',task.id,'belongs_to','area',task.area_id)
    push('task',task.id,'originated_from','event',task.source_meeting_id)
  }
  for (const project of projects) push('project',project.id,'belongs_to','area',project.area_id)
  for (const event of events) { push('event',event.id,'belongs_to','project',event.project_id); push('event',event.id,'belongs_to','area',event.area_id) }
  return links
}

async function getV11Canonical(userId) {
  await ensureV11CanonicalData(userId)
  const [legacyTasks, legacyProjects, events, life] = await Promise.all([listTasks(userId), listProjects(userId), listEvents(userId), getLifeData(userId)])
  let areas, resources, explicitLinks, outcomes, routines, meetingDetails
  if (!hasDatabase) {
    ensureMemoryV11()
    areas = memory.v11.areas
    resources = memory.v11.resources
    explicitLinks = memory.v11.links
    outcomes = (life.goals||[]).map((g)=>({...g,area_id:v11AreaForName(areas,g.area)?.id||null}))
    v1111EnsureMemorySeed(life)
    routines = [
      ...(life.habits||[]).map((h)=>({...h,area_id:v11AreaForName(areas,'شخصی')?.id||null,routine_type:'general'})),
      ...(memory.v11.spiritual_routines||[])
    ]
    meetingDetails = Object.fromEntries(events.filter((e)=>e.type==='meeting').map((e)=>[e.id,parseMeetingNotesV11(e.notes)]))
  } else {
    const [a,r,l,o,rt,md] = await Promise.all([
      app.pg.query('SELECT * FROM areas WHERE user_id=$1 ORDER BY created_at',[userId]),
      app.pg.query('SELECT * FROM resources WHERE user_id=$1 ORDER BY updated_at DESC',[userId]),
      app.pg.query('SELECT * FROM entity_links WHERE user_id=$1 ORDER BY created_at DESC',[userId]),
      app.pg.query('SELECT * FROM outcomes WHERE user_id=$1 ORDER BY updated_at DESC',[userId]),
      app.pg.query(`SELECT r.*, COALESCE(jsonb_object_agg(rl.log_date::text,rl.value) FILTER (WHERE rl.log_date IS NOT NULL),'{}'::jsonb) AS logs FROM routines r LEFT JOIN routine_logs rl ON rl.routine_id=r.id AND rl.user_id=$1 WHERE r.user_id=$1 GROUP BY r.id ORDER BY r.created_at`,[userId]),
      app.pg.query('SELECT * FROM meeting_details WHERE user_id=$1',[userId])
    ])
    areas=a.rows; resources=r.rows; explicitLinks=l.rows; outcomes=o.rows; routines=rt.rows; meetingDetails=Object.fromEntries(md.rows.map((x)=>[x.event_id,x]))
  }
  const execution = life.execution || {task_meta:{}}
  const tasks = legacyTasks.map((t)=>{
    const meta=execution.task_meta?.[t.id]||{}
    const area = t.area_id || v11AreaForName(areas,t.category)?.id || null
    return {...t, area_id:area, context:t.context||meta.context||'', energy:t.energy||meta.energy||'', waiting_on:t.waiting_on||meta.waiting_on||'', resume_note:t.resume_note||meta.resume_note||'', source_meeting_id:t.source_meeting_id||meta.source_meeting_id||null}
  })
  const projects = legacyProjects.map((p)=>{
    const localMeta=!hasDatabase?(memory.v11.project_meta?.[p.id]||{}):{}
    const related=tasks.filter((t)=>t.project_id===p.id)
    const area_id=p.area_id||localMeta.area_id||related.find((t)=>t.area_id)?.area_id||v11AreaForName(areas,'کار و پروژه')?.id||null
    const next_action=related.find((t)=>t.status!=='done')?.title||''
    return {...p,area_id,outcome:p.outcome||localMeta.outcome||p.description||'',lifecycle_status:p.lifecycle_status||localMeta.lifecycle_status||(p.status==='paused'?'incubating':p.status==='done'?'archived':'active'),review_at:p.review_at||localMeta.review_at||null,last_touched_at:p.last_touched_at||localMeta.last_touched_at||p.created_at,next_action}
  })
  const normalizedEvents=events.map((e)=>({...e,area_id:e.area_id||projects.find((p)=>p.id===e.project_id)?.area_id||null}))
  const links=v11DerivedLinks({tasks,projects,events:normalizedEvents,areas,explicit:explicitLinks})
  const meetings=normalizedEvents.filter((e)=>e.type==='meeting').map((e)=>({...e,details:meetingDetails[e.id]||parseMeetingNotesV11(e.notes)}))
  return { areas,tasks,projects,outcomes,routines,events:normalizedEvents,meetings,resources,links,execution }
}

function v11EntityMap(data,type){
  const map={task:data.tasks,project:data.projects,area:data.areas,outcome:data.outcomes,routine:data.routines,event:data.events,meeting:data.meetings,resource:data.resources}
  return map[type]||[]
}
function v11Label(type){return ({task:'تسک',project:'پروژه',area:'حوزه',outcome:'هدف',routine:'روتین',event:'رویداد',meeting:'جلسه',resource:'منبع'})[type]||type}

function v11Summary(data){
  const activeProjects=data.projects.filter((p)=>p.lifecycle_status==='active')
  const projectCoverage=activeProjects.length?Math.round(activeProjects.filter((p)=>p.next_action).length/activeProjects.length*100):100
  const staleCut=Date.now()-14*86400000
  const stale=activeProjects.filter((p)=>new Date(p.last_touched_at||p.created_at||0).getTime()<staleCut).length
  return {
    tasks_open:data.tasks.filter((t)=>t.status!=='done').length,
    waiting:data.tasks.filter((t)=>t.status!=='done'&&String(t.waiting_on||'').trim()).length,
    projects_active:activeProjects.length,
    projects_incubating:data.projects.filter((p)=>p.lifecycle_status==='incubating').length,
    next_action_coverage:projectCoverage,
    stale_projects:stale,
    areas:data.areas.length,
    resources_backlog:data.resources.filter((r)=>r.status!=='archived').length,
    meetings_upcoming:data.meetings.filter((m)=>new Date(m.start_at)>=new Date()).length
  }
}

app.get('/api/v11/bootstrap', async (request) => { const data=await getV11Canonical(request.user.id); return {...data,summary:v11Summary(data)} })
app.get('/api/v11/dashboard', async (request) => { const data=await getV11Canonical(request.user.id); return {summary:v11Summary(data),projects:data.projects.filter((p)=>p.lifecycle_status==='active').slice(0,8),areas:data.areas,meetings:data.meetings.slice(0,8),resources:data.resources.slice(0,8)} })


// ===== V11.1 Reliability & Scale =====
app.get('/api/v11/summary', async (request) => {
  const data = await getV11Canonical(request.user.id)
  return { summary: v11Summary(data), server_time: new Date().toISOString(), stage: 'V11.1' }
})

app.get('/api/v11/tasks/paged', async (request) => {
  const data = await getV11Canonical(request.user.id)
  const q = String(request.query?.q || '').trim().toLowerCase()
  const status = String(request.query?.status || '').trim()
  const areaId = String(request.query?.area_id || '').trim()
  const projectId = String(request.query?.project_id || '').trim()
  const waiting = String(request.query?.waiting || '').trim()
  const context = String(request.query?.context || '').trim()
  const energy = String(request.query?.energy || '').trim()
  const maxMinutes = Math.max(0, Number(request.query?.max_minutes || 0) || 0)
  const limit = Math.max(20, Math.min(200, Number(request.query?.limit || 80) || 80))
  const cursor = Math.max(0, Number(request.query?.cursor || 0) || 0)

  let rows = data.tasks.slice()
  if (q) rows = rows.filter((t) => `${t.title || ''} ${t.description || ''} ${t.category || ''}`.toLowerCase().includes(q))
  if (status) rows = rows.filter((t) => t.status === status)
  if (areaId) rows = rows.filter((t) => String(t.area_id || '') === areaId)
  if (projectId) rows = rows.filter((t) => String(t.project_id || '') === projectId)
  if (waiting === '1') rows = rows.filter((t) => String(t.waiting_on || '').trim())
  if (waiting === '0') rows = rows.filter((t) => !String(t.waiting_on || '').trim())
  if (context) rows = rows.filter((t) => String(t.context || '').trim() === context)
  if (energy) rows = rows.filter((t) => String(t.energy || '').trim() === energy)
  if (maxMinutes) rows = rows.filter((t) => !Number(t.estimate_minutes || 0) || Number(t.estimate_minutes || 0) <= maxMinutes)

  const priorityWeight = (p) => ({ urgent: 0, high: 1, medium: 2, low: 3 }[p] ?? 4)
  rows.sort((a, b) => String(a.due_date || '9999-12-31').localeCompare(String(b.due_date || '9999-12-31')) || priorityWeight(a.priority) - priorityWeight(b.priority) || String(a.title || '').localeCompare(String(b.title || '')))
  const total = rows.length
  const items = rows.slice(cursor, cursor + limit)
  const next = cursor + items.length
  return { items, total, limit, cursor, next_cursor: next < total ? String(next) : null, has_more: next < total }
})

app.get('/api/v11/health', async () => ({
  ok: true,
  stage: 'V11.1',
  storage: hasDatabase ? 'postgresql' : 'memory',
  capabilities: ['optimistic-ui', 'paged-tasks', 'offline-outbox', 'pwa-shell'],
  now: new Date().toISOString()
}))



// ===== V11.2 Performance & Unified Data Loading =====
// Lightweight view-specific endpoints. Primary screens no longer need /api/bootstrap.
function v112DateIso(d=new Date()) { return d.toISOString().slice(0,10) }
function v112AddDays(iso,n){ const d=new Date(`${iso}T00:00:00`); d.setDate(d.getDate()+n); return v112DateIso(d) }
function v112WeekStart(iso=v112DateIso()) { const d=new Date(`${iso}T00:00:00`); const offset=(d.getDay()+1)%7; d.setDate(d.getDate()-offset); return v112DateIso(d) }
function v112PriorityRank(p){ return ({urgent:0,high:1,medium:2,low:3}[String(p||'').toLowerCase()] ?? 4) }
function v112ActionItems(details={}){
  const rows=Array.isArray(details.action_items)?details.action_items:Array.isArray(details.actions)?details.actions:[]
  return rows.map((x)=>typeof x==='string'?{text:x,task_id:null}:x).filter(Boolean)
}
function v112MeetingDecisionCount(details={}){
  if(Array.isArray(details.decisions)) return details.decisions.filter((x)=>x && (typeof x==='string' || !['accepted','closed'].includes(x.status))).length
  return String(details.decisions||'').trim()?1:0
}
function v112ProjectLite(p){ return {id:p.id,name:p.name,description:p.description||'',outcome:p.outcome||'',lifecycle_status:p.lifecycle_status||'active',area_id:p.area_id||null,progress:Number(p.progress||0),next_action:p.next_action||'',due_date:p.due_date||null,last_touched_at:p.last_touched_at||p.updated_at||p.created_at||null} }
function v112TaskLite(t){ return {id:t.id,title:t.title,description:t.description||'',status:t.status,priority:t.priority,project_id:t.project_id||null,area_id:t.area_id||null,category:t.category||'',context:t.context||'',energy:t.energy||'',estimate_minutes:Number(t.estimate_minutes||0),due_date:t.due_date||null,waiting_on:t.waiting_on||'',resume_note:t.resume_note||''} }
function v112MeetingLite(m){ const d=m.details||{}; return {id:m.id,title:m.title,start_at:m.start_at,end_at:m.end_at,project_id:m.project_id||null,area_id:m.area_id||null,notes:m.notes||'',details:{participants:d.participants||[],agenda:d.agenda||'',summary:d.summary||'',decisions:d.decisions||[],action_items:v112ActionItems(d),waiting_items:d.waiting_items||[],next_meeting_at:d.next_meeting_at||null}} }
function v112AreaSummaries(data){
  const now=Date.now()
  return data.areas.map((a)=>{
    const tasks=data.tasks.filter((t)=>t.area_id===a.id&&t.status!=='done')
    const projects=data.projects.filter((p)=>p.area_id===a.id&&p.lifecycle_status==='active')
    const routines=data.routines.filter((r)=>r.area_id===a.id&&r.status!=='paused')
    const events=data.events.filter((e)=>e.area_id===a.id&&new Date(e.end_at||e.start_at||0).getTime()>=now)
    return {id:a.id,name:a.name,icon:a.icon||'◫',description:a.description||'',standard:a.standard||'',status:a.status||'active',tasks_open:tasks.length,waiting:tasks.filter((t)=>String(t.waiting_on||'').trim()).length,projects_active:projects.length,routines_active:routines.length,events_upcoming:events.length}
  })
}
async function v112DashboardData(userId){
  const started=Date.now()
  const [data,life]=await Promise.all([getV11Canonical(userId),getLifeData(userId)])
  const summary=v11Summary(data), now=new Date(), nowMs=now.getTime(), today=v112DateIso(now), weekStart=v112WeekStart(today), weekEnd=v112AddDays(weekStart,6)
  const open=data.tasks.filter((t)=>t.status!=='done')
  const eligible=open.filter((t)=>!String(t.waiting_on||'').trim())
  const todayOpen=open.filter((t)=>t.due_date===today)
  const overdue=open.filter((t)=>t.due_date&&t.due_date<today).sort((a,b)=>String(a.due_date).localeCompare(String(b.due_date)))
  const high=open.filter((t)=>['urgent','high'].includes(String(t.priority||'').toLowerCase())&&!overdue.includes(t))
  const activeProjects=data.projects.filter((p)=>p.lifecycle_status==='active')
  const noAction=activeProjects.filter((p)=>!p.next_action)
  const rankTask=(a,b)=>{
    const ad=a.due_date===today?0:a.due_date&&a.due_date<today?-1:1, bd=b.due_date===today?0:b.due_date&&b.due_date<today?-1:1
    return ad-bd || v112PriorityRank(a.priority)-v112PriorityRank(b.priority) || String(a.due_date||'9999-12-31').localeCompare(String(b.due_date||'9999-12-31'))
  }
  const nextActions=(todayOpen.length?todayOpen:eligible).slice().sort(rankTask).slice(0,3).map(v112TaskLite)
  const currentEvent=data.events.filter((e)=>new Date(e.start_at||0).getTime()<=nowMs&&new Date(e.end_at||e.start_at||0).getTime()>=nowMs).sort((a,b)=>new Date(a.start_at)-new Date(b.start_at))[0]||null
  const focus=data.execution?.current_focus||null
  const focusTask=focus?data.tasks.find((t)=>t.id===focus.task_id):null
  const meetings=data.meetings.slice().sort((a,b)=>new Date(a.start_at)-new Date(b.start_at))
  const upcoming=meetings.filter((m)=>new Date(m.end_at||m.start_at||0).getTime()>=nowMs)
  const nextMeeting=upcoming[0]||null
  const meetingToday=meetings.filter((m)=>String(m.start_at||'').slice(0,10)===today)
  const meetingWeek=meetings.filter((m)=>{const d=String(m.start_at||'').slice(0,10);return d>=weekStart&&d<=weekEnd})
  const outstandingActions=meetings.reduce((n,m)=>n+v112ActionItems(m.details||{}).filter((a)=>!a.task_id).length,0)
  const unresolvedDecisions=meetings.reduce((n,m)=>n+v112MeetingDecisionCount(m.details||{}),0)
  const activeRoutines=data.routines.filter((r)=>r.status!=='paused')
  const routineDoneToday=activeRoutines.filter((r)=>Boolean(r.logs?.[today])).length
  const past7=Array.from({length:7},(_,i)=>v112AddDays(today,-i))
  const routine7Possible=activeRoutines.length*past7.length
  const routine7Done=activeRoutines.reduce((n,r)=>n+past7.filter((d)=>Boolean(r.logs?.[d])).length,0)
  const routineAttention=activeRoutines.filter((r)=>!r.logs?.[today]).slice(0,5).map((r)=>({id:r.id,title:r.title}))
  const dailyLog=(life.daily_logs||[]).find((x)=>x.date===today)||(life.daily_logs||[])[0]||null
  const financeTx=life.finance?.transactions||[]
  const monthPrefix=today.slice(0,7)
  const monthTx=financeTx.filter((x)=>String(x.date||'').startsWith(monthPrefix))
  const income=monthTx.filter((x)=>x.type==='income').reduce((a,b)=>a+Number(b.amount||0),0)
  const expense=monthTx.filter((x)=>x.type==='expense').reduce((a,b)=>a+Number(b.amount||0),0)
  const payload={
    stage:'V11.2',today,
    summary,
    now:{current_event:currentEvent?{id:currentEvent.id,title:currentEvent.title,type:currentEvent.type,start_at:currentEvent.start_at,end_at:currentEvent.end_at}:null,current_focus:focus,focus_task:focusTask?v112TaskLite(focusTask):null,next_actions:nextActions,today_total:data.tasks.filter((t)=>t.due_date===today).length,today_done:data.tasks.filter((t)=>t.due_date===today&&t.status==='done').length,today_open:todayOpen.length,energy:dailyLog?.energy??null,planned_minutes:todayOpen.reduce((a,t)=>a+Number(t.estimate_minutes||0),0)},
    attention:{overdue_count:overdue.length,overdue:overdue.slice(0,3).map(v112TaskLite),high_count:high.length,high:high.slice(0,3).map(v112TaskLite),waiting_count:summary.waiting,projects_without_next_action:noAction.length,stale_projects:summary.stale_projects},
    meetings:{next:nextMeeting?v112MeetingLite(nextMeeting):null,today_count:meetingToday.length,week_count:meetingWeek.length,outstanding_actions:outstandingActions,unresolved_decisions:unresolvedDecisions,upcoming:upcoming.slice(0,5).map(v112MeetingLite)},
    projects:activeProjects.slice().sort((a,b)=>String(a.due_date||'9999-12-31').localeCompare(String(b.due_date||'9999-12-31'))).slice(0,6).map(v112ProjectLite),
    areas:v112AreaSummaries(data),
    routines:{active:activeRoutines.length,today_done:routineDoneToday,today_percent:activeRoutines.length?Math.round(routineDoneToday/activeRoutines.length*100):0,seven_day_percent:routine7Possible?Math.round(routine7Done/routine7Possible*100):0,needs_attention:routineAttention},
    finance:{income,expense,balance:income-expense,period:monthPrefix},
    review:{open_tasks:open.length,active_projects:activeProjects.length,high_or_overdue:new Set([...high,...overdue.filter((t)=>['urgent','high'].includes(String(t.priority||'').toLowerCase()))].map((t)=>t.id)).size,last_daily_review:dailyLog?.date||null,next_action_coverage:summary.next_action_coverage,stale_projects:summary.stale_projects},
    execution:{current_focus:focus},
    meta:{generated_at:new Date().toISOString(),server_compute_ms:Date.now()-started,payload_bytes:0,source:'view-specific aggregation'}
  }
  payload.meta.payload_bytes=Buffer.byteLength(JSON.stringify(payload),'utf8')
  return payload
}

app.get('/api/v11.2/dashboard', async (request) => v112DashboardData(request.user.id))
app.get('/api/v11.2/today', async (request) => {
  const d=await v112DashboardData(request.user.id)
  return {stage:d.stage,today:d.today,now:d.now,attention:d.attention,meetings:{today_count:d.meetings.today_count,next:d.meetings.next},routines:d.routines,review:{open_tasks:d.review.open_tasks},meta:d.meta}
})
app.get('/api/v11.2/areas', async (request) => {
  const data=await getV11Canonical(request.user.id)
  return {items:v112AreaSummaries(data),total:data.areas.length,stage:'V11.2'}
})
app.get('/api/v11.2/meetings', async (request) => {
  const data=await getV11Canonical(request.user.id), now=Date.now(), limit=Math.max(1,Math.min(100,Number(request.query?.limit||30)||30))
  const rows=data.meetings.slice().sort((a,b)=>new Date(b.start_at)-new Date(a.start_at)).slice(0,limit).map(v112MeetingLite)
  return {items:rows,total:data.meetings.length,upcoming:data.meetings.filter((m)=>new Date(m.end_at||m.start_at||0).getTime()>=now).length,stage:'V11.2'}
})
app.get('/api/v11.2/references', async (request) => {
  const data=await getV11Canonical(request.user.id)
  return {areas:data.areas.map((a)=>({id:a.id,name:a.name,icon:a.icon||'◫',status:a.status||'active'})),projects:data.projects.map(v112ProjectLite),stage:'V11.2'}
})
app.get('/api/v11.2/projects', async (request) => { const data=await getV11Canonical(request.user.id); return {items:data.projects.map(v112ProjectLite),total:data.projects.length,stage:'V11.2'} })
app.get('/api/v11.2/outcomes', async (request) => { const data=await getV11Canonical(request.user.id); return {items:data.outcomes,total:data.outcomes.length,stage:'V11.2'} })
app.get('/api/v11.2/resources', async (request) => { const data=await getV11Canonical(request.user.id); return {items:data.resources,total:data.resources.length,stage:'V11.2'} })
app.get('/api/v11.2/health', async () => ({ok:true,stage:'V11.2',storage:hasDatabase?'postgresql':'memory',capabilities:['unified-view-loader','dashboard-aggregation','lazy-legacy-bootstrap','client-ttl-cache','request-deduplication','paged-tasks','optimistic-ui','offline-outbox','pwa-shell'],now:new Date().toISOString()}))


// ===== V11.3 Review, Planning Cycles & Portfolio Control =====
function v113DefaultCycle() {
  const start = v112WeekStart(v112DateIso())
  return { id:id(), start_date:start, end_date:v112AddDays(start,6), theme:'', capacity_hours:20, wip_limit:3, project_ids:[], must:[], should:[], could:[], wont:[], notes:'', updated_at:new Date().toISOString() }
}
function v113OpenMeetingActions(data){
  return data.meetings.reduce((n,m)=>n+v112ActionItems(m.details||{}).filter((x)=>!x.task_id && !x.done).length,0)
}
async function v113PlanningPayload(userId){
  const [data,life]=await Promise.all([getV11Canonical(userId),getLifeData(userId)])
  const planning=life.execution?.planning||{current_cycle:null,reviews:[]}
  const cycle=planning.current_cycle||v113DefaultCycle()
  const active=data.projects.filter((p)=>p.lifecycle_status==='active')
  const staleCut=Date.now()-14*86400000
  const stale=active.filter((p)=>new Date(p.last_touched_at||p.updated_at||p.created_at||0).getTime()<staleCut)
  const noAction=active.filter((p)=>!String(p.next_action||'').trim())
  const waiting=data.tasks.filter((t)=>t.status!=='done'&&String(t.waiting_on||'').trim())
  const inbox=data.tasks.filter((t)=>t.status!=='done'&&String(t.category||'').toLowerCase()==='inbox')
  const todayIso=v112DateIso()
  const overdue=data.tasks.filter((t)=>t.status!=='done'&&t.due_date&&t.due_date<todayIso)
  const activeRoutines=data.routines.filter((r)=>r.status!=='paused')
  const routinesMissing=activeRoutines.filter((r)=>!r.logs?.[todayIso])
  const projectGroups={active:[],incubating:[],someday:[],archived:[]}
  for(const p of data.projects){const k=projectGroups[p.lifecycle_status] ? p.lifecycle_status : 'active'; projectGroups[k].push(v112ProjectLite(p))}
  return {
    stage:'V11.3', cycle, reviews:(planning.reviews||[]).slice().reverse().slice(0,20),
    portfolio:{wip_limit:cycle.wip_limit,active_count:active.length,over_limit:Math.max(0,active.length-cycle.wip_limit),groups:projectGroups},
    snapshot:{inbox:inbox.length,waiting:waiting.length,overdue:overdue.length,active_projects:active.length,projects_without_next_action:noAction.length,stale_projects:stale.length,meeting_actions:v113OpenMeetingActions(data),routines_missing_today:routinesMissing.length,next_action_coverage:active.length?Math.round((active.length-noAction.length)/active.length*100):100},
    references:{projects:data.projects.map(v112ProjectLite),areas:data.areas.map((a)=>({id:a.id,name:a.name}))},
    generated_at:new Date().toISOString()
  }
}
app.get('/api/v11.3/planning', async (request) => v113PlanningPayload(request.user.id))
app.put('/api/v11.3/cycle', async (request) => {
  const life=await getLifeData(request.user.id)
  const current=life.execution?.planning?.current_cycle||v113DefaultCycle()
  const body=request.body||{}
  const next={...current,...body,id:current.id||id(),updated_at:new Date().toISOString()}
  const execution=normalizeExecution({...life.execution,planning:{...(life.execution?.planning||{}),current_cycle:next}})
  await persistLifeData(request.user.id,{...life,execution})
  return v113PlanningPayload(request.user.id)
})
app.post('/api/v11.3/reviews', async (request, reply) => {
  const life=await getLifeData(request.user.id), body=request.body||{}
  const review={id:id(),type:['daily','weekly','monthly','seasonal'].includes(body.type)?body.type:'weekly',date:String(body.date||today()).slice(0,10),wins:String(body.wins||''),lessons:String(body.lessons||''),stop:String(body.stop||''),start:String(body.start||''),continue:String(body.continue||''),next_theme:String(body.next_theme||''),note:String(body.note||''),created_at:new Date().toISOString()}
  const old=life.execution?.planning?.reviews||[]
  const execution=normalizeExecution({...life.execution,planning:{...(life.execution?.planning||{}),reviews:[...old,review]}})
  await persistLifeData(request.user.id,{...life,execution})
  return reply.code(201).send(review)
})
app.get('/api/v11.3/health', async () => ({ok:true,stage:'V11.3',storage:hasDatabase?'postgresql':'memory',capabilities:['weekly-cycle','moscow-scope','portfolio-wip','review-snapshot','review-history','stale-project-detection','next-action-coverage'],now:new Date().toISOString()}))


// ===== V11.4 Decision Support & Personalization =====
function v114DefaultPersonalization(){return {default_context:'',default_energy:'',default_minutes:30,attention:{stale_project_days:14,waiting_days:3},dashboard:{now:true,decision:true,attention:true,projects:true,areas:true,routines:true,review:true},saved_views:[]}}
function v114PrefsFromLife(life){return normalizeExecution(life.execution||{}).personalization||v114DefaultPersonalization()}
async function v114SavePrefs(userId,prefs){const life=await getLifeData(userId);const execution=normalizeExecution({...life.execution,personalization:prefs});await persistLifeData(userId,{...life,execution});return execution.personalization}
function v114TaskReasons(t,todayIso,activeProjectIds){const reasons=[];if(t.due_date&&t.due_date<todayIso)reasons.push('موعد گذشته');else if(t.due_date===todayIso)reasons.push('موعد امروز');if(['urgent','high'].includes(String(t.priority||'').toLowerCase()))reasons.push('اولویت بالا');if(t.project_id&&activeProjectIds.has(t.project_id))reasons.push('پروژه Active');if(t.context)reasons.push(`Context: ${t.context}`);if(t.energy)reasons.push(`Energy: ${t.energy}`);if(Number(t.estimate_minutes||0))reasons.push(`${Number(t.estimate_minutes)} دقیقه`);return reasons}
async function v114Recommendations(userId,query={}){const [data,life]=await Promise.all([getV11Canonical(userId),getLifeData(userId)]);const prefs=v114PrefsFromLife(life),todayIso=v112DateIso(),ctx=String(query.context||prefs.default_context||''),energy=String(query.energy||prefs.default_energy||''),minutes=Math.max(0,Number(query.minutes||prefs.default_minutes||30)||30),activeProjectIds=new Set(data.projects.filter(p=>p.lifecycle_status==='active').map(p=>p.id));let rows=data.tasks.filter(t=>t.status!=='done'&&!String(t.waiting_on||'').trim());if(ctx)rows=rows.filter(t=>String(t.context||'')===ctx);if(energy)rows=rows.filter(t=>String(t.energy||'')===energy);if(minutes)rows=rows.filter(t=>!Number(t.estimate_minutes||0)||Number(t.estimate_minutes||0)<=minutes);const band=t=>t.due_date&&t.due_date<todayIso?0:t.due_date===todayIso?1:['urgent','high'].includes(String(t.priority||'').toLowerCase())?2:(t.project_id&&activeProjectIds.has(t.project_id)?3:4);rows.sort((a,b)=>band(a)-band(b)||v112PriorityRank(a.priority)-v112PriorityRank(b.priority)||String(a.due_date||'9999-12-31').localeCompare(String(b.due_date||'9999-12-31'))||Number(a.estimate_minutes||999)-Number(b.estimate_minutes||999));const areas=new Map(data.areas.map(a=>[a.id,a.name])),projects=new Map(data.projects.map(p=>[p.id,p.name]));const staleDays=prefs.attention.stale_project_days,waitDays=prefs.attention.waiting_days,staleCut=Date.now()-staleDays*86400000,waitingCut=Date.now()-waitDays*86400000;const staleProjects=data.projects.filter(p=>p.lifecycle_status==='active'&&new Date(p.last_touched_at||p.updated_at||p.created_at||0).getTime()<staleCut).length;const longWaiting=data.tasks.filter(t=>t.status!=='done'&&String(t.waiting_on||'').trim()&&new Date(t.updated_at||t.created_at||0).getTime()<waitingCut).length;return {stage:'V11.4',criteria:{context:ctx,energy,minutes},items:rows.slice(0,5).map(t=>({...v112TaskLite(t),project_name:projects.get(t.project_id)||'',area_name:areas.get(t.area_id)||'',reasons:v114TaskReasons(t,todayIso,activeProjectIds)})),attention:{stale_projects:staleProjects,long_waiting:longWaiting,stale_project_days:staleDays,waiting_days:waitDays},generated_at:new Date().toISOString()}}
app.get('/api/v11.4/preferences', async (request)=>{const life=await getLifeData(request.user.id);return v114PrefsFromLife(life)})
app.put('/api/v11.4/preferences', async (request)=>{const life=await getLifeData(request.user.id),current=v114PrefsFromLife(life),body=request.body||{};const next={...current,...body,attention:{...current.attention,...(body.attention||{})},dashboard:{...current.dashboard,...(body.dashboard||{})},saved_views:current.saved_views};return v114SavePrefs(request.user.id,next)})
app.post('/api/v11.4/saved-views', async (request,reply)=>{const life=await getLifeData(request.user.id),current=v114PrefsFromLife(life),body=request.body||{},name=String(body.name||'').trim();if(!name)return reply.code(400).send({error:'نام نما الزامی است.'});const row={id:id(),name:name.slice(0,120),filters:body.filters&&typeof body.filters==='object'?body.filters:{},created_at:new Date().toISOString()};return v114SavePrefs(request.user.id,{...current,saved_views:[...(current.saved_views||[]),row]})})
app.delete('/api/v11.4/saved-views/:id', async (request)=>{const life=await getLifeData(request.user.id),current=v114PrefsFromLife(life);return v114SavePrefs(request.user.id,{...current,saved_views:(current.saved_views||[]).filter(v=>v.id!==request.params.id)})})
app.get('/api/v11.4/recommendations', async (request)=>v114Recommendations(request.user.id,request.query||{}))
app.get('/api/v11.4/health', async ()=>({ok:true,stage:'V11.4',storage:hasDatabase?'postgresql':'memory',capabilities:['transparent-next-action-recommendations','context-energy-time-filtering','attention-rules','dashboard-personalization','saved-views','explainable-reasons'],now:new Date().toISOString()}))


// ===== V11.5 Unified Scheduling / Calendar / Timeline =====
function v115DateOnly(value){return String(value||'').slice(0,10)}
function v115EventMeta(notes){try{const x=JSON.parse(String(notes||''));return x&&typeof x==='object'&&x.v115&&typeof x.v115==='object'?x.v115:{}}catch{return {}}}
function v115EntryDate(e){return v115DateOnly(e.start_at||e.due_date)}
function v115InRange(date,from,to){return date&&(!from||date>=from)&&(!to||date<=to)}
function v115TimedOverlap(a,b){if(a.all_day||b.all_day)return false;const as=new Date(a.start_at).getTime(),ae=new Date(a.end_at||a.start_at).getTime(),bs=new Date(b.start_at).getTime(),be=new Date(b.end_at||b.start_at).getTime();return Number.isFinite(as)&&Number.isFinite(ae)&&Number.isFinite(bs)&&Number.isFinite(be)&&as<be&&bs<ae}
function v115FindConflicts(entries){const timed=entries.filter(e=>!e.all_day&&e.start_at&&e.end_at).sort((a,b)=>new Date(a.start_at)-new Date(b.start_at)),out=[];for(let i=0;i<timed.length;i++){for(let j=i+1;j<timed.length;j++){if(v115DateOnly(timed[j].start_at)!==v115DateOnly(timed[i].start_at))break;if(v115TimedOverlap(timed[i],timed[j]))out.push({date:v115DateOnly(timed[i].start_at),a:{id:timed[i].id,title:timed[i].title,start_at:timed[i].start_at,end_at:timed[i].end_at},b:{id:timed[j].id,title:timed[j].title,start_at:timed[j].start_at,end_at:timed[j].end_at}})}}return out.slice(0,30)}
async function v115SchedulePayload(userId,query={}){const data=await getV11Canonical(userId),todayIso=today(),from=String(query.from||todayIso).slice(0,10),to=String(query.to||addDays(6)).slice(0,10),areaMap=new Map(data.areas.map(a=>[a.id,a.name])),projectMap=new Map(data.projects.map(p=>[p.id,p.name]));const entries=[];for(const e of data.events){const date=v115EntryDate(e);if(!v115InRange(date,from,to))continue;const meta=v115EventMeta(e.notes);entries.push({id:e.id,entity_id:e.id,source_type:e.type==='meeting'?'meeting':'event',type:e.type||'personal',title:e.title,start_at:e.start_at,end_at:e.end_at,all_day:false,project_id:e.project_id||null,area_id:e.area_id||null,project_name:projectMap.get(e.project_id)||'',area_name:areaMap.get(e.area_id)||'',task_id:meta.task_id||null,note:meta.note||''})}
for(const t of data.tasks){if(t.status==='done'||!t.due_date||!v115InRange(t.due_date,from,to))continue;entries.push({id:`task-deadline-${t.id}`,entity_id:t.id,source_type:'task',type:'deadline',title:t.title,start_at:`${t.due_date}T23:00:00`,end_at:`${t.due_date}T23:30:00`,all_day:true,project_id:t.project_id||null,area_id:t.area_id||null,project_name:projectMap.get(t.project_id)||'',area_name:areaMap.get(t.area_id)||'',priority:t.priority})}
for(const p of data.projects){if(!p.due_date||p.lifecycle_status==='archived'||!v115InRange(p.due_date,from,to))continue;entries.push({id:`project-deadline-${p.id}`,entity_id:p.id,source_type:'project',type:'project_deadline',title:`موعد پروژه: ${p.name}`,start_at:`${p.due_date}T23:15:00`,end_at:`${p.due_date}T23:30:00`,all_day:true,project_id:p.id,area_id:p.area_id||null,project_name:p.name,area_name:areaMap.get(p.area_id)||''})}
for(const o of data.outcomes||[]){if(!o.due_date||o.status==='done'||!v115InRange(o.due_date,from,to))continue;entries.push({id:`outcome-deadline-${o.id}`,entity_id:o.id,source_type:'outcome',type:'outcome_deadline',title:`موعد هدف: ${o.title}`,start_at:`${o.due_date}T23:20:00`,end_at:`${o.due_date}T23:30:00`,all_day:true,area_id:o.area_id||null,area_name:areaMap.get(o.area_id)||''})}
entries.sort((a,b)=>String(a.start_at).localeCompare(String(b.start_at)));const conflicts=v115FindConflicts(entries),todayCount=entries.filter(e=>v115EntryDate(e)===todayIso).length,meetings=entries.filter(e=>e.type==='meeting').length,deadlines=entries.filter(e=>['deadline','project_deadline','outcome_deadline'].includes(e.type)).length,focusBlocks=entries.filter(e=>e.type==='focus').length;const unscheduled=data.tasks.filter(t=>t.status!=='done'&&!t.due_date&&!String(t.waiting_on||'').trim()).slice(0,20).map(t=>({id:t.id,title:t.title,project_id:t.project_id||null,project_name:projectMap.get(t.project_id)||'',context:t.context||'',energy:t.energy||'',estimate_minutes:t.estimate_minutes||0}));return {stage:'V11.5',range:{from,to},entries,unscheduled,summary:{today_count:todayCount,range_count:entries.length,meetings,deadlines,focus_blocks:focusBlocks,conflicts},references:{projects:data.projects.map(p=>({id:p.id,name:p.name,lifecycle_status:p.lifecycle_status})),areas:data.areas.map(a=>({id:a.id,name:a.name}))},generated_at:new Date().toISOString()}}
app.get('/api/v11.5/schedule',async(request)=>v115SchedulePayload(request.user.id,request.query||{}))
registerCalendar(app,{canonical:getV11Canonical,life:getLifeData,saveLife:persistLifeData,createTask,updateTask,createProject,updateProject,createEvent,updateEvent,deleteEvent,
  createOutcome:async(userId,body)=>{
    if(!hasDatabase)return v117SaveMemoryOutcome(userId,null,body);
    return (await app.pg.query('INSERT INTO outcomes (id,user_id,title,status,due_date,note) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',[id(),userId,body.title,body.status,body.due_date,body.note])).rows[0]
  },
  updateOutcome:async(userId,outcomeId,patch)=>{
    if(!hasDatabase){const life=await getLifeData(userId);await persistLifeData(userId,{...life,goals:life.goals.map(item=>item.id===outcomeId?{...item,...patch}:item)});return}
    const allowed=['title','due_date','status','note'];const keys=Object.keys(patch).filter(key=>allowed.includes(key));if(!keys.length)return;
    await app.pg.query(`UPDATE outcomes SET ${keys.map((key,index)=>`${key}=$${index+1}`).join(',')},updated_at=NOW() WHERE id=$${keys.length+1} AND user_id=$${keys.length+2}`,[...keys.map(key=>patch[key]),outcomeId,userId])
  }
})
app.post('/api/v11.5/schedule/events',async(request,reply)=>{try{return reply.code(201).send(await createEvent(request.user.id,request.body||{}))}catch(error){return reply.code(400).send({error:error.message})}})
app.post('/api/v11.5/schedule/task/:id',async(request,reply)=>{try{const data=await getV11Canonical(request.user.id),task=data.tasks.find(t=>t.id===request.params.id);if(!task)return reply.code(404).send({error:'تسک پیدا نشد.'});const start=String(request.body?.start_at||''),end=String(request.body?.end_at||'');const note=JSON.stringify({v115:{task_id:task.id,note:'Task time block'}});const created=await createEvent(request.user.id,{title:task.title,type:'focus',start_at:start,end_at:end,project_id:task.project_id||null,notes:note,color:'#7165f3'});return reply.code(201).send(created)}catch(error){return reply.code(400).send({error:error.message})}})
app.get('/api/v11.5/health',async()=>({ok:true,stage:'V11.5',storage:hasDatabase?'postgresql':'memory',capabilities:['unified-schedule','today-agenda','week-calendar','month-calendar','timeline-view','task-deadlines','project-milestones','focus-time-blocking','conflict-detection','meeting-and-event-unification'],now:new Date().toISOString()}))

// ===== V11.6 Meetings -> Decisions -> Actions -> Follow-up =====
// Meetings are Events, while structured outcomes live in meeting_details / NOVA_MEETING metadata.
function v116List(value){
  if(Array.isArray(value)) return value.filter(Boolean)
  return String(value||'').split(/\n|،|,/).map(x=>x.trim()).filter(Boolean)
}
function v116NoteMeta(notes=''){
  const raw=String(notes||''),prefix='NOVA_MEETING::'
  if(!raw.startsWith(prefix)) return {summary:raw}
  try{return JSON.parse(raw.slice(prefix.length))||{}}catch{return {summary:raw}}
}
function v116Decision(x,i=0){
  if(typeof x==='string') return {id:`decision-${i}`,text:x,status:'open',owner:'',review_at:null}
  return {id:x?.id||id(),text:String(x?.text||x?.title||'').trim(),status:['open','accepted','revisit','closed'].includes(x?.status)?x.status:'open',owner:String(x?.owner||''),review_at:x?.review_at||null}
}
function v116Action(x,i=0){
  if(typeof x==='string') return {id:`action-${i}`,text:x,owner:'',due_date:null,priority:'medium',status:'open',task_id:null}
  return {id:x?.id||id(),text:String(x?.text||x?.title||'').trim(),owner:String(x?.owner||''),due_date:x?.due_date||null,priority:['high','medium','low'].includes(x?.priority)?x.priority:'medium',status:['open','in_progress','done','cancelled'].includes(x?.status)?x.status:'open',task_id:x?.task_id||null,created_at:x?.created_at||null,completed_at:x?.completed_at||null}
}
function v116Waiting(x,i=0){
  if(typeof x==='string') return {id:`waiting-${i}`,text:x,waiting_on:'',due_date:null,status:'open'}
  return {id:x?.id||id(),text:String(x?.text||x?.title||'').trim(),waiting_on:String(x?.waiting_on||x?.owner||''),due_date:x?.due_date||null,status:['open','resolved','cancelled'].includes(x?.status)?x.status:'open'}
}
function v116MeetingDetails(meeting,taskMap=new Map()){
  const d=meeting.details||{},meta=v116NoteMeta(meeting.notes)
  const decisions=v116List(d.decisions?.length?d.decisions:meta.decisions).map(v116Decision).filter(x=>x.text)
  const rawActions=(Array.isArray(d.action_items)&&d.action_items.length)?d.action_items:(Array.isArray(meta.actions)?meta.actions:v116List(meta.actions))
  const actions=rawActions.map(v116Action).filter(x=>x.text).map(a=>{
    const task=a.task_id?taskMap.get(a.task_id):null
    return task?{...a,status:task.status==='done'?'done':(a.status==='done'?'done':a.status),task_title:task.title,task_status:task.status}:a
  })
  const rawWaiting=(Array.isArray(d.waiting_items)&&d.waiting_items.length)?d.waiting_items:(meta.waiting_items||meta.waiting||[])
  const waiting=v116List(rawWaiting).map(v116Waiting).filter(x=>x.text)
  return {
    unit:String(meta.unit||''),organizer:String(meta.organizer||''),location:String(meta.location||''),
    participants:v116List(d.participants?.length?d.participants:meta.participants),agenda:String(d.agenda||meta.agenda||''),pre_read:String(d.pre_read||meta.pre_read||''),
    summary:String(d.summary||meta.summary||''),decisions,actions,waiting_items:waiting,
    next_meeting_at:d.next_meeting_at||meta.next_meeting_at||null,follow_up_note:String(meta.follow_up_note||meta.notes||''),
    phase:['prepare','meeting','follow_up','closed'].includes(meta.phase)?meta.phase:''
  }
}
function v116MeetingPhase(m,details){
  if(details.phase) return details.phase
  const now=Date.now(),start=new Date(m.start_at).getTime(),end=new Date(m.end_at||m.start_at).getTime()
  if(Number.isFinite(start)&&start>now) return 'prepare'
  const open=details.actions.some(a=>!['done','cancelled'].includes(a.status))||details.waiting_items.some(w=>w.status==='open')||details.decisions.some(d=>['open','revisit'].includes(d.status))
  return open?'follow_up':'closed'
}
async function v116Payload(userId){
  const data=await getV11Canonical(userId),taskMap=new Map(data.tasks.map(t=>[t.id,t])),projectMap=new Map(data.projects.map(p=>[p.id,p.name])),areaMap=new Map(data.areas.map(a=>[a.id,a.name]))
  const items=data.meetings.map(m=>{const details=v116MeetingDetails(m,taskMap),phase=v116MeetingPhase(m,details);return {id:m.id,title:m.title,start_at:m.start_at,end_at:m.end_at,project_id:m.project_id||null,area_id:m.area_id||details.area_id||null,project_name:projectMap.get(m.project_id)||'',area_name:areaMap.get(m.area_id||details.area_id)||'',duration_minutes:Math.max(0,Math.round((new Date(m.end_at)-new Date(m.start_at))/60000)||0),phase,details}}).sort((a,b)=>new Date(b.start_at)-new Date(a.start_at))
  const decisions=[],actions=[],waiting=[]
  for(const m of items){
    m.details.decisions.forEach(d=>decisions.push({...d,meeting_id:m.id,meeting_title:m.title,meeting_at:m.start_at,project_id:m.project_id,project_name:m.project_name}))
    m.details.actions.forEach(a=>actions.push({...a,meeting_id:m.id,meeting_title:m.title,meeting_at:m.start_at,project_id:m.project_id,project_name:m.project_name}))
    m.details.waiting_items.forEach(w=>waiting.push({...w,meeting_id:m.id,meeting_title:m.title,meeting_at:m.start_at,project_id:m.project_id,project_name:m.project_name}))
  }
  const todayIso=today(),now=Date.now(),isOpenAction=a=>!['done','cancelled'].includes(a.status),isOpenDecision=d=>['open','revisit'].includes(d.status)
  const openActions=actions.filter(isOpenAction),overdueActions=openActions.filter(a=>a.due_date&&a.due_date<todayIso),openWaiting=waiting.filter(w=>w.status==='open')
  return {stage:'V11.6',items,summary:{today:items.filter(m=>String(m.start_at).slice(0,10)===todayIso).length,upcoming:items.filter(m=>new Date(m.end_at||m.start_at).getTime()>=now).length,open_actions:openActions.length,overdue_actions:overdueActions.length,open_decisions:decisions.filter(isOpenDecision).length,waiting:openWaiting.length},registers:{actions,decisions,waiting},references:{projects:data.projects.map(p=>({id:p.id,name:p.name,lifecycle_status:p.lifecycle_status,area_id:p.area_id||null})),areas:data.areas.map(a=>({id:a.id,name:a.name,icon:a.icon||'◫'}))},generated_at:new Date().toISOString()}
}
function v116StructuredNotes(body){
  return 'NOVA_MEETING::'+JSON.stringify({unit:String(body.unit||''),organizer:String(body.organizer||''),location:String(body.location||''),participants:v116List(body.participants),agenda:String(body.agenda||''),pre_read:String(body.pre_read||''),summary:String(body.summary||''),decisions:v116List(body.decisions).map(v116Decision).filter(x=>x.text),actions:v116List(body.actions).map(v116Action).filter(x=>x.text),waiting_items:v116List(body.waiting_items).map(v116Waiting).filter(x=>x.text),next_meeting_at:body.next_meeting_at||null,follow_up_note:String(body.follow_up_note||''),phase:String(body.phase||'')})
}
async function v116SetArea(userId,eventId,areaId){
  if(!hasDatabase){const ev=memory.events.find(e=>e.id===eventId);if(ev)ev.area_id=areaId||null;return}
  await app.pg.query('UPDATE planner_events SET area_id=$1,version=COALESCE(version,1)+1,updated_at=NOW() WHERE id=$2 AND user_id=$3',[areaId||null,eventId,userId])
}
async function v116UpsertDetails(userId,eventId,body){
  const participants=v116List(body.participants),decisions=v116List(body.decisions).map(v116Decision).filter(x=>x.text),actions=v116List(body.actions).map(v116Action).filter(x=>x.text),waiting=v116List(body.waiting_items).map(v116Waiting).filter(x=>x.text)
  if(!hasDatabase)return
  await app.pg.query(`INSERT INTO meeting_details (event_id,user_id,area_id,participants,agenda,pre_read,summary,decisions,action_items,waiting_items,next_meeting_at,updated_at)
    VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8::jsonb,$9::jsonb,$10::jsonb,$11,NOW())
    ON CONFLICT (event_id) DO UPDATE SET area_id=EXCLUDED.area_id,participants=EXCLUDED.participants,agenda=EXCLUDED.agenda,pre_read=EXCLUDED.pre_read,summary=EXCLUDED.summary,decisions=EXCLUDED.decisions,action_items=EXCLUDED.action_items,waiting_items=EXCLUDED.waiting_items,next_meeting_at=EXCLUDED.next_meeting_at,updated_at=NOW()`,
    [eventId,userId,body.area_id||null,JSON.stringify(participants),String(body.agenda||''),String(body.pre_read||''),String(body.summary||''),JSON.stringify(decisions),JSON.stringify(actions),JSON.stringify(waiting),body.next_meeting_at||null])
}
async function v116SaveMeeting(userId,meetingId,body){
  const payload={title:String(body.title||'').trim(),type:'meeting',start_at:body.start_at,end_at:body.end_at,color:'#356d70',project_id:body.project_id||null,notes:v116StructuredNotes(body)}
  if(!payload.title)throw new Error('عنوان جلسه الزامی است.')
  const saved=meetingId?await updateEvent(userId,meetingId,payload):await createEvent(userId,payload)
  if(!saved)throw new Error('جلسه پیدا نشد.')
  await v116SetArea(userId,saved.id,body.area_id||null);await v116UpsertDetails(userId,saved.id,body)
  return saved
}
async function v116UpdateMeetingDetail(userId,meetingId,kind,itemId,patch){
  const payload=await v116Payload(userId),meeting=payload.items.find(m=>m.id===meetingId);if(!meeting)return null
  const d=meeting.details
  const key=kind==='action'?'actions':kind==='decision'?'decisions':'waiting_items',rows=(d[key]||[]).map(x=>x.id===itemId?{...x,...patch}:x)
  const body={title:meeting.title,start_at:meeting.start_at,end_at:meeting.end_at,project_id:meeting.project_id,area_id:meeting.area_id,unit:d.unit,organizer:d.organizer,location:d.location,participants:d.participants,agenda:d.agenda,pre_read:d.pre_read,summary:d.summary,decisions:key==='decisions'?rows:d.decisions,actions:key==='actions'?rows:d.actions,waiting_items:key==='waiting_items'?rows:d.waiting_items,next_meeting_at:d.next_meeting_at,follow_up_note:d.follow_up_note,phase:d.phase}
  await v116SaveMeeting(userId,meetingId,body);return {meeting_id:meetingId,item:(rows.find(x=>x.id===itemId)||null)}
}
async function v116SetTaskMeetingMeta(userId,taskId,meetingId){
  if(hasDatabase) await app.pg.query('UPDATE tasks SET source_meeting_id=$1,context=CASE WHEN context=\'\' THEN \'جلسه\' ELSE context END,updated_at=NOW() WHERE id=$2 AND user_id=$3',[meetingId,taskId,userId])
  const life=await getLifeData(userId),execution=normalizeExecution(life.execution||{}),current=execution.task_meta[taskId]||{}
  execution.task_meta[taskId]={...current,source_meeting_id:meetingId,context:current.context||'جلسه',updated_at:new Date().toISOString()};await persistLifeData(userId,{...life,execution:normalizeExecution(execution)})
}
app.get('/api/v11.6/meetings',async(request)=>v116Payload(request.user.id))
app.post('/api/v11.6/meetings',async(request,reply)=>{try{const saved=await v116SaveMeeting(request.user.id,null,request.body||{});return reply.code(201).send({meeting:saved,payload:await v116Payload(request.user.id)})}catch(error){return reply.code(400).send({error:error.message})}})
app.put('/api/v11.6/meetings/:id',async(request,reply)=>{try{const saved=await v116SaveMeeting(request.user.id,request.params.id,request.body||{});return reply.send({meeting:saved,payload:await v116Payload(request.user.id)})}catch(error){return reply.code(400).send({error:error.message})}})
app.post('/api/v11.6/meetings/:id/actions/:actionId/task',async(request,reply)=>{try{const data=await v116Payload(request.user.id),m=data.items.find(x=>x.id===request.params.id);if(!m)return reply.code(404).send({error:'جلسه پیدا نشد.'});const a=m.details.actions.find(x=>x.id===request.params.actionId);if(!a)return reply.code(404).send({error:'اقدام پیدا نشد.'});if(a.task_id)return {task_id:a.task_id,already_linked:true};const description=[`اقدام جلسه: ${m.title}`,a.owner?`مسئول: ${a.owner}`:''].filter(Boolean).join('\n');const task=await createTask(request.user.id,{title:a.text,description,due_date:a.due_date||null,priority:a.priority||'medium',status:a.status==='in_progress'?'in_progress':'todo',project_id:m.project_id||null,category:m.area_name||m.details.unit||'جلسه',tags:['meeting-action']});await v116SetTaskMeetingMeta(request.user.id,task.id,m.id);await v116UpdateMeetingDetail(request.user.id,m.id,'action',a.id,{task_id:task.id,status:task.status==='done'?'done':a.status});return reply.code(201).send({task,payload:await v116Payload(request.user.id)})}catch(error){return reply.code(400).send({error:error.message})}})
app.patch('/api/v11.6/meetings/:id/actions/:actionId',async(request,reply)=>{try{const patch={};for(const k of ['text','owner','due_date','priority','status'])if(request.body?.[k]!==undefined)patch[k]=request.body[k];const data=await v116Payload(request.user.id),m=data.items.find(x=>x.id===request.params.id),a=m?.details.actions.find(x=>x.id===request.params.actionId);if(!a)return reply.code(404).send({error:'اقدام پیدا نشد.'});if(a.task_id&&patch.status){await updateTask(request.user.id,a.task_id,{status:patch.status==='done'?'done':patch.status==='in_progress'?'in_progress':'todo'})}await v116UpdateMeetingDetail(request.user.id,request.params.id,'action',request.params.actionId,{...patch,completed_at:patch.status==='done'?new Date().toISOString():null});return {ok:true,payload:await v116Payload(request.user.id)}}catch(error){return reply.code(400).send({error:error.message})}})
app.patch('/api/v11.6/meetings/:id/decisions/:decisionId',async(request,reply)=>{try{await v116UpdateMeetingDetail(request.user.id,request.params.id,'decision',request.params.decisionId,request.body||{});return {ok:true,payload:await v116Payload(request.user.id)}}catch(error){return reply.code(400).send({error:error.message})}})
app.patch('/api/v11.6/meetings/:id/waiting/:waitingId',async(request,reply)=>{try{await v116UpdateMeetingDetail(request.user.id,request.params.id,'waiting',request.params.waitingId,request.body||{});return {ok:true,payload:await v116Payload(request.user.id)}}catch(error){return reply.code(400).send({error:error.message})}})
app.get('/api/v11.6/health',async()=>({ok:true,stage:'V11.6',storage:hasDatabase?'postgresql':'memory',capabilities:['meeting-workspace','decision-register','action-register','action-to-task','owner-and-due-date','waiting-follow-up','next-meeting','project-area-links','task-completion-sync'],now:new Date().toISOString()}))



// ===== V11.7 Goals, Outcomes & Area Control =====
function v117IsoToday(){ return new Date().toISOString().slice(0,10) }
function v117DaysUntil(iso){ if(!iso)return null; const a=new Date(`${v117IsoToday()}T00:00:00`),b=new Date(`${String(iso).slice(0,10)}T00:00:00`); return Math.round((b-a)/86400000) }
function v117Progress(o={}){
  const target=Number(o.target_value||0),current=Number(o.current_value||0),baseline=Number(o.baseline_value||0),dir=String(o.target_direction||'increase')
  if(dir==='maintain') return null
  if(dir==='decrease'){
    if(baseline>target) return Math.max(0,Math.min(100,Math.round((baseline-current)/(baseline-target)*100)))
    return target>0?Math.max(0,Math.min(100,Math.round(target/Math.max(current,target)*100))):null
  }
  if(target>baseline) return Math.max(0,Math.min(100,Math.round((current-baseline)/(target-baseline)*100)))
  return target>0?Math.max(0,Math.min(100,Math.round(current/target*100))):null
}
function v117OutcomeState(o={}){
  if(['done','archived'].includes(String(o.status||''))) return {state:'done',reason:'تکمیل‌شده'}
  const days=v117DaysUntil(o.due_date),progress=v117Progress(o),hasMeasure=Boolean(Number(o.target_value||0)>0 && String(o.unit||'').trim())
  if(days!==null && days<0) return {state:'risk',reason:'موعد گذشته است'}
  if(!hasMeasure) return {state:'attention',reason:'معیار سنجش کامل نیست'}
  if(!String(o.next_action||'').trim()) return {state:'attention',reason:'Next Action تعریف نشده'}
  if(days!==null && days<=14 && progress!==null && progress<70) return {state:'attention',reason:'موعد نزدیک و فاصله با هدف زیاد است'}
  return {state:'stable',reason:'بر اساس داده‌های فعلی نیاز فوری دیده نمی‌شود'}
}
function v117ExplicitProjectOutcomeLinks(data){
  return (data.links||[]).filter((l)=>l.source_type==='project'&&l.target_type==='outcome'&&l.relation==='advances')
}
function v117OutcomeLite(o,data){
  const links=v117ExplicitProjectOutcomeLinks(data).filter((l)=>l.target_id===o.id),linked=links.map((l)=>data.projects.find((p)=>p.id===l.source_id)).filter(Boolean)
  const state=v117OutcomeState(o)
  return {...o,progress_percent:v117Progress(o),control_state:state.state,control_reason:state.reason,linked_projects:linked.map((p)=>({id:p.id,name:p.name,lifecycle_status:p.lifecycle_status||'active',next_action:p.next_action||''})),linked_project_ids:linked.map((p)=>p.id)}
}
function v117AreaLite(a,data,outcomes){
  const today=v117IsoToday(),openTasks=data.tasks.filter((t)=>t.area_id===a.id&&t.status!=='done'),overdue=openTasks.filter((t)=>t.due_date&&t.due_date<today),waiting=openTasks.filter((t)=>String(t.waiting_on||'').trim())
  const activeProjects=data.projects.filter((p)=>p.area_id===a.id&&p.lifecycle_status==='active'),staleCut=Date.now()-14*86400000,staleProjects=activeProjects.filter((p)=>new Date(p.last_touched_at||p.updated_at||p.created_at||0).getTime()<staleCut),noNext=activeProjects.filter((p)=>!String(p.next_action||'').trim())
  const areaOutcomes=outcomes.filter((o)=>o.area_id===a.id&&!['done','archived'].includes(String(o.status||''))),atRisk=areaOutcomes.filter((o)=>o.control_state==='risk'),attention=areaOutcomes.filter((o)=>o.control_state==='attention')
  const routines=data.routines.filter((r)=>r.area_id===a.id&&r.status!=='paused')
  const reasons=[];if(overdue.length)reasons.push(`${overdue.length} کار عقب‌افتاده`);if(atRisk.length)reasons.push(`${atRisk.length} Outcome در ریسک`);if(noNext.length)reasons.push(`${noNext.length} پروژه بدون Next Action`);if(waiting.length)reasons.push(`${waiting.length} مورد Waiting`);if(attention.length)reasons.push(`${attention.length} Outcome نیازمند توجه`)
  const control_state=(overdue.length||atRisk.length)?'risk':reasons.length?'attention':'stable'
  return {...a,control_state,control_reason:reasons.join(' • ')||'استثنای مهمی دیده نمی‌شود',tasks_open:openTasks.length,tasks_overdue:overdue.length,waiting:waiting.length,projects_active:activeProjects.length,projects_stale:staleProjects.length,projects_without_next_action:noNext.length,outcomes_active:areaOutcomes.length,outcomes_at_risk:atRisk.length,outcomes_attention:attention.length,routines_active:routines.length}
}
async function v117Payload(userId){
  const data=await getV11Canonical(userId),outcomes=data.outcomes.map((o)=>v117OutcomeLite(o,data)),areas=data.areas.map((a)=>v117AreaLite(a,data,outcomes)),activeProjects=data.projects.filter((p)=>p.lifecycle_status==='active'),links=v117ExplicitProjectOutcomeLinks(data),linkedActive=new Set(links.filter((l)=>activeProjects.some((p)=>p.id===l.source_id)).map((l)=>l.source_id))
  const activeOutcomes=outcomes.filter((o)=>!['done','archived','paused'].includes(String(o.status||'')))
  return {stage:'V11.7',summary:{active_outcomes:activeOutcomes.length,outcomes_at_risk:activeOutcomes.filter((o)=>o.control_state==='risk').length,outcomes_attention:activeOutcomes.filter((o)=>o.control_state==='attention').length,project_outcome_coverage:activeProjects.length?Math.round(linkedActive.size/activeProjects.length*100):100,projects_without_outcome:Math.max(0,activeProjects.length-linkedActive.size),areas_attention:areas.filter((a)=>a.control_state!=='stable').length,outcomes_without_project:activeOutcomes.filter((o)=>!o.linked_projects.length).length,outcomes_without_next_action:activeOutcomes.filter((o)=>!String(o.next_action||'').trim()).length},areas,outcomes,projects:activeProjects.map((p)=>({id:p.id,name:p.name,area_id:p.area_id||null,lifecycle_status:p.lifecycle_status||'active',next_action:p.next_action||'',progress:Number(p.progress||0),linked_outcome_ids:links.filter((l)=>l.source_id===p.id).map((l)=>l.target_id)})),generated_at:new Date().toISOString()}
}
async function v117SaveMemoryOutcome(userId,outcomeId,body){
  const life=await getLifeData(userId),data=await getV11Canonical(userId),area=data.areas.find((a)=>a.id===body.area_id),existing=(life.goals||[]).find((g)=>g.id===outcomeId)
  const raw={...(existing||{}),...body,id:outcomeId||id(),area:area?.name||existing?.area||'عمومی',updated_at:new Date().toISOString(),created_at:existing?.created_at||new Date().toISOString()}
  const next=normalizeGoal(raw),goals=existing?(life.goals||[]).map((g)=>g.id===existing.id?next:g):[...(life.goals||[]),next]
  await persistLifeData(userId,{...life,goals});return next
}
app.get('/api/v11.7/control',async(request)=>v117Payload(request.user.id))
app.post('/api/v11.7/outcomes',async(request,reply)=>{try{const body=request.body||{},title=String(body.title||'').trim();if(!title)return reply.code(400).send({error:'عنوان Outcome الزامی است.'});if(!hasDatabase){const saved=await v117SaveMemoryOutcome(request.user.id,null,{...body,title});return reply.code(201).send({outcome:saved,payload:await v117Payload(request.user.id)})}const oid=id();const {rows}=await app.pg.query(`INSERT INTO outcomes (id,user_id,title,area_id,status,target_value,current_value,unit,due_date,next_action,note,metric_name,baseline_value,target_direction,review_at,measurement_note,version) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,1) RETURNING *`,[oid,request.user.id,title,body.area_id||null,body.status||'active',Number(body.target_value||0),Number(body.current_value||0),String(body.unit||''),body.due_date||null,String(body.next_action||''),String(body.note||''),String(body.metric_name||''),Number(body.baseline_value||0),body.target_direction||'increase',body.review_at||null,String(body.measurement_note||'')]);return reply.code(201).send({outcome:rows[0],payload:await v117Payload(request.user.id)})}catch(error){return reply.code(400).send({error:error.message})}})
app.patch('/api/v11.7/outcomes/:id',async(request,reply)=>{try{const body=request.body||{};if(!hasDatabase){const life=await getLifeData(request.user.id);if(!(life.goals||[]).some((g)=>g.id===request.params.id))return reply.code(404).send({error:'Outcome پیدا نشد.'});const saved=await v117SaveMemoryOutcome(request.user.id,request.params.id,body);return {outcome:saved,payload:await v117Payload(request.user.id)}}const cur=(await app.pg.query('SELECT * FROM outcomes WHERE id=$1 AND user_id=$2',[request.params.id,request.user.id])).rows[0];if(!cur)return reply.code(404).send({error:'Outcome پیدا نشد.'});const n={...cur,...body};const {rows}=await app.pg.query(`UPDATE outcomes SET title=$1,area_id=$2,status=$3,target_value=$4,current_value=$5,unit=$6,due_date=$7,next_action=$8,note=$9,metric_name=$10,baseline_value=$11,target_direction=$12,review_at=$13,measurement_note=$14,version=version+1,updated_at=NOW() WHERE id=$15 AND user_id=$16 RETURNING *`,[n.title,n.area_id||null,n.status||'active',Number(n.target_value||0),Number(n.current_value||0),n.unit||'',n.due_date||null,n.next_action||'',n.note||'',n.metric_name||'',Number(n.baseline_value||0),n.target_direction||'increase',n.review_at||null,n.measurement_note||'',request.params.id,request.user.id]);return {outcome:rows[0],payload:await v117Payload(request.user.id)}}catch(error){return reply.code(400).send({error:error.message})}})
app.delete('/api/v11.7/outcomes/:id',async(request,reply)=>{if(!hasDatabase){const life=await getLifeData(request.user.id),exists=(life.goals||[]).some((g)=>g.id===request.params.id);if(!exists)return reply.code(404).send({error:'Outcome پیدا نشد.'});await persistLifeData(request.user.id,{...life,goals:(life.goals||[]).filter((g)=>g.id!==request.params.id)});ensureMemoryV11();memory.v11.links=memory.v11.links.filter((l)=>!(l.target_type==='outcome'&&l.target_id===request.params.id));return {ok:true,payload:await v117Payload(request.user.id)}}const r=await app.pg.query('DELETE FROM outcomes WHERE id=$1 AND user_id=$2 RETURNING id',[request.params.id,request.user.id]);if(!r.rowCount)return reply.code(404).send({error:'Outcome پیدا نشد.'});await app.pg.query(`DELETE FROM entity_links WHERE user_id=$1 AND ((target_type='outcome' AND target_id=$2) OR (source_type='outcome' AND source_id=$2))`,[request.user.id,request.params.id]);return {ok:true,payload:await v117Payload(request.user.id)}})
app.post('/api/v11.7/outcomes/:id/projects/:projectId',async(request,reply)=>{const data=await getV11Canonical(request.user.id);if(!data.outcomes.some((o)=>o.id===request.params.id)||!data.projects.some((p)=>p.id===request.params.projectId))return reply.code(404).send({error:'Outcome یا Project پیدا نشد.'});if(!hasDatabase){ensureMemoryV11();if(!memory.v11.links.some((l)=>l.source_type==='project'&&l.source_id===request.params.projectId&&l.relation==='advances'&&l.target_type==='outcome'&&l.target_id===request.params.id))memory.v11.links.push({id:id(),source_type:'project',source_id:request.params.projectId,relation:'advances',target_type:'outcome',target_id:request.params.id,created_at:new Date().toISOString()})}else await app.pg.query(`INSERT INTO entity_links (id,user_id,source_type,source_id,relation,target_type,target_id) VALUES ($1,$2,'project',$3,'advances','outcome',$4) ON CONFLICT DO NOTHING`,[id(),request.user.id,request.params.projectId,request.params.id]);return {ok:true,payload:await v117Payload(request.user.id)}})
app.delete('/api/v11.7/outcomes/:id/projects/:projectId',async(request)=>{if(!hasDatabase){ensureMemoryV11();memory.v11.links=memory.v11.links.filter((l)=>!(l.source_type==='project'&&l.source_id===request.params.projectId&&l.relation==='advances'&&l.target_type==='outcome'&&l.target_id===request.params.id))}else await app.pg.query(`DELETE FROM entity_links WHERE user_id=$1 AND source_type='project' AND source_id=$2 AND relation='advances' AND target_type='outcome' AND target_id=$3`,[request.user.id,request.params.projectId,request.params.id]);return {ok:true,payload:await v117Payload(request.user.id)}})
app.get('/api/v11.7/health',async()=>({ok:true,stage:'V11.7',storage:hasDatabase?'postgresql':'memory',capabilities:['measurable-outcomes','area-exception-control','project-outcome-links','alignment-coverage','transparent-risk-rules','no-global-life-percentage'],now:new Date().toISOString()}))

app.get('/api/v11/areas', async (request) => (await getV11Canonical(request.user.id)).areas)
app.post('/api/v11/areas', async (request, reply) => {
  const name=String(request.body?.name||'').trim(); if(!name)return reply.code(400).send({error:'نام حوزه الزامی است.'})
  const area={id:id(),name,description:String(request.body?.description||''),icon:String(request.body?.icon||'◫').slice(0,2),status:'active',standard:String(request.body?.standard||''),created_at:new Date().toISOString(),updated_at:new Date().toISOString()}
  if(!hasDatabase){ensureMemoryV11();memory.v11.areas.push(area)}else await app.pg.query('INSERT INTO areas (id,user_id,name,description,icon,status,standard) VALUES ($1,$2,$3,$4,$5,$6,$7)',[area.id,request.user.id,area.name,area.description,area.icon,area.status,area.standard])
  return reply.code(201).send(area)
})
app.patch('/api/v11/areas/:id', async (request, reply) => {
  if(!hasDatabase){ensureMemoryV11();const i=memory.v11.areas.findIndex((x)=>x.id===request.params.id);if(i<0)return reply.code(404).send({error:'حوزه پیدا نشد.'});memory.v11.areas[i]={...memory.v11.areas[i],...(request.body||{}),id:request.params.id,updated_at:new Date().toISOString()};return memory.v11.areas[i]}
  const {rows}=await app.pg.query(`UPDATE areas SET name=COALESCE($1,name),description=COALESCE($2,description),icon=COALESCE($3,icon),standard=COALESCE($4,standard),status=COALESCE($5,status),updated_at=NOW() WHERE id=$6 AND user_id=$7 RETURNING *`,[request.body?.name??null,request.body?.description??null,request.body?.icon??null,request.body?.standard??null,request.body?.status??null,request.params.id,request.user.id]);return rows[0]||reply.code(404).send({error:'حوزه پیدا نشد.'})
})

app.get('/api/v11/resources', async (request) => (await getV11Canonical(request.user.id)).resources)
app.post('/api/v11/resources', async (request, reply) => {
  const title=String(request.body?.title||'').trim();if(!title)return reply.code(400).send({error:'عنوان منبع الزامی است.'})
  const resource={id:id(),title,area_id:request.body?.area_id||null,resource_type:String(request.body?.resource_type||'note'),status:String(request.body?.status||'backlog'),url:String(request.body?.url||''),note:String(request.body?.note||''),created_at:new Date().toISOString(),updated_at:new Date().toISOString()}
  if(!hasDatabase){ensureMemoryV11();memory.v11.resources.unshift(resource)}else await app.pg.query(`INSERT INTO resources (id,user_id,title,area_id,resource_type,status,url,note) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,[resource.id,request.user.id,resource.title,resource.area_id,resource.resource_type,resource.status,resource.url,resource.note])
  return reply.code(201).send(resource)
})
app.patch('/api/v11/resources/:id', async (request, reply) => {
  if(!hasDatabase){ensureMemoryV11();const i=memory.v11.resources.findIndex((x)=>x.id===request.params.id);if(i<0)return reply.code(404).send({error:'منبع پیدا نشد.'});memory.v11.resources[i]={...memory.v11.resources[i],...(request.body||{}),id:request.params.id,updated_at:new Date().toISOString()};return memory.v11.resources[i]}
  const cur=(await app.pg.query('SELECT * FROM resources WHERE id=$1 AND user_id=$2',[request.params.id,request.user.id])).rows[0];if(!cur)return reply.code(404).send({error:'منبع پیدا نشد.'});const n={...cur,...request.body};const {rows}=await app.pg.query(`UPDATE resources SET title=$1,area_id=$2,resource_type=$3,status=$4,url=$5,note=$6,updated_at=NOW() WHERE id=$7 AND user_id=$8 RETURNING *`,[n.title,n.area_id||null,n.resource_type,n.status,n.url||'',n.note||'',request.params.id,request.user.id]);return rows[0]
})

app.get('/api/v11/links', async (request) => (await getV11Canonical(request.user.id)).links)
app.post('/api/v11/links', async (request, reply) => {
  const x={id:id(),source_type:String(request.body?.source_type||''),source_id:request.body?.source_id,target_type:String(request.body?.target_type||''),target_id:request.body?.target_id,relation:String(request.body?.relation||'related_to'),created_at:new Date().toISOString()}
  if(!x.source_type||!x.source_id||!x.target_type||!x.target_id)return reply.code(400).send({error:'دو موجودیت برای لینک لازم است.'})
  if(!hasDatabase){ensureMemoryV11();memory.v11.links.push(x)}else await app.pg.query(`INSERT INTO entity_links (id,user_id,source_type,source_id,relation,target_type,target_id) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING`,[x.id,request.user.id,x.source_type,x.source_id,x.relation,x.target_type,x.target_id])
  return reply.code(201).send(x)
})
app.delete('/api/v11/links/:id', async (request, reply) => { if(!hasDatabase){ensureMemoryV11();memory.v11.links=memory.v11.links.filter((x)=>x.id!==request.params.id);return {ok:true}};await app.pg.query('DELETE FROM entity_links WHERE id=$1 AND user_id=$2',[request.params.id,request.user.id]);return {ok:true} })

app.patch('/api/v11/tasks/:id', async (request, reply) => {
  const taskId=request.params.id, life=await getLifeData(request.user.id), meta=life.execution?.task_meta?.[taskId]||{}
  const taskPatch={}, metaPatch={}
  for(const key of ['title','description','due_date','priority','status','estimate_minutes','project_id','category']) if(request.body?.[key]!==undefined) taskPatch[key]=request.body[key]
  for(const key of ['context','energy','waiting_on','resume_note','source_meeting_id','area_id']) if(request.body?.[key]!==undefined) metaPatch[key]=request.body[key]
  let updated=Object.keys(taskPatch).length?await updateTask(request.user.id,taskId,taskPatch):(await listTasks(request.user.id)).find((x)=>x.id===taskId)
  if(!updated)return reply.code(404).send({error:'تسک پیدا نشد.'})
  if(!hasDatabase){
    const ex=normalizeExecution(life.execution||{});ex.task_meta[taskId]={...meta,...metaPatch,updated_at:new Date().toISOString()};await persistLifeData(request.user.id,{...life,execution:ex});
    if(metaPatch.area_id){ensureMemoryV11();const a=memory.v11.areas.find((x)=>x.id===metaPatch.area_id);if(a){const i=memory.tasks.findIndex((x)=>x.id===taskId);if(i>=0)memory.tasks[i].category=a.name}}
  }else{
    const sets=[],vals=[];const add=(col,val)=>{vals.push(val);sets.push(`${col}=$${vals.length}`)}
    for(const [k,v] of Object.entries(metaPatch)){if(['context','energy','waiting_on','resume_note','source_meeting_id','area_id'].includes(k))add(k,v||null)}
    if(sets.length){vals.push(taskId,request.user.id);await app.pg.query(`UPDATE tasks SET ${sets.join(',')},version=version+1,updated_at=NOW() WHERE id=$${vals.length-1} AND user_id=$${vals.length}`,vals)}
  }
  const data=await getV11Canonical(request.user.id);return data.tasks.find((x)=>x.id===taskId)
})

app.patch('/api/v11/projects/:id', async (request, reply) => {
  const projectId=request.params.id
  const baseKeys=['name','description','due_date','color','icon','status'];const base={};for(const k of baseKeys)if(request.body?.[k]!==undefined)base[k]=request.body[k]
  let updated=Object.keys(base).length?await updateProject(request.user.id,projectId,base):(await listProjects(request.user.id)).find((x)=>x.id===projectId)
  if(!updated)return reply.code(404).send({error:'پروژه پیدا نشد.'})
  const metaKeys=['area_id','outcome','lifecycle_status','review_at'];const patch={};for(const k of metaKeys)if(request.body?.[k]!==undefined)patch[k]=request.body[k]
  if(!hasDatabase){ensureMemoryV11();memory.v11.project_meta[projectId]={...(memory.v11.project_meta[projectId]||{}),...patch,last_touched_at:new Date().toISOString()}}
  else if(Object.keys(patch).length){const cur=(await app.pg.query('SELECT * FROM projects WHERE id=$1 AND user_id=$2',[projectId,request.user.id])).rows[0];const n={...cur,...patch};await app.pg.query(`UPDATE projects SET area_id=$1,outcome=$2,lifecycle_status=$3,review_at=$4,last_touched_at=NOW(),version=version+1 WHERE id=$5 AND user_id=$6`,[n.area_id||null,n.outcome||'',n.lifecycle_status||'active',n.review_at||null,projectId,request.user.id])}
  const data=await getV11Canonical(request.user.id);return data.projects.find((x)=>x.id===projectId)
})

app.get('/api/v11/inspector/:type/:id', async (request, reply) => {
  const data=await getV11Canonical(request.user.id), type=String(request.params.type), entityId=request.params.id
  const entity=v11EntityMap(data,type).find((x)=>x.id===entityId || (type==='meeting'&&x.event_id===entityId))
  if(!entity)return reply.code(404).send({error:`${v11Label(type)} پیدا نشد.`})
  const linked=data.links.filter((l)=>(l.source_type===type&&l.source_id===entityId)||(l.target_type===type&&l.target_id===entityId)).map((l)=>{
    const outward=l.source_type===type&&l.source_id===entityId
    const otherType=outward?l.target_type:l.source_type, otherId=outward?l.target_id:l.source_id
    const other=v11EntityMap(data,otherType).find((x)=>x.id===otherId)
    return {...l,direction:outward?'out':'in',other_type:otherType,other:other||{id:otherId,title:'رکورد مرتبط'}}
  })
  return {type,entity,linked}
})

app.get('/api/health', async () => ({ ok: true, release: RELEASE_VERSION, stage: RELEASE_STAGE, release_name: RELEASE_NAME, storage: hasDatabase ? 'postgresql' : 'memory', now: new Date().toISOString() }))

app.get('/api/release', async () => ({
  name: 'NOVA Personal Operating System',
  release: RELEASE_VERSION,
  stage: RELEASE_STAGE,
  release_name: RELEASE_NAME,
  main_roadmap_stages_complete: 16,
  storage: hasDatabase ? 'postgresql' : 'memory',
  runtime_acceptance: 'run npm run smoke after npm install',
  now: new Date().toISOString()
}))

app.get('/api/bootstrap', async (request) => {
  const userId = request.user.id
  const [tasks, projects, activity, events, settings] = await Promise.all([listTasks(userId), listProjects(userId), listActivity(userId), listEvents(userId), listSettings(userId)])
  const life = await getLifeData(userId)
  return { tasks, projects, activity, events, settings, ...life, stats: buildStats(tasks, projects, events, life) }
})

app.get('/api/tasks', async (request) => listTasks(request.user.id))
app.post('/api/tasks', { schema: { body: { ...taskBodySchema, required: ['title'] } } }, async (request, reply) => {
  try { return reply.code(201).send(await createTask(request.user.id, request.body)) } catch (error) { return reply.code(400).send({ error: error.message }) }
})
app.patch('/api/tasks/:id', { schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string', minLength: 1 } } }, body: taskBodySchema } }, async (request, reply) => {
  try {
    const result = await updateTask(request.user.id, request.params.id, request.body)
    return result ? result : reply.code(404).send({ error: 'تسک پیدا نشد.' })
  } catch (error) { return reply.code(400).send({ error: error.message }) }
})
app.delete('/api/tasks/:id', async (request, reply) => {
  const taskId = request.params.id
  if (!hasDatabase) {
    const index = memory.tasks.findIndex((task) => task.id === taskId)
    if (index < 0) return reply.code(404).send({ error: 'تسک پیدا نشد.' })
    const [removed] = memory.tasks.splice(index, 1)
    await addActivity('assistant', `تسک «${removed.title}» حذف شد.`)
    return { ok: true }
  }
  const result = await app.pg.query('DELETE FROM tasks WHERE id=$1 AND user_id=$2 RETURNING title', [taskId, request.user.id])
  if (!result.rowCount) return reply.code(404).send({ error: 'تسک پیدا نشد.' })
  await addActivity(request.user.id, 'assistant', `تسک «${result.rows[0].title}» حذف شد.`)
  return { ok: true }
})


// NOVA V10.2 — execution metadata, focus sessions and ready-to-resume state.
app.get('/api/execution', async (request) => (await getLifeData(request.user.id)).execution)
app.patch('/api/execution/tasks/:id', async (request, reply) => {
  const taskId = request.params.id
  if (!(await listTasks(request.user.id)).some((task) => task.id === taskId)) return reply.code(404).send({ error: 'تسک پیدا نشد.' })
  const life = await getLifeData(request.user.id)
  const execution = normalizeExecution(life.execution || {})
  const current = execution.task_meta[taskId] || {}
  const allowed = ['context','energy','waiting_on','resume_note','blocked_on','source_meeting_id']
  const patch = Object.fromEntries(Object.entries(request.body || {}).filter(([key]) => allowed.includes(key)))
  execution.task_meta[taskId] = { ...current, ...patch, updated_at: new Date().toISOString() }
  const next = { ...life, execution: normalizeExecution(execution) }
  await persistLifeData(request.user.id, next)
  return { task_id: taskId, meta: next.execution.task_meta[taskId], execution: next.execution }
})
app.post('/api/execution/focus/start', async (request, reply) => {
  const taskId = String(request.body?.task_id || '')
  if (!(await listTasks(request.user.id)).some((task) => task.id === taskId)) return reply.code(404).send({ error: 'تسک انتخاب‌شده پیدا نشد.' })
  const life = await getLifeData(request.user.id)
  const execution = normalizeExecution(life.execution || {})
  execution.current_focus = { task_id: taskId, started_at: new Date().toISOString(), planned_minutes: Math.max(5, Math.min(240, Number(request.body?.planned_minutes) || 25)) }
  const next = { ...life, execution: normalizeExecution(execution) }
  await persistLifeData(request.user.id, next)
  return { execution: next.execution }
})
app.post('/api/execution/focus/stop', async (request, reply) => {
  const life = await getLifeData(request.user.id)
  const execution = normalizeExecution(life.execution || {})
  const current = execution.current_focus
  if (!current?.task_id) return reply.code(409).send({ error: 'جلسه تمرکز فعالی وجود ندارد.' })
  const ended = new Date()
  const started = new Date(current.started_at)
  const elapsed = Number.isNaN(started.getTime()) ? 0 : Math.max(0, Math.round((ended - started) / 60000))
  const session = { id: id(), task_id: current.task_id, started_at: current.started_at, ended_at: ended.toISOString(), planned_minutes: current.planned_minutes, elapsed_minutes: elapsed, summary: String(request.body?.summary || ''), resume_note: String(request.body?.resume_note || ''), blocked_on: String(request.body?.blocked_on || '') }
  execution.focus_sessions.push(session)
  const meta = execution.task_meta[current.task_id] || {}
  execution.task_meta[current.task_id] = { ...meta, resume_note: session.resume_note, blocked_on: session.blocked_on, waiting_on: session.blocked_on || meta.waiting_on || '', updated_at: ended.toISOString() }
  execution.current_focus = null
  const next = { ...life, execution: normalizeExecution(execution) }
  await persistLifeData(request.user.id, next)
  await addActivity(request.user.id, 'focus', `جلسه تمرکز ${elapsed} دقیقه‌ای ثبت شد.`)
  return { session, execution: next.execution }
})

app.get('/api/projects', async (request) => listProjects(request.user.id))
app.post('/api/projects', { schema: { body: { ...projectBodySchema, required: ['name'] } } }, async (request, reply) => {
  try { return reply.code(201).send(await createProject(request.user.id, request.body)) } catch (error) { return reply.code(400).send({ error: error.message }) }
})
app.patch('/api/projects/:id', { schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string', minLength: 1 } } }, body: projectBodySchema } }, async (request, reply) => {
  try {
    const result = await updateProject(request.user.id, request.params.id, request.body)
    return result ? result : reply.code(404).send({ error: 'پروژه پیدا نشد.' })
  } catch (error) { return reply.code(400).send({ error: error.message }) }
})
app.delete('/api/projects/:id', async (request, reply) => {
  const projectId = request.params.id
  if (!hasDatabase) {
    const index = memory.projects.findIndex((project) => project.id === projectId)
    if (index < 0) return reply.code(404).send({ error: 'پروژه پیدا نشد.' })
    const [removed] = memory.projects.splice(index, 1)
    memory.tasks = memory.tasks.map((task) => task.project_id === projectId ? { ...task, project_id: null } : task)
    memory.events = memory.events.map((event) => event.project_id === projectId ? { ...event, project_id: null } : event)
    await addActivity('project', `پروژه «${removed.name}» حذف شد.`)
    return { ok: true }
  }
  const result = await app.pg.query('DELETE FROM projects WHERE id=$1 AND user_id=$2 RETURNING name', [projectId, request.user.id])
  if (!result.rowCount) return reply.code(404).send({ error: 'پروژه پیدا نشد.' })
  await addActivity(request.user.id, 'project', `پروژه «${result.rows[0].name}» حذف شد.`)
  return { ok: true }
})

app.get('/api/events', async (request) => listEvents(request.user.id, request.query?.from, request.query?.to))
app.post('/api/events', { schema: { body: { ...eventBodySchema, required: ['title'] } } }, async (request, reply) => {
  try { return reply.code(201).send(await createEvent(request.user.id, request.body)) } catch (error) { return reply.code(400).send({ error: error.message }) }
})
app.patch('/api/events/:id', { schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string', minLength: 1 } } }, body: eventBodySchema } }, async (request, reply) => {
  try {
    const result = await updateEvent(request.user.id, request.params.id, request.body)
    return result ? result : reply.code(404).send({ error: 'رویداد پیدا نشد.' })
  } catch (error) { return reply.code(400).send({ error: error.message }) }
})
app.delete('/api/events/:id', async (request, reply) => {
  const deleted = await deleteEvent(request.user.id, request.params.id)
  return deleted ? { ok: true } : reply.code(404).send({ error: 'رویداد پیدا نشد.' })
})

app.get('/api/life', async (request) => getLifeData(request.user.id))
app.get('/api/goals', async (request) => (await getLifeData(request.user.id)).goals || [])
app.post('/api/goals', { schema: { body: { ...goalBodySchema, required: ['title'] } } }, async (request, reply) => {
  try {
    const items = await updateLifeCollection(request.user.id, 'goals', request.body || {})
    return reply.code(201).send(items[items.length - 1])
  } catch (error) { return reply.code(400).send({ error: error.message }) }
})
app.patch('/api/goals/:id', { schema: { params: idParamsSchema, body: goalBodySchema } }, async (request, reply) => {
  const life = await getLifeData(request.user.id)
  const index = (life.goals || []).findIndex((item) => item.id === request.params.id)
  if (index < 0) return reply.code(404).send({ error: 'هدف پیدا نشد.' })
  const next = normalizeGoal({ ...life.goals[index], ...(request.body || {}), id: request.params.id, created_at: life.goals[index].created_at })
  await persistLifeData(request.user.id, { ...life, goals: life.goals.map((item, itemIndex) => itemIndex === index ? next : item) })
  await addActivity(request.user.id, 'goal', `هدف «${next.title}» به‌روزرسانی شد.`)
  return next
})
app.delete('/api/goals/:id', { schema: { params: idParamsSchema } }, async (request, reply) => {
  const life = await getLifeData(request.user.id)
  const removed = (life.goals || []).find((item) => item.id === request.params.id)
  if (!removed) return reply.code(404).send({ error: 'هدف پیدا نشد.' })
  await persistLifeData(request.user.id, { ...life, goals: life.goals.filter((item) => item.id !== request.params.id) })
  await addActivity(request.user.id, 'goal', `هدف «${removed.title}» حذف شد.`)
  return { ok: true }
})

app.get('/api/habits', async (request) => (await getV11Canonical(request.user.id)).routines || [])
app.post('/api/habits', { schema: { body: { ...habitBodySchema, required: ['title'] } } }, async (request, reply) => {
  try {
    const items = await updateLifeCollection(request.user.id, 'habits', request.body || {})
    return reply.code(201).send(items[items.length - 1])
  } catch (error) { return reply.code(400).send({ error: error.message }) }
})
app.patch('/api/habits/:id', { schema: { params: idParamsSchema, body: habitBodySchema } }, async (request, reply) => {
  const life = await getLifeData(request.user.id)
  const index = (life.habits || []).findIndex((item) => item.id === request.params.id)
  if (index < 0) {
    const routine = (await getV11Canonical(request.user.id)).routines.find(item => item.id === request.params.id)
    if (!routine) return reply.code(404).send({ error: 'عادت پیدا نشد.' })
    const next = { ...routine, ...normalizeHabit({ ...routine, ...request.body, id: routine.id, updated_at: new Date().toISOString() }) }
    if (!hasDatabase) {
      const position = memory.v11.spiritual_routines.findIndex(item => item.id === routine.id)
      memory.v11.spiritual_routines[position] = next
    } else {
      await app.pg.query('UPDATE routines SET title=$1,description=$2,target_weekly=$3,color=$4,status=$5,updated_at=NOW() WHERE id=$6 AND user_id=$7', [next.title,next.description,next.target_weekly,next.color,next.status,next.id,request.user.id])
      if (request.body.logs) {
        await app.pg.query('DELETE FROM routine_logs WHERE routine_id=$1 AND user_id=$2', [next.id,request.user.id])
        for (const [date,value] of Object.entries(next.logs)) await setCanonicalRoutineLog(request.user.id,next,date,value)
      }
    }
    return next
  }
  const next = normalizeHabit({ ...life.habits[index], ...(request.body || {}), id: request.params.id, created_at: life.habits[index].created_at })
  await persistLifeData(request.user.id, { ...life, habits: life.habits.map((item, itemIndex) => itemIndex === index ? next : item) })
  await addActivity(request.user.id, 'habit', `عادت «${next.title}» به‌روزرسانی شد.`)
  return next
})
app.post('/api/habits/:id/toggle', { schema: { params: idParamsSchema, body: { type: 'object', additionalProperties: false, properties: { date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' } } } } }, async (request, reply) => {
  const life = await getLifeData(request.user.id)
  const index = (life.habits || []).findIndex((item) => item.id === request.params.id)
  if (index < 0) {
    const routine=(await getV11Canonical(request.user.id)).routines.find(item=>item.id===request.params.id)
    if(!routine)return reply.code(404).send({error:'عادت پیدا نشد.'})
    const date=request.body?.date||today()
    return setCanonicalRoutineLog(request.user.id,routine,date,!Boolean(routine.logs?.[date]))
  }
  const date = request.body?.date || today()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return reply.code(400).send({ error: 'تاریخ ثبت عادت معتبر نیست.' })
  const habit = { ...life.habits[index], logs: { ...(life.habits[index].logs || {}) } }
  habit.logs[date] = !habit.logs[date]
  const normalized = normalizeHabit({ ...habit, id: habit.id, created_at: habit.created_at })
  await persistLifeData(request.user.id, { ...life, habits: life.habits.map((item, itemIndex) => itemIndex === index ? normalized : item) })
  return normalized
})
app.delete('/api/habits/:id', { schema: { params: idParamsSchema } }, async (request, reply) => {
  const life = await getLifeData(request.user.id)
  const removed = (life.habits || []).find((item) => item.id === request.params.id)
  if (!removed) {
    const routine = (await getV11Canonical(request.user.id)).routines.find(item => item.id === request.params.id)
    if (!routine) return reply.code(404).send({ error: 'عادت پیدا نشد.' })
    // Remove the legacy source too, otherwise lazy migration recreates the routine.
    const modules = { ...life.modules, spiritual: (life.modules.spiritual || []).filter(item => item.id !== routine.id) }
    await persistLifeData(request.user.id, { ...life, modules })
    if (!hasDatabase) {
      memory.v11.spiritual_routines = (memory.v11.spiritual_routines || []).filter(item => item.id !== routine.id)
      delete memory.v11.spiritual_details?.[routine.id]
    } else await app.pg.query('DELETE FROM routines WHERE id=$1 AND user_id=$2', [routine.id,request.user.id])
    return { ok: true }
  }
  await persistLifeData(request.user.id, { ...life, habits: life.habits.filter((item) => item.id !== request.params.id) })
  await addActivity(request.user.id, 'habit', `عادت «${removed.title}» حذف شد.`)
  return { ok: true }
})

app.get('/api/weekly-plan', async (request) => (await getLifeData(request.user.id)).weekly_plan || [])
app.post('/api/weekly-plan', { schema: { body: { ...weeklyBodySchema, required: ['title', 'day', 'start', 'end'] } } }, async (request, reply) => {
  try {
    const items = await updateLifeCollection(request.user.id, 'weekly_plan', request.body || {})
    return reply.code(201).send(items[items.length - 1])
  } catch (error) { return reply.code(400).send({ error: error.message }) }
})
app.patch('/api/weekly-plan/:id', { schema: { params: idParamsSchema, body: weeklyBodySchema } }, async (request, reply) => {
  const updated = await updateLifeItem(request.user.id, 'weekly_plan', request.params.id, request.body || {})
  return updated || reply.code(404).send({ error: 'آیتم برنامه پیدا نشد.' })
})
app.delete('/api/weekly-plan/:id', { schema: { params: idParamsSchema } }, async (request, reply) => {
  const removed = await deleteLifeItem(request.user.id, 'weekly_plan', request.params.id)
  return removed ? { ok: true } : reply.code(404).send({ error: 'آیتم برنامه پیدا نشد.' })
})

app.get('/api/daily-logs', async (request) => (await getLifeData(request.user.id)).daily_logs || [])
app.post('/api/daily-logs', { schema: { body: { ...journalBodySchema, required: ['date'] } } }, async (request, reply) => {
  try {
    const items = await updateLifeCollection(request.user.id, 'daily_logs', request.body || {})
    return reply.code(201).send(items[items.length - 1])
  } catch (error) { return reply.code(400).send({ error: error.message }) }
})
app.patch('/api/daily-logs/:id', { schema: { params: idParamsSchema, body: journalBodySchema } }, async (request, reply) => {
  const updated = await updateLifeItem(request.user.id, 'daily_logs', request.params.id, request.body || {})
  return updated || reply.code(404).send({ error: 'یادداشت روزانه پیدا نشد.' })
})
app.delete('/api/daily-logs/:id', { schema: { params: idParamsSchema } }, async (request, reply) => {
  const removed = await deleteLifeItem(request.user.id, 'daily_logs', request.params.id)
  return removed ? { ok: true } : reply.code(404).send({ error: 'یادداشت روزانه پیدا نشد.' })
})

app.get('/api/ideas', async (request) => (await getLifeData(request.user.id)).ideas || [])
app.post('/api/ideas', { schema: { body: { ...ideaBodySchema, required: ['title'] } } }, async (request, reply) => {
  try {
    const items = await updateLifeCollection(request.user.id, 'ideas', request.body || {})
    return reply.code(201).send(items[items.length - 1])
  } catch (error) { return reply.code(400).send({ error: error.message }) }
})
app.patch('/api/ideas/:id', { schema: { params: idParamsSchema, body: ideaBodySchema } }, async (request, reply) => {
  const updated = await updateLifeItem(request.user.id, 'ideas', request.params.id, request.body || {})
  return updated || reply.code(404).send({ error: 'ایده پیدا نشد.' })
})
app.delete('/api/ideas/:id', { schema: { params: idParamsSchema } }, async (request, reply) => {
  const removed = await deleteLifeItem(request.user.id, 'ideas', request.params.id)
  return removed ? { ok: true } : reply.code(404).send({ error: 'ایده پیدا نشد.' })
})

app.get('/api/finance', async (request) => (await getLifeData(request.user.id)).finance || { accounts: [], transactions: [], debts: [] })
app.post('/api/finance/transactions', async (request, reply) => {
  const life = await getLifeData(request.user.id)
  const body = request.body || {}
  const amount = Number(body.amount)
  if (!Number.isFinite(amount) || amount <= 0) return reply.code(400).send({ error: 'مبلغ تراکنش باید بزرگ‌تر از صفر باشد.' })
  if (!['income', 'expense'].includes(body.type)) return reply.code(400).send({ error: 'نوع تراکنش نامعتبر است.' })
  const transaction = { ...body, id: body.id || id(), date: body.date || today(), amount, type: body.type, status: body.status || 'confirmed', currency: body.currency || 'IRR' }
  await persistLifeData(request.user.id, { ...life, finance: { ...(life.finance || {}), transactions: [...(life.finance?.transactions || []), transaction] } })
  await addActivity(request.user.id, 'finance', `تراکنش «${transaction.description || 'بدون عنوان'}» ثبت شد.`)
  return reply.code(201).send(transaction)
})
app.patch('/api/finance/transactions/:id', async (request, reply) => {
  const life = await getLifeData(request.user.id)
  const index = (life.finance?.transactions || []).findIndex((item) => item.id === request.params.id)
  if (index < 0) return reply.code(404).send({ error: 'تراکنش پیدا نشد.' })
  const next = { ...life.finance.transactions[index], ...(request.body || {}), id: request.params.id, updated_at: new Date().toISOString() }
  await persistLifeData(request.user.id, { ...life, finance: { ...life.finance, transactions: life.finance.transactions.map((item, itemIndex) => itemIndex === index ? next : item) } })
  return next
})
app.delete('/api/finance/transactions/:id', async (request, reply) => {
  const life = await getLifeData(request.user.id)
  const transactions = life.finance?.transactions || []
  const removed = transactions.find((item) => item.id === request.params.id)
  if (!removed) return reply.code(404).send({ error: 'تراکنش پیدا نشد.' })
  await persistLifeData(request.user.id, { ...life, finance: { ...life.finance, transactions: transactions.filter((item) => item.id !== request.params.id) } })
  return { ok: true }
})
app.post('/api/finance/accounts', async (request, reply) => {
  const life = await getLifeData(request.user.id)
  const body = request.body || {}
  if (!String(body.name || '').trim()) return reply.code(400).send({ error: 'نام حساب الزامی است.' })
  const account = { ...body, name: String(body.name).trim(), id: body.id || id(), balance: Number(body.balance) || 0, currency: body.currency || 'IRR', status: body.status || 'active' }
  await persistLifeData(request.user.id, { ...life, finance: { ...(life.finance || {}), accounts: [...(life.finance?.accounts || []), account] } })
  return reply.code(201).send(account)
})
app.patch('/api/finance/accounts/:id', async (request, reply) => {
  const life = await getLifeData(request.user.id)
  const accounts = life.finance?.accounts || []
  const index = accounts.findIndex((item) => item.id === request.params.id)
  if (index < 0) return reply.code(404).send({ error: 'حساب پیدا نشد.' })
  const body = request.body || {}
  const name = String(body.name ?? accounts[index].name ?? '').trim()
  if (!name) return reply.code(400).send({ error: 'نام حساب الزامی است.' })
  const next = { ...accounts[index], ...body, id: request.params.id, name, balance: Number(body.balance ?? accounts[index].balance) || 0, updated_at: new Date().toISOString() }
  await persistLifeData(request.user.id, { ...life, finance: { ...life.finance, accounts: accounts.map((item, itemIndex) => itemIndex === index ? next : item) } })
  return next
})
app.delete('/api/finance/accounts/:id', async (request, reply) => {
  const life = await getLifeData(request.user.id)
  const accounts = life.finance?.accounts || []
  if (!accounts.some((item) => item.id === request.params.id)) return reply.code(404).send({ error: 'حساب پیدا نشد.' })
  await persistLifeData(request.user.id, { ...life, finance: { ...life.finance, accounts: accounts.filter((item) => item.id !== request.params.id) } })
  return { ok: true }
})
app.post('/api/finance/debts', async (request, reply) => {
  const life = await getLifeData(request.user.id)
  const debt = { ...(request.body || {}), id: request.body?.id || id() }
  await persistLifeData(request.user.id, { ...life, finance: { ...(life.finance || {}), debts: [...(life.finance?.debts || []), debt] } })
  return reply.code(201).send(debt)
})
app.patch('/api/finance/debts/:id', async (request, reply) => {
  const life = await getLifeData(request.user.id)
  const debts = life.finance?.debts || []
  const index = debts.findIndex((item) => item.id === request.params.id)
  if (index < 0) return reply.code(404).send({ error: 'بدهی پیدا نشد.' })
  const next = { ...debts[index], ...(request.body || {}), id: request.params.id, updated_at: new Date().toISOString() }
  await persistLifeData(request.user.id, { ...life, finance: { ...life.finance, debts: debts.map((item, itemIndex) => itemIndex === index ? next : item) } })
  return next
})
app.delete('/api/finance/debts/:id', async (request, reply) => {
  const life = await getLifeData(request.user.id)
  const debts = life.finance?.debts || []
  if (!debts.some((item) => item.id === request.params.id)) return reply.code(404).send({ error: 'بدهی پیدا نشد.' })
  await persistLifeData(request.user.id, { ...life, finance: { ...life.finance, debts: debts.filter((item) => item.id !== request.params.id) } })
  return { ok: true }
})


const allowedModuleTypes = new Set(['spiritual','religious','health','learning','relations','review'])

function moduleSummary(type, items = []) {
  const done = items.filter((item) => item.done).length
  const percent = items.length ? Math.round(done / items.length * 100) : 0
  const status = percent >= 80 ? 'خوب' : percent >= 50 ? 'متوسط' : 'نیازمند توجه'
  const tone = percent >= 80 ? 'good' : percent >= 50 ? 'mid' : 'low'
  return { type, count: items.length, done, percent, status, tone, items }
}

app.get('/api/modules', async (request) => {
  const life = await getLifeData(request.user.id)
  return Object.fromEntries([...allowedModuleTypes].map((type) => [type, moduleSummary(type, life.modules?.[type] || [])]))
})

app.get('/api/modules/:type/items', async (request, reply) => {
  const type = request.params.type
  if (!allowedModuleTypes.has(type)) return reply.code(400).send({ error: 'نوع ماژول نامعتبر است.' })
  const life = await getLifeData(request.user.id)
  return { ...moduleSummary(type, life.modules?.[type] || []) }
})

app.post('/api/modules/:type/items', async (request, reply) => {
  const type = request.params.type
  if (!allowedModuleTypes.has(type)) return reply.code(400).send({ error: 'نوع ماژول نامعتبر است.' })
  const title = String(request.body?.title || '').trim()
  if (!title) return reply.code(400).send({ error: 'عنوان الزامی است.' })
  const life = await getLifeData(request.user.id)
  const item = { id: id(), title, done: Boolean(request.body?.done), state: String(request.body?.state || 'باز'), priority: String(request.body?.priority || 'medium'), date: request.body?.date || null, note: String(request.body?.note || ''), created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
  const modules = { ...(life.modules || {}), [type]: [...(life.modules?.[type] || []), item] }
  await persistLifeData(request.user.id, { ...life, modules })
  return reply.code(201).send(item)
})

app.patch('/api/modules/:type/items/:id', async (request, reply) => {
  const { type, id: itemId } = request.params
  if (!allowedModuleTypes.has(type)) return reply.code(400).send({ error: 'نوع ماژول نامعتبر است.' })
  const life = await getLifeData(request.user.id)
  const items = life.modules?.[type] || []
  const index = items.findIndex((item) => item.id === itemId)
  if (index < 0) return reply.code(404).send({ error: 'مورد پیدا نشد.' })
  const next = { ...items[index], ...(request.body || {}), id: itemId, title: String(request.body?.title ?? items[index].title).trim(), done: request.body?.done == null ? items[index].done : Boolean(request.body.done), updated_at: new Date().toISOString() }
  const modules = { ...(life.modules || {}), [type]: items.map((item, i) => i === index ? next : item) }
  await persistLifeData(request.user.id, { ...life, modules })
  return next
})

app.delete('/api/modules/:type/items/:id', async (request, reply) => {
  const { type, id: itemId } = request.params
  if (!allowedModuleTypes.has(type)) return reply.code(400).send({ error: 'نوع ماژول نامعتبر است.' })
  const life = await getLifeData(request.user.id)
  const items = life.modules?.[type] || []
  if (!items.some((item) => item.id === itemId)) return reply.code(404).send({ error: 'مورد پیدا نشد.' })
  const modules = { ...(life.modules || {}), [type]: items.filter((item) => item.id !== itemId) }
  await persistLifeData(request.user.id, { ...life, modules })
  return { ok: true }
})

// Jalali helpers for the monthly habit matrix used by the approved preview UI.
function divJ(a, b) { return Math.floor(a / b) }
function modJ(a, b) { return a - Math.floor(a / b) * b }
function jalCalJ(jy) {
  const breaks = [-61,9,38,199,426,686,756,818,1111,1181,1210,1635,2060,2097,2192,2262,2324,2394,2456,3178]
  const bl = breaks.length
  const gy = jy + 621
  let leapJ = -14, jp = breaks[0], jm, jump, leap, leapG, march, n, i
  if (jy < jp || jy >= breaks[bl-1]) throw new Error('Invalid Jalaali year')
  for (i=1;i<bl;i++){ jm=breaks[i]; jump=jm-jp; if(jy<jm) break; leapJ += divJ(jump,33)*8 + divJ(modJ(jump,33),4); jp=jm }
  n=jy-jp; leapJ += divJ(n,33)*8 + divJ(modJ(n,33)+3,4)
  if(modJ(jump,33)===4 && jump-n===4) leapJ++
  leapG=divJ(gy,4)-divJ((divJ(gy,100)+1)*3,4)-150
  march=20+leapJ-leapG
  if(jump-n<6) n=n-jump+divJ(jump+4,33)*33
  leap=modJ(modJ(n+1,33)-1,4); if(leap===-1) leap=4
  return { leap, gy, march }
}
function g2dJ(gy,gm,gd){let d=divJ((gy+divJ(gm-8,6)+100100)*1461,4)+divJ(153*modJ(gm+9,12)+2,5)+gd-34840408;d=d-divJ(divJ(gy+100100+divJ(gm-8,6),100)*3,4)+752;return d}
function d2gJ(jdn){let j=4*jdn+139361631;j=j+divJ(divJ(4*jdn+183187720,146097)*3,4)*4-3908;const i=divJ(modJ(j,1461),4)*5+308;const gd=divJ(modJ(i,153),5)+1;const gm=modJ(divJ(i,153),12)+1;const gy=divJ(j,1461)-100100+divJ(8-gm,6);return {gy,gm,gd}}
function j2dJ(jy,jm,jd){const r=jalCalJ(jy);return g2dJ(r.gy,3,r.march)+(jm-1)*31-divJ(jm,7)*(jm-7)+jd-1}
function jalaliToGregorianDate(jy,jm,jd){const g=d2gJ(j2dJ(Number(jy),Number(jm),Number(jd)));return `${String(g.gy).padStart(4,'0')}-${String(g.gm).padStart(2,'0')}-${String(g.gd).padStart(2,'0')}`}
function jalaliMonthDays(year, month){ if(month<=6)return 31; if(month<=11)return 30; return jalCalJ(Number(year)).leap===0?30:29 }

app.get('/api/habits/matrix', async (request, reply) => {
  const year = Number(request.query?.year || 1405)
  const month = Number(request.query?.month || 7)
  if(!Number.isInteger(year)||year<1||year>=3178||!Number.isInteger(month)||month<1||month>12)return reply.code(400).send({error:'سال یا ماه معتبر نیست.'})
  const days = jalaliMonthDays(year, month)
  const habits = ((await getV11Canonical(request.user.id)).routines || []).filter(habit=>habit.status!=='paused')
  const rows = habits.map((habit) => {
    const flags = Array.from({length:days}, (_,i) => Boolean(habit.logs?.[jalaliToGregorianDate(year,month,i+1)]))
    const doneCount = flags.filter(Boolean).length
    const goal = Math.min(days, Math.max(1, Number(habit.target_weekly || 7) * 4))
    return { id: habit.id, title: habit.title, goal, days: flags, doneCount, percent: days ? Math.round(doneCount / days * 100) : 0 }
  })
  const dailyPercent = Array.from({length:days}, (_,i) => habits.length ? Math.round(rows.filter((row) => row.days[i]).length / habits.length * 100) : 0)
  const totalDone = rows.reduce((sum,row)=>sum+row.doneCount,0)
  return { year, month, days, activeHabits: habits.length, monthPercent: habits.length && days ? Math.round(totalDone/(habits.length*days)*100) : 0, dailyPercent, rows }
})

app.post('/api/habits/:id/day', async (request, reply) => {
  const year=Number(request.body?.year), month=Number(request.body?.month), day=Number(request.body?.day)
  if(!Number.isInteger(year)||year<1||year>=3178||!Number.isInteger(month)||month<1||month>12||!Number.isInteger(day)||day<1||day>jalaliMonthDays(year,month))return reply.code(400).send({error:'تاریخ ثبت عادت معتبر نیست.'})
  const life=await getLifeData(request.user.id)
  const index=(life.habits||[]).findIndex((item)=>item.id===request.params.id)
  if(index<0){
    const routine=(await getV11Canonical(request.user.id)).routines.find(item=>item.id===request.params.id)
    if(!routine)return reply.code(404).send({error:'عادت پیدا نشد.'})
    return setCanonicalRoutineLog(request.user.id,routine,jalaliToGregorianDate(year,month,day),Boolean(request.body?.done))
  }
  const date=jalaliToGregorianDate(year,month,day)
  const habit={...life.habits[index],logs:{...(life.habits[index].logs||{}),[date]:Boolean(request.body?.done)}}
  const normalized=normalizeHabit({...habit,id:habit.id,created_at:habit.created_at})
  await persistLifeData(request.user.id,{...life,habits:life.habits.map((item,i)=>i===index?normalized:item)})
  return normalized
})

async function setCanonicalRoutineLog(userId,routine,date,value){
  if(!hasDatabase){
    const stored=(memory.v11.spiritual_routines||[]).find(item=>item.id===routine.id)
    if(stored){stored.logs ||= {};stored.logs[date]=value;stored.updated_at=new Date().toISOString()}
  }else{
    await app.pg.query(`INSERT INTO routine_logs (id,user_id,routine_id,log_date,value) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (user_id,routine_id,log_date) DO UPDATE SET value=EXCLUDED.value,updated_at=NOW()`,[id(),userId,routine.id,date,value])
  }
  return {...routine,logs:{...(routine.logs||{}),[date]:value}}
}



// ============================================================
// NOVA V11.8 — Knowledge, Learning & Resource Pipeline
// Interesting material remains a Resource until explicitly promoted to a
// Learning Project, Action or linked Outcome. One record, many linked views.
// ============================================================
const V118_RESOURCE_STATUSES = new Set(['inbox','backlog','active','processing','applied','archived'])
const V118_RESOURCE_TYPES = new Set(['note','book','course','article','idea','paper','video','podcast','question','tool'])
function v118DateOnly(v){ return v ? String(v).slice(0,10) : null }
function v118ResourceNormalized(r={}){
  const status=V118_RESOURCE_STATUSES.has(String(r.status||''))?String(r.status):'backlog'
  return {...r,
    resource_type:V118_RESOURCE_TYPES.has(String(r.resource_type||''))?String(r.resource_type):'note',
    status,
    author:String(r.author||''),source_name:String(r.source_name||''),
    progress_percent:Math.max(0,Math.min(100,Number(r.progress_percent||0)||0)),
    next_action:String(r.next_action||''),key_takeaways:String(r.key_takeaways||''),learning_output:String(r.learning_output||''),
    rating:Math.max(0,Math.min(5,Number(r.rating||0)||0)),started_at:v118DateOnly(r.started_at),completed_at:v118DateOnly(r.completed_at),last_reviewed_at:v118DateOnly(r.last_reviewed_at)
  }
}
function v118LinkMatches(link,resourceId){return (link.source_type==='resource'&&link.source_id===resourceId)||(link.target_type==='resource'&&link.target_id===resourceId)}
function v118LinkedEntity(data,link,resourceId){const other=link.source_type==='resource'?{type:link.target_type,id:link.target_id}:{type:link.source_type,id:link.source_id};const entity=v11EntityMap(data,other.type).find(x=>x.id===other.id);return entity?{type:other.type,id:other.id,label:entity.title||entity.name||'بدون عنوان',relation:link.relation}:null}
function v118ResourceAttention(r){const reasons=[];if(r.status==='active'&&!String(r.next_action||'').trim())reasons.push('Next Action ندارد');if(['active','processing'].includes(r.status)&&!String(r.key_takeaways||'').trim()&&Number(r.progress_percent||0)>=50)reasons.push('یادداشت/Takeaway ثبت نشده');const touch=new Date(r.updated_at||r.created_at||0).getTime();if(r.status==='active'&&touch&&touch<Date.now()-14*86400000)reasons.push('بیش از ۱۴ روز بدون حرکت');if(r.status==='processing'&&!String(r.learning_output||'').trim())reasons.push('خروجی یادگیری مشخص نیست');return reasons}
async function v118Payload(userId){
  const data=await getV11Canonical(userId)
  const resources=(data.resources||[]).map(v118ResourceNormalized).map(r=>{const linked=(data.links||[]).filter(l=>v118LinkMatches(l,r.id)).map(l=>v118LinkedEntity(data,l,r.id)).filter(Boolean);return {...r,linked,attention_reasons:v118ResourceAttention(r)}})
  const count=(s)=>resources.filter(r=>r.status===s).length
  const active=resources.filter(r=>['active','processing'].includes(r.status))
  const summary={inbox:count('inbox'),backlog:count('backlog'),active:count('active'),processing:count('processing'),applied:count('applied'),archived:count('archived'),attention:resources.filter(r=>r.attention_reasons.length).length,avg_active_progress:active.length?Math.round(active.reduce((s,r)=>s+Number(r.progress_percent||0),0)/active.length):0}
  return {stage:'V11.8',summary,items:resources,references:{areas:data.areas.map(a=>({id:a.id,name:a.name,icon:a.icon||'◫'})),projects:data.projects.map(p=>({id:p.id,name:p.name,lifecycle_status:p.lifecycle_status})),outcomes:data.outcomes.map(o=>({id:o.id,title:o.title,status:o.status})),tasks:data.tasks.filter(t=>t.status!=='done').slice(0,250).map(t=>({id:t.id,title:t.title}))},generated_at:new Date().toISOString()}
}
async function v118InsertLink(userId,sourceType,sourceId,relation,targetType,targetId){
  if(!sourceId||!targetId)return
  if(!hasDatabase){ensureMemoryV11();if(!memory.v11.links.some(l=>l.source_type===sourceType&&l.source_id===sourceId&&l.relation===relation&&l.target_type===targetType&&l.target_id===targetId))memory.v11.links.push({id:id(),source_type:sourceType,source_id:sourceId,relation,target_type:targetType,target_id:targetId,created_at:new Date().toISOString()});return}
  await app.pg.query(`INSERT INTO entity_links (id,user_id,source_type,source_id,relation,target_type,target_id) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING`,[id(),userId,sourceType,sourceId,relation,targetType,targetId])
}
async function v118PatchResource(userId,resourceId,body={}){
  const allowed=['title','area_id','resource_type','status','url','note','author','source_name','started_at','completed_at','progress_percent','next_action','key_takeaways','learning_output','rating','last_reviewed_at']
  if(!hasDatabase){ensureMemoryV11();const i=memory.v11.resources.findIndex(r=>r.id===resourceId);if(i<0)return null;const patch=Object.fromEntries(Object.entries(body).filter(([k])=>allowed.includes(k)));memory.v11.resources[i]=v118ResourceNormalized({...memory.v11.resources[i],...patch,id:resourceId,updated_at:new Date().toISOString()});return memory.v11.resources[i]}
  const cur=(await app.pg.query('SELECT * FROM resources WHERE id=$1 AND user_id=$2',[resourceId,userId])).rows[0];if(!cur)return null
  const n=v118ResourceNormalized({...cur,...Object.fromEntries(Object.entries(body).filter(([k])=>allowed.includes(k)))})
  const {rows}=await app.pg.query(`UPDATE resources SET title=$1,area_id=$2,resource_type=$3,status=$4,url=$5,note=$6,author=$7,source_name=$8,started_at=$9,completed_at=$10,progress_percent=$11,next_action=$12,key_takeaways=$13,learning_output=$14,rating=$15,last_reviewed_at=$16,version=version+1,updated_at=NOW() WHERE id=$17 AND user_id=$18 RETURNING *`,[n.title,n.area_id||null,n.resource_type,n.status,n.url||'',n.note||'',n.author||'',n.source_name||'',n.started_at||null,n.completed_at||null,n.progress_percent,n.next_action||'',n.key_takeaways||'',n.learning_output||'',n.rating,n.last_reviewed_at||null,resourceId,userId]);return rows[0]
}
app.get('/api/v11.8/learning',async(request)=>v118Payload(request.user.id))
app.post('/api/v11.8/resources',async(request,reply)=>{const title=String(request.body?.title||'').trim();if(!title)return reply.code(400).send({error:'عنوان منبع الزامی است.'});const now=new Date().toISOString(),resource=v118ResourceNormalized({id:id(),title,area_id:request.body?.area_id||null,resource_type:request.body?.resource_type||'note',status:request.body?.status||'inbox',url:request.body?.url||'',note:request.body?.note||'',author:request.body?.author||'',source_name:request.body?.source_name||'',started_at:request.body?.started_at||null,completed_at:request.body?.completed_at||null,progress_percent:request.body?.progress_percent||0,next_action:request.body?.next_action||'',key_takeaways:request.body?.key_takeaways||'',learning_output:request.body?.learning_output||'',rating:request.body?.rating||0,last_reviewed_at:request.body?.last_reviewed_at||null,created_at:now,updated_at:now});if(!hasDatabase){ensureMemoryV11();memory.v11.resources.unshift(resource)}else await app.pg.query(`INSERT INTO resources (id,user_id,title,area_id,resource_type,status,url,note,author,source_name,started_at,completed_at,progress_percent,next_action,key_takeaways,learning_output,rating,last_reviewed_at,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,[resource.id,request.user.id,resource.title,resource.area_id,resource.resource_type,resource.status,resource.url,resource.note,resource.author,resource.source_name,resource.started_at,resource.completed_at,resource.progress_percent,resource.next_action,resource.key_takeaways,resource.learning_output,resource.rating,resource.last_reviewed_at,resource.created_at,resource.updated_at]);return reply.code(201).send({resource,payload:await v118Payload(request.user.id)})})
app.patch('/api/v11.8/resources/:id',async(request,reply)=>{const row=await v118PatchResource(request.user.id,request.params.id,request.body||{});if(!row)return reply.code(404).send({error:'منبع پیدا نشد.'});return {resource:row,payload:await v118Payload(request.user.id)}})
app.post('/api/v11.8/resources/:id/promote-project',async(request,reply)=>{const payload=await v118Payload(request.user.id),r=payload.items.find(x=>x.id===request.params.id);if(!r)return reply.code(404).send({error:'منبع پیدا نشد.'});const area=payload.references.areas.find(a=>a.id===r.area_id);const project=await createProject(request.user.id,{name:String(request.body?.name||`یادگیری: ${r.title}`),description:String(request.body?.description||r.learning_output||r.note||`پروژه یادگیری برآمده از منبع «${r.title}»`),due_date:request.body?.due_date||null,status:'in_progress',color:'#5f7cf4',icon:'◫'});if(!hasDatabase){ensureMemoryV11();memory.v11.project_meta[project.id]={area_id:r.area_id||null,outcome:r.learning_output||'',lifecycle_status:'active',review_at:null,last_touched_at:new Date().toISOString()}}else await app.pg.query(`UPDATE projects SET area_id=$1,lifecycle_status='active',last_touched_at=NOW() WHERE id=$2 AND user_id=$3`,[r.area_id||null,project.id,request.user.id]);await v118InsertLink(request.user.id,'resource',r.id,'became_learning_project','project',project.id);await v118PatchResource(request.user.id,r.id,{status:'active',started_at:r.started_at||today(),next_action:r.next_action||`تعریف اولین خروجی پروژه «${project.name}»`});return {project,payload:await v118Payload(request.user.id)}})
app.post('/api/v11.8/resources/:id/create-action',async(request,reply)=>{const payload=await v118Payload(request.user.id),r=payload.items.find(x=>x.id===request.params.id);if(!r)return reply.code(404).send({error:'منبع پیدا نشد.'});const area=payload.references.areas.find(a=>a.id===r.area_id);const task=await createTask(request.user.id,{title:String(request.body?.title||r.next_action||`اقدام از: ${r.title}`),description:String(request.body?.description||`اقدام ایجادشده از منبع «${r.title}»`),due_date:request.body?.due_date||null,priority:request.body?.priority||'medium',status:'todo',estimate_minutes:Number(request.body?.estimate_minutes||30),category:area?.name||'یادگیری',tags:['learning','resource'],project_id:request.body?.project_id||null});if(!hasDatabase&&r.area_id){const idx=memory.tasks.findIndex(t=>t.id===task.id);if(idx>=0)memory.tasks[idx].category=area?.name||memory.tasks[idx].category}else if(hasDatabase&&r.area_id)await app.pg.query('UPDATE tasks SET area_id=$1 WHERE id=$2 AND user_id=$3',[r.area_id,task.id,request.user.id]);await v118InsertLink(request.user.id,'resource',r.id,'generated_action','task',task.id);return {task,payload:await v118Payload(request.user.id)}})
app.post('/api/v11.8/resources/:id/outcomes/:outcomeId',async(request,reply)=>{const payload=await v118Payload(request.user.id);if(!payload.items.some(r=>r.id===request.params.id)||!payload.references.outcomes.some(o=>o.id===request.params.outcomeId))return reply.code(404).send({error:'Resource یا Outcome پیدا نشد.'});await v118InsertLink(request.user.id,'resource',request.params.id,'supports','outcome',request.params.outcomeId);return {ok:true,payload:await v118Payload(request.user.id)}})
app.post('/api/v11.8/resources/:id/archive',async(request,reply)=>{const r=await v118PatchResource(request.user.id,request.params.id,{status:'archived',completed_at:request.body?.completed_at||today(),last_reviewed_at:today()});if(!r)return reply.code(404).send({error:'منبع پیدا نشد.'});return {resource:r,payload:await v118Payload(request.user.id)}})
app.get('/api/v11.8/health',async()=>({ok:true,stage:'V11.8',storage:hasDatabase?'postgresql':'memory',capabilities:['learning-pipeline','resource-to-project','resource-to-task','resource-to-outcome','synthesis-notes','attention-rules','archive-without-loss'],now:new Date().toISOString()}))


// ============================================================
// NOVA V11.9 — Health, Energy & Sustainable Performance
// Health is an Area with meaningful measures, routines and events.
// Missing data is kept distinct from failure; there is no synthetic
// "overall health percentage". Energy can optionally filter execution.
// ============================================================
const V119_DEFAULT_METRICS = [
  {slug:'sleep_hours',name:'خواب',category:'sleep',unit:'ساعت',value_type:'number',target_min:7,target_max:9,good_direction:'range',icon:'☾',sort_order:10},
  {slug:'energy',name:'انرژی',category:'energy',unit:'/10',value_type:'rating',target_min:6,target_max:10,good_direction:'high',icon:'⚡',sort_order:20},
  {slug:'movement_minutes',name:'حرکت',category:'movement',unit:'دقیقه',value_type:'number',target_min:30,target_max:null,good_direction:'high',icon:'↟',sort_order:30},
  {slug:'mood',name:'حال عمومی',category:'wellbeing',unit:'/10',value_type:'rating',target_min:6,target_max:10,good_direction:'high',icon:'◉',sort_order:40},
  {slug:'stress',name:'فشار ذهنی',category:'wellbeing',unit:'/10',value_type:'rating',target_min:null,target_max:5,good_direction:'low',icon:'≈',sort_order:50}
]
function v119IsoDate(d=new Date()){return d.toISOString().slice(0,10)}
function v119DateShift(days){const d=new Date();d.setUTCDate(d.getUTCDate()+days);return v119IsoDate(d)}
function v119MetricNormalized(m={}){
  const dir=['high','low','range'].includes(String(m.good_direction||''))?String(m.good_direction):'range'
  const vt=['number','rating','duration','boolean','text'].includes(String(m.value_type||''))?String(m.value_type):'number'
  const numOrNull=(v)=>v===null||v===''||typeof v==='undefined'?null:Number(v)
  return {...m,name:String(m.name||'شاخص'),slug:String(m.slug||'custom').trim(),category:String(m.category||'custom'),unit:String(m.unit||''),value_type:vt,target_min:numOrNull(m.target_min),target_max:numOrNull(m.target_max),good_direction:dir,icon:String(m.icon||'•'),active:m.active!==false,sort_order:Number(m.sort_order||0)||0}
}
function v119EnsureMemoryDefaults(){
  ensureMemoryV11()
  for(const def of V119_DEFAULT_METRICS){
    if(!memory.v11.health_metrics.some(m=>m.slug===def.slug))memory.v11.health_metrics.push(v119MetricNormalized({id:id(),...def,created_at:new Date().toISOString(),updated_at:new Date().toISOString()}))
  }
}
async function v119EnsureMetrics(userId){
  if(!hasDatabase){v119EnsureMemoryDefaults();return memory.v11.health_metrics.filter(m=>m.active!==false).sort((a,b)=>a.sort_order-b.sort_order)}
  for(const def of V119_DEFAULT_METRICS){
    await app.pg.query(`INSERT INTO health_metric_definitions (id,user_id,name,slug,category,unit,value_type,target_min,target_max,good_direction,icon,active,sort_order)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,TRUE,$12) ON CONFLICT (user_id,slug) DO NOTHING`,
      [id(),userId,def.name,def.slug,def.category,def.unit,def.value_type,def.target_min,def.target_max,def.good_direction,def.icon,def.sort_order])
  }
  const {rows}=await app.pg.query('SELECT * FROM health_metric_definitions WHERE user_id=$1 AND active=TRUE ORDER BY sort_order,name',[userId])
  return rows.map(v119MetricNormalized)
}
async function v119Logs(userId,since=v119DateShift(-27)){
  if(!hasDatabase){v119EnsureMemoryDefaults();return memory.v11.health_logs.filter(l=>String(l.log_date)>=since)}
  const {rows}=await app.pg.query('SELECT * FROM health_metric_logs WHERE user_id=$1 AND log_date >= $2 ORDER BY log_date',[userId,since])
  return rows
}
function v119Control(metric,value){
  if(value===null||typeof value==='undefined'||Number.isNaN(Number(value)))return {state:'no_data',label:'بدون داده'}
  const v=Number(value),min=metric.target_min===null?null:Number(metric.target_min),max=metric.target_max===null?null:Number(metric.target_max)
  let attention=false
  if(metric.good_direction==='high'&&min!==null&&v<min)attention=true
  if(metric.good_direction==='low'&&max!==null&&v>max)attention=true
  if(metric.good_direction==='range'&&((min!==null&&v<min)||(max!==null&&v>max)))attention=true
  return attention?{state:'attention',label:'نیازمند توجه'}:{state:'on_track',label:'در محدوده'}
}
function v119LatestFor(metric,logs){
  return logs.filter(l=>l.metric_id===metric.id).sort((a,b)=>String(b.log_date).localeCompare(String(a.log_date)))[0]||null
}
function v119Avg(metric,logs,days=7){
  const since=v119DateShift(-(days-1)),vals=logs.filter(l=>l.metric_id===metric.id&&String(l.log_date)>=since&&l.value_numeric!==null&&typeof l.value_numeric!=='undefined').map(l=>Number(l.value_numeric)).filter(Number.isFinite)
  return vals.length?Math.round((vals.reduce((a,b)=>a+b,0)/vals.length)*10)/10:null
}
function v119HealthRoutine(r,healthAreaId){
  if(r.area_id&&healthAreaId&&r.area_id===healthAreaId)return true
  return /(خواب|آب|پیاده|ورزش|کشش|تنفس|میوه|سبزی|فضای باز|بدن|صبحانه|سلامت)/i.test(String(r.title||r.name||''))
}
async function v119UpsertLog(userId,metric,date,value,note='',source='manual'){
  const n=Number(value);if(!Number.isFinite(n))throw new Error('مقدار شاخص باید عددی باشد.')
  if(!hasDatabase){
    v119EnsureMemoryDefaults()
    const ix=memory.v11.health_logs.findIndex(l=>l.metric_id===metric.id&&String(l.log_date)===date)
    const row={id:ix>=0?memory.v11.health_logs[ix].id:id(),metric_id:metric.id,log_date:date,value_numeric:n,value_text:'',note:String(note||''),source:String(source||'manual'),created_at:ix>=0?memory.v11.health_logs[ix].created_at:new Date().toISOString(),updated_at:new Date().toISOString()}
    if(ix>=0)memory.v11.health_logs[ix]=row;else memory.v11.health_logs.push(row)
    return row
  }
  const {rows}=await app.pg.query(`INSERT INTO health_metric_logs (id,user_id,metric_id,log_date,value_numeric,note,source)
    VALUES ($1,$2,$3,$4,$5,$6,$7)
    ON CONFLICT (user_id,metric_id,log_date) DO UPDATE SET value_numeric=EXCLUDED.value_numeric,note=EXCLUDED.note,source=EXCLUDED.source,updated_at=NOW()
    RETURNING *`,[id(),userId,metric.id,date,n,String(note||''),String(source||'manual')])
  return rows[0]
}
async function v119Payload(userId){
  const [data,metrics,logs]=await Promise.all([getV11Canonical(userId),v119EnsureMetrics(userId),v119Logs(userId)])
  const healthArea=data.areas.find(a=>String(a.name).includes('سلامت'))||null
  const today=v119IsoDate(),metricRows=metrics.map(m=>{
    const latest=v119LatestFor(m,logs),value=latest?.value_numeric===null||typeof latest?.value_numeric==='undefined'?null:Number(latest.value_numeric)
    const control=v119Control(m,value)
    const series=[];for(let i=-13;i<=0;i++){const date=v119DateShift(i),log=logs.find(l=>l.metric_id===m.id&&String(l.log_date)===date);series.push({date,value:log?.value_numeric===null||typeof log?.value_numeric==='undefined'?null:Number(log.value_numeric)})}
    return {...m,latest_date:latest?.log_date?String(latest.log_date).slice(0,10):null,latest_value:value,avg7:v119Avg(m,logs,7),control,series}
  })
  const attention=metricRows.filter(m=>m.control.state==='attention').length,noData=metricRows.filter(m=>m.control.state==='no_data').length
  const healthRoutines=(data.routines||[]).filter(r=>v119HealthRoutine(r,healthArea?.id)).map(r=>({id:r.id,title:r.title||r.name||'روتین',today_done:Boolean(r.logs?.[today]),routine_type:r.routine_type||'general'}))
  const upcoming=(data.events||[]).filter(e=>{
    const marked=String(e.notes||'').startsWith('NOVA_HEALTH_APPOINTMENT::')
    return (e.type==='health'||(e.type==='appointment'&&marked))&&new Date(e.end_at||e.start_at).getTime()>=Date.now()
  }).sort((a,b)=>new Date(a.start_at)-new Date(b.start_at)).slice(0,10)
  const energyMetric=metricRows.find(m=>m.slug==='energy'),energy=energyMetric?.latest_value
  const energyLevel=energy===null||typeof energy==='undefined'?'':energy>=8?'high':energy<=4?'low':'medium'
  const suggestedMinutes=energyLevel==='high'?60:energyLevel==='low'?20:30
  let rec=await v114Recommendations(userId,{energy:energyLevel,minutes:suggestedMinutes})
  if(energyLevel&&!rec.items.length)rec=await v114Recommendations(userId,{minutes:suggestedMinutes})
  return {stage:'V11.9',today,area:healthArea,summary:{metrics:metricRows.length,attention,no_data:noData,routines:healthRoutines.length,routines_done:healthRoutines.filter(r=>r.today_done).length,appointments_upcoming:upcoming.length,energy_level:energyLevel||null},metrics:metricRows,routines:healthRoutines,appointments:upcoming,task_fit:{energy_value:energy??null,energy_level:energyLevel||null,max_minutes:suggestedMinutes,items:rec.items.slice(0,4),note:'این تطبیق فقط برای انتخاب کار متناسب با انرژی ثبت‌شده است و ارزیابی پزشکی نیست.'},generated_at:new Date().toISOString()}
}
app.get('/api/v11.9/health-system',async(request)=>v119Payload(request.user.id))
app.post('/api/v11.9/checkin',async(request,reply)=>{
  const metrics=await v119EnsureMetrics(request.user.id),body=request.body||{},date=String(body.date||v119IsoDate()).slice(0,10),map={sleep_hours:body.sleep_hours,energy:body.energy,movement_minutes:body.movement_minutes,mood:body.mood,stress:body.stress}
  for(const [slug,value] of Object.entries(map)){if(value===null||value===''||typeof value==='undefined')continue;const metric=metrics.find(m=>m.slug===slug);if(metric)await v119UpsertLog(request.user.id,metric,date,value,body.note||'','daily-checkin')}
  return reply.code(201).send(await v119Payload(request.user.id))
})
app.post('/api/v11.9/logs',async(request,reply)=>{
  const metrics=await v119EnsureMetrics(request.user.id),body=request.body||{},metric=body.metric_id?metrics.find(m=>m.id===body.metric_id):metrics.find(m=>m.slug===body.slug)
  if(!metric)return reply.code(404).send({error:'شاخص پیدا نشد.'})
  await v119UpsertLog(request.user.id,metric,String(body.log_date||v119IsoDate()).slice(0,10),body.value_numeric,body.note||'',body.source||'manual')
  return reply.code(201).send(await v119Payload(request.user.id))
})
app.post('/api/v11.9/metrics',async(request,reply)=>{
  const body=request.body||{},name=String(body.name||'').trim();if(!name)return reply.code(400).send({error:'نام شاخص الزامی است.'})
  const slug=String(body.slug||`custom_${Date.now()}`).trim().toLowerCase().replace(/[^a-z0-9_]+/g,'_'),m=v119MetricNormalized({id:id(),name,slug,category:body.category||'custom',unit:body.unit||'',value_type:body.value_type||'number',target_min:body.target_min,target_max:body.target_max,good_direction:body.good_direction||'range',icon:body.icon||'•',active:true,sort_order:Number(body.sort_order||90),created_at:new Date().toISOString(),updated_at:new Date().toISOString()})
  if(!hasDatabase){v119EnsureMemoryDefaults();if(memory.v11.health_metrics.some(x=>x.slug===slug))return reply.code(409).send({error:'Slug تکراری است.'});memory.v11.health_metrics.push(m)}
  else {try{await app.pg.query(`INSERT INTO health_metric_definitions (id,user_id,name,slug,category,unit,value_type,target_min,target_max,good_direction,icon,active,sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,TRUE,$12)`,[m.id,request.user.id,m.name,m.slug,m.category,m.unit,m.value_type,m.target_min,m.target_max,m.good_direction,m.icon,m.sort_order])}catch(e){return reply.code(409).send({error:'شاخص با این شناسه وجود دارد.'})}}
  return reply.code(201).send(await v119Payload(request.user.id))
})
app.patch('/api/v11.9/metrics/:id',async(request,reply)=>{
  const body=request.body||{},allowed=['name','category','unit','value_type','target_min','target_max','good_direction','icon','active','sort_order']
  if(!hasDatabase){v119EnsureMemoryDefaults();const i=memory.v11.health_metrics.findIndex(m=>m.id===request.params.id);if(i<0)return reply.code(404).send({error:'شاخص پیدا نشد.'});const patch=Object.fromEntries(Object.entries(body).filter(([k])=>allowed.includes(k)));memory.v11.health_metrics[i]=v119MetricNormalized({...memory.v11.health_metrics[i],...patch,updated_at:new Date().toISOString()})}
  else {const cur=(await app.pg.query('SELECT * FROM health_metric_definitions WHERE id=$1 AND user_id=$2',[request.params.id,request.user.id])).rows[0];if(!cur)return reply.code(404).send({error:'شاخص پیدا نشد.'});const patch=v119MetricNormalized({...cur,...Object.fromEntries(Object.entries(body).filter(([k])=>allowed.includes(k)))});await app.pg.query(`UPDATE health_metric_definitions SET name=$1,category=$2,unit=$3,value_type=$4,target_min=$5,target_max=$6,good_direction=$7,icon=$8,active=$9,sort_order=$10,updated_at=NOW() WHERE id=$11 AND user_id=$12`,[patch.name,patch.category,patch.unit,patch.value_type,patch.target_min,patch.target_max,patch.good_direction,patch.icon,patch.active,patch.sort_order,request.params.id,request.user.id])}
  return v119Payload(request.user.id)
})
app.post('/api/v11.9/appointments',async(request,reply)=>{
  try{
    const body=request.body||{},title=String(body.title||'قرار سلامت').trim(),start=String(body.start_at||'');if(!start)return reply.code(400).send({error:'زمان شروع لازم است.'})
    const startDate=new Date(start),end=body.end_at?String(body.end_at):new Date(startDate.getTime()+60*60000).toISOString()
    const notes=`NOVA_HEALTH_APPOINTMENT::${JSON.stringify({provider:String(body.provider||''),location:String(body.location||''),note:String(body.note||'')})}`
    const event=await createEvent(request.user.id,{title,type:'appointment',start_at:start,end_at:end,color:'#4f9f83',notes})
    return reply.code(201).send({event,payload:await v119Payload(request.user.id)})
  }catch(error){return reply.code(400).send({error:error.message})}
})
app.get('/api/v11.9/recommendations',async(request)=>{const p=await v119Payload(request.user.id);return p.task_fit})
app.get('/api/v11.9/health',async()=>({ok:true,stage:'V11.9',storage:hasDatabase?'postgresql':'memory',capabilities:['daily-checkin','custom-health-metrics','missing-data-semantics','health-routines-view','health-appointments','energy-aware-task-fit','no-global-health-score'],now:new Date().toISOString()}))



// ============================================================
// NOVA V11.10 — Relationships, People & Commitments
// People are not scored. The system tracks commitments, follow-up cadence,
// waiting-on-person states and important dates as actionable exceptions.
// ============================================================
function v1110Date(){return new Date().toISOString().slice(0,10)}
function v1110DateAdd(date,days){const d=new Date(`${date||v1110Date()}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+Number(days||0));return d.toISOString().slice(0,10)}
function v1110NextContact(last,cadence){return last&&Number(cadence)>0?v1110DateAdd(String(last).slice(0,10),Number(cadence)):null}
function v1110PersonNormalized(x={}){const last=x.last_contact_at?String(x.last_contact_at).slice(0,10):null,cad=Math.max(0,Math.min(365,Number(x.cadence_days)||0));return {id:x.id||id(),name:String(x.name||'').trim().slice(0,160),relation_type:String(x.relation_type||'سایر').slice(0,80),organization:String(x.organization||'').slice(0,180),contact:String(x.contact||'').slice(0,300),tags:Array.isArray(x.tags)?x.tags.map(String).filter(Boolean).slice(0,12):[],cadence_days:cad,last_contact_at:last,next_contact_at:x.next_contact_at?String(x.next_contact_at).slice(0,10):v1110NextContact(last,cad),important_date:x.important_date?String(x.important_date).slice(0,10):null,important_date_label:String(x.important_date_label||'').slice(0,120),notes:String(x.notes||'').slice(0,5000),status:['active','archived'].includes(x.status)?x.status:'active',created_at:x.created_at||new Date().toISOString(),updated_at:x.updated_at||new Date().toISOString()}}
function v1110CommitmentNormalized(x={}){return {id:x.id||id(),person_id:x.person_id||null,title:String(x.title||'').trim().slice(0,240),direction:['i_owe','waiting_on_them','mutual'].includes(x.direction)?x.direction:'i_owe',kind:String(x.kind||'commitment').slice(0,50),status:['open','done','cancelled'].includes(x.status)?x.status:'open',due_date:x.due_date?String(x.due_date).slice(0,10):null,task_id:x.task_id||null,meeting_event_id:x.meeting_event_id||null,note:String(x.note||'').slice(0,4000),created_at:x.created_at||new Date().toISOString(),updated_at:x.updated_at||new Date().toISOString()}}
function v1110EnsureMemory(){
  ensureMemoryV11();
  if(memory.v11.relationship_seeded)return;
  const p1=v1110PersonNormalized({name:'سارا',relation_type:'همکار',organization:'تیم پروژه',contact:'پیام‌رسان',tags:['پروژه'],cadence_days:14,last_contact_at:v1110DateAdd(v1110Date(),-12),important_date:v1110DateAdd(v1110Date(),18),important_date_label:'تولد'}),p2=v1110PersonNormalized({name:'خانواده',relation_type:'خانواده',contact:'تماس',tags:['خانواده'],cadence_days:7,last_contact_at:v1110DateAdd(v1110Date(),-8)}),p3=v1110PersonNormalized({name:'علی',relation_type:'شبکه حرفه‌ای',organization:'دانشگاه',contact:'ایمیل',tags:['دانشگاه'],cadence_days:30,last_contact_at:v1110DateAdd(v1110Date(),-35),important_date:v1110DateAdd(v1110Date(),25),important_date_label:'سالگرد آشنایی'});
  memory.v11.people.push(p1,p2,p3);
  memory.v11.relationship_commitments.push(v1110CommitmentNormalized({person_id:p1.id,title:'ارسال نسخه اولیه برای بازخورد',direction:'i_owe',due_date:v1110DateAdd(v1110Date(),1)}),v1110CommitmentNormalized({person_id:p3.id,title:'دریافت فایل داده پژوهش',direction:'waiting_on_them',due_date:v1110DateAdd(v1110Date(),-1)}));
  memory.v11.relationship_seeded=true;
}
async function v1110People(userId){if(!hasDatabase){v1110EnsureMemory();return memory.v11.people.filter(p=>p.status!=='archived').map(v1110PersonNormalized)}const {rows}=await app.pg.query("SELECT * FROM people WHERE user_id=$1 AND status <> 'archived' ORDER BY name",[userId]);return rows.map(v1110PersonNormalized)}
async function v1110Commitments(userId){if(!hasDatabase){v1110EnsureMemory();return memory.v11.relationship_commitments.map(v1110CommitmentNormalized)}const {rows}=await app.pg.query('SELECT * FROM relationship_commitments WHERE user_id=$1 ORDER BY due_date NULLS LAST, created_at DESC',[userId]);return rows.map(v1110CommitmentNormalized)}
function v1110NextAnnual(raw){if(!raw)return null;const src=new Date(`${String(raw).slice(0,10)}T12:00:00Z`);if(Number.isNaN(src.getTime()))return null;const now=new Date(`${v1110Date()}T12:00:00Z`);let d=new Date(Date.UTC(now.getUTCFullYear(),src.getUTCMonth(),src.getUTCDate(),12));if(d<now)d=new Date(Date.UTC(now.getUTCFullYear()+1,src.getUTCMonth(),src.getUTCDate(),12));return {date:d.toISOString().slice(0,10),days_until:Math.round((d-now)/86400000)}}
async function v1110Payload(userId){const [people,storedCommitments,events,tasks]=await Promise.all([v1110People(userId),v1110Commitments(userId),listEvents(userId),listTasks(userId)]);const commitments=storedCommitments.map(commitment=>{const task=tasks.find(task=>task.id===commitment.task_id);return task&&commitment.status!=='cancelled'?{...commitment,status:task.status==='done'?'done':'open'}:commitment});const today=v1110Date(),open=commitments.filter(c=>c.status==='open');const followups=people.filter(p=>p.next_contact_at&&p.next_contact_at<=today).map(p=>({person_id:p.id,name:p.name,next_contact_at:p.next_contact_at,days_overdue:Math.max(0,Math.round((new Date(`${today}T12:00:00Z`)-new Date(`${p.next_contact_at}T12:00:00Z`))/86400000))})).sort((a,b)=>b.days_overdue-a.days_overdue);const upcoming=people.map(p=>{const n=v1110NextAnnual(p.important_date);return n?{person_id:p.id,name:p.name,label:p.important_date_label||'مناسبت',date:n.date,days_until:n.days_until}:null}).filter(Boolean).filter(x=>x.days_until<=45).sort((a,b)=>a.days_until-b.days_until);const recentMeetings=events.filter(e=>e.type==='meeting').slice(-20);const enriched=people.map(p=>({...p,recent_meeting_count:recentMeetings.filter(e=>String(e.notes||'').includes(p.name)).length}));return {stage:'V11.10',today,people:enriched,commitments,followups,upcoming_dates:upcoming,summary:{people_active:people.length,followups_due:followups.length,promises_open:open.filter(c=>c.direction==='i_owe').length,waiting_on_people:open.filter(c=>c.direction==='waiting_on_them').length,commitments_overdue:open.filter(c=>c.due_date&&c.due_date<today).length,important_dates_45:upcoming.length},generated_at:new Date().toISOString()}}
async function v1110SavePerson(userId,p){if(!hasDatabase){v1110EnsureMemory();const i=memory.v11.people.findIndex(x=>x.id===p.id);if(i>=0)memory.v11.people[i]=p;else memory.v11.people.push(p);return p}await app.pg.query(`INSERT INTO people (id,user_id,name,relation_type,organization,contact,tags,cadence_days,last_contact_at,next_contact_at,important_date,important_date_label,notes,status,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12,$13,$14,$15,$16) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,relation_type=EXCLUDED.relation_type,organization=EXCLUDED.organization,contact=EXCLUDED.contact,tags=EXCLUDED.tags,cadence_days=EXCLUDED.cadence_days,last_contact_at=EXCLUDED.last_contact_at,next_contact_at=EXCLUDED.next_contact_at,important_date=EXCLUDED.important_date,important_date_label=EXCLUDED.important_date_label,notes=EXCLUDED.notes,status=EXCLUDED.status,updated_at=NOW()`,[p.id,userId,p.name,p.relation_type,p.organization,p.contact,JSON.stringify(p.tags||[]),p.cadence_days,p.last_contact_at,p.next_contact_at,p.important_date,p.important_date_label,p.notes,p.status,p.created_at,p.updated_at]);return p}
async function v1110SaveCommitment(userId,c){if(!hasDatabase){v1110EnsureMemory();const i=memory.v11.relationship_commitments.findIndex(x=>x.id===c.id);if(i>=0)memory.v11.relationship_commitments[i]=c;else memory.v11.relationship_commitments.push(c);return c}await app.pg.query(`INSERT INTO relationship_commitments (id,user_id,person_id,title,direction,kind,status,due_date,task_id,meeting_event_id,note,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT (id) DO UPDATE SET person_id=EXCLUDED.person_id,title=EXCLUDED.title,direction=EXCLUDED.direction,kind=EXCLUDED.kind,status=EXCLUDED.status,due_date=EXCLUDED.due_date,task_id=EXCLUDED.task_id,meeting_event_id=EXCLUDED.meeting_event_id,note=EXCLUDED.note,updated_at=NOW()`,[c.id,userId,c.person_id,c.title,c.direction,c.kind,c.status,c.due_date,c.task_id,c.meeting_event_id,c.note,c.created_at,c.updated_at]);return c}
async function v1110SetTaskWaiting(userId,taskId,personName){if(!taskId||!personName)return;if(hasDatabase){await app.pg.query('UPDATE tasks SET waiting_on=$1,updated_at=NOW() WHERE id=$2 AND user_id=$3',[personName,taskId,userId]);return}const life=await getLifeData(userId);life.execution.task_meta ||= {};const cur=life.execution.task_meta[taskId]||{};life.execution.task_meta[taskId]={...cur,waiting_on:personName,updated_at:new Date().toISOString()};await persistLifeData(userId,life)}
app.get('/api/v11.10/relationships',async(request)=>v1110Payload(request.user.id))
app.post('/api/v11.10/people',async(request,reply)=>{const body=request.body||{},p=v1110PersonNormalized({...body,id:id()});if(!p.name)return reply.code(400).send({error:'نام فرد الزامی است.'});await v1110SavePerson(request.user.id,p);return reply.code(201).send(await v1110Payload(request.user.id))})
app.patch('/api/v11.10/people/:id',async(request,reply)=>{const rows=await v1110People(request.user.id),cur=rows.find(x=>x.id===request.params.id);if(!cur)return reply.code(404).send({error:'فرد پیدا نشد.'});const p=v1110PersonNormalized({...cur,...(request.body||{}),id:cur.id,updated_at:new Date().toISOString()});await v1110SavePerson(request.user.id,p);return v1110Payload(request.user.id)})
app.post('/api/v11.10/people/:id/touch',async(request,reply)=>{const rows=await v1110People(request.user.id),cur=rows.find(x=>x.id===request.params.id);if(!cur)return reply.code(404).send({error:'فرد پیدا نشد.'});const date=String(request.body?.date||v1110Date()).slice(0,10),p=v1110PersonNormalized({...cur,last_contact_at:date,next_contact_at:v1110NextContact(date,cur.cadence_days),updated_at:new Date().toISOString()});await v1110SavePerson(request.user.id,p);return v1110Payload(request.user.id)})
app.post('/api/v11.10/people/:id/follow-up-task',async(request,reply)=>{const rows=await v1110People(request.user.id),p=rows.find(x=>x.id===request.params.id);if(!p)return reply.code(404).send({error:'فرد پیدا نشد.'});const task=await createTask(request.user.id,{title:String(request.body?.title||`پیگیری با ${p.name}`),description:String(request.body?.description||`پیگیری ارتباط با ${p.name}`),due_date:request.body?.due_date||p.next_contact_at||v1110Date(),priority:request.body?.priority||'medium',estimate_minutes:Number(request.body?.estimate_minutes||15),category:'روابط'});const c=v1110CommitmentNormalized({person_id:p.id,title:task.title,direction:'i_owe',kind:'follow_up',due_date:task.due_date,task_id:task.id,status:'open'});await v1110SaveCommitment(request.user.id,c);return reply.code(201).send({task,commitment:c,payload:await v1110Payload(request.user.id)})})
app.post('/api/v11.10/people/:id/calendar-event',async(request,reply)=>{const rows=await v1110People(request.user.id),p=rows.find(x=>x.id===request.params.id);if(!p)return reply.code(404).send({error:'فرد پیدا نشد.'});const next=v1110NextAnnual(p.important_date);if(!next)return reply.code(400).send({error:'مناسبت مهم برای این فرد ثبت نشده است.'});const start=`${next.date}T09:00:00`,end=`${next.date}T09:30:00`,event=await createEvent(request.user.id,{title:`${p.important_date_label||'مناسبت'} — ${p.name}`,type:'personal',start_at:start,end_at:end,color:'#7a65a5',notes:`NOVA_PERSON_EVENT::${JSON.stringify({person_id:p.id,label:p.important_date_label||'مناسبت'})}`});return reply.code(201).send({event})})
app.post('/api/v11.10/commitments',async(request,reply)=>{const body=request.body||{},people=await v1110People(request.user.id);if(!people.some(p=>p.id===body.person_id))return reply.code(400).send({error:'فرد مرتبط پیدا نشد.'});const c=v1110CommitmentNormalized({...body,id:id()});if(!c.title)return reply.code(400).send({error:'عنوان تعهد الزامی است.'});await v1110SaveCommitment(request.user.id,c);return reply.code(201).send(await v1110Payload(request.user.id))})
app.patch('/api/v11.10/commitments/:id',async(request,reply)=>{const rows=await v1110Commitments(request.user.id),cur=rows.find(x=>x.id===request.params.id);if(!cur)return reply.code(404).send({error:'تعهد پیدا نشد.'});const c=v1110CommitmentNormalized({...cur,...(request.body||{}),id:cur.id,updated_at:new Date().toISOString()});await v1110SaveCommitment(request.user.id,c);if(c.status==='done'&&c.task_id){try{await updateTask(request.user.id,c.task_id,{status:'done'})}catch{}}return v1110Payload(request.user.id)})
app.post('/api/v11.10/commitments/:id/create-task',async(request,reply)=>{const rows=await v1110Commitments(request.user.id),cur=rows.find(x=>x.id===request.params.id);if(!cur)return reply.code(404).send({error:'تعهد پیدا نشد.'});const people=await v1110People(request.user.id),p=people.find(x=>x.id===cur.person_id);const task=await createTask(request.user.id,{title:cur.title,description:`مرتبط با ${p?.name||'فرد'} • منبع: تعهد روابط`,due_date:cur.due_date,priority:request.body?.priority||'medium',estimate_minutes:Number(request.body?.estimate_minutes||15),category:'روابط'});const c=v1110CommitmentNormalized({...cur,task_id:task.id,updated_at:new Date().toISOString()});await v1110SaveCommitment(request.user.id,c);if(c.direction==='waiting_on_them'&&p)await v1110SetTaskWaiting(request.user.id,task.id,p.name);return reply.code(201).send({task,commitment:c,payload:await v1110Payload(request.user.id)})})
app.get('/api/v11.10/health',async()=>({ok:true,stage:'V11.10',storage:hasDatabase?'postgresql':'memory',capabilities:['people-directory','relationship-cadence','commitments-to-others','waiting-on-person','follow-up-tasks','important-dates-to-calendar','meeting-context-count','no-relationship-score'],now:new Date().toISOString()}))



// ============================================================
// NOVA V11.11 — Spiritual & Religious Integration
// Spiritual = dedicated view over canonical Routine.
// Religious occasions = Event(type=religious) + specialized metadata.
// ============================================================
function v1111Today(){ return new Date().toISOString().slice(0,10) }
function v1111AddDays(dateStr,days){ const d=new Date(`${dateStr}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+Number(days||0));return d.toISOString().slice(0,10) }
function v1111EnsureMemorySeed(lifeArg){
  ensureMemoryV11();
  const life=lifeArg||memory;
  memory.v11.spiritual_routines ||= [];
  memory.v11.spiritual_details ||= {};
  memory.v11.religious_details ||= {};
  const area=memory.v11.areas.find(a=>a.name==='معنوی')||memory.v11.areas[0]||null;
  const existing=new Set(memory.v11.spiritual_routines.map(r=>r.id));
  for(const item of (life.modules?.spiritual||[])){
    if(existing.has(item.id)) continue;
    const logs={}; if(item.done) logs[v1111Today()]=true;
    memory.v11.spiritual_routines.push({id:item.id||id(),title:item.title||'روتین معنوی',area_id:area?.id||null,routine_type:'spiritual',description:item.note||'',target_weekly:7,status:'active',color:'#765fd3',logs,created_at:item.created_at||new Date().toISOString(),updated_at:new Date().toISOString()});
    memory.v11.spiritual_details[item.id]={intention:'',preferred_time:'',minimum_action:'',reflection_prompt:''};
  }
}
async function v1111EnsureCanonicalSources(userId){
  const life=await getLifeData(userId);
  if(!hasDatabase){ v1111EnsureMemorySeed(life); return; }
  const areaRes=await app.pg.query("SELECT id FROM areas WHERE user_id=$1 AND name='معنوی' LIMIT 1",[userId]);
  const areaId=areaRes.rows[0]?.id||null;
  for(const item of (life.modules?.spiritual||[])){
    await app.pg.query(`INSERT INTO routines (id,user_id,title,area_id,routine_type,description,target_weekly,status,color,created_at,updated_at)
      VALUES ($1,$2,$3,$4,'spiritual',$5,7,'active','#765fd3',$6,NOW()) ON CONFLICT (id) DO NOTHING`,[item.id||id(),userId,item.title||'روتین معنوی',areaId,item.note||'',item.created_at||new Date().toISOString()]);
    if(item.done) await app.pg.query(`INSERT INTO routine_logs (id,user_id,routine_id,log_date,value) VALUES ($1,$2,$3,$4,TRUE) ON CONFLICT (user_id,routine_id,log_date) DO NOTHING`,[id(),userId,item.id,v1111Today()]);
  }
}
async function v1111SpiritualDetails(userId){
  if(!hasDatabase){v1111EnsureMemorySeed();return memory.v11.spiritual_details||{}}
  const {rows}=await app.pg.query('SELECT * FROM spiritual_routine_details WHERE user_id=$1',[userId]);
  return Object.fromEntries(rows.map(r=>[r.routine_id,r]));
}
async function v1111ReligiousDetails(userId){
  if(!hasDatabase){v1111EnsureMemorySeed();return memory.v11.religious_details||{}}
  const {rows}=await app.pg.query('SELECT * FROM religious_event_details WHERE user_id=$1',[userId]);
  return Object.fromEntries(rows.map(r=>[r.event_id,r]));
}
async function v1111SaveSpiritualDetails(userId,routineId,body={}){
  const d={intention:String(body.intention||''),preferred_time:String(body.preferred_time||''),minimum_action:String(body.minimum_action||''),reflection_prompt:String(body.reflection_prompt||'')};
  if(!hasDatabase){v1111EnsureMemorySeed();memory.v11.spiritual_details[routineId]=d;return d}
  await app.pg.query(`INSERT INTO spiritual_routine_details (routine_id,user_id,intention,preferred_time,minimum_action,reflection_prompt) VALUES ($1,$2,$3,$4,$5,$6)
    ON CONFLICT (routine_id) DO UPDATE SET intention=EXCLUDED.intention,preferred_time=EXCLUDED.preferred_time,minimum_action=EXCLUDED.minimum_action,reflection_prompt=EXCLUDED.reflection_prompt,updated_at=NOW()`,[routineId,userId,d.intention,d.preferred_time,d.minimum_action,d.reflection_prompt]);
  return d;
}
async function v1111SaveReligiousDetails(userId,eventId,body={}){
  const d={observance_notes:String(body.observance_notes||''),preparation_notes:String(body.preparation_notes||''),reminder_days:Math.max(0,Math.min(365,Number(body.reminder_days??1)||0)),source_label:String(body.source_label||'manual')};
  if(!hasDatabase){v1111EnsureMemorySeed();memory.v11.religious_details[eventId]=d;return d}
  await app.pg.query(`INSERT INTO religious_event_details (event_id,user_id,observance_notes,preparation_notes,reminder_days,source_label) VALUES ($1,$2,$3,$4,$5,$6)
    ON CONFLICT (event_id) DO UPDATE SET observance_notes=EXCLUDED.observance_notes,preparation_notes=EXCLUDED.preparation_notes,reminder_days=EXCLUDED.reminder_days,source_label=EXCLUDED.source_label,updated_at=NOW()`,[eventId,userId,d.observance_notes,d.preparation_notes,d.reminder_days,d.source_label]);
  return d;
}
function v1111Adherence(routines,days){
  if(!routines.length)return 0;
  const today=v1111Today();
  let done=0,possible=0;
  for(const r of routines){
    const target=Math.max(1,Math.min(7,Number(r.target_weekly||7)));
    possible += Math.max(1,Math.round(target*days/7));
    for(let i=0;i<days;i++){const d=v1111AddDays(today,-i);if(r.logs?.[d])done++}
  }
  return possible?Math.min(100,Math.round(done/possible*100)):0;
}
async function v1111Payload(userId){
  await v1111EnsureCanonicalSources(userId);
  const [data,sDetails,rDetails]=await Promise.all([getV11Canonical(userId),v1111SpiritualDetails(userId),v1111ReligiousDetails(userId)]);
  const today=v1111Today();
  const routines=(data.routines||[]).filter(r=>r.routine_type==='spiritual'&&r.status!=='paused').map(r=>({...r,details:sDetails[r.id]||{},today_done:Boolean(r.logs?.[today])}));
  const events=(data.events||[]).filter(e=>e.type==='religious').sort((a,b)=>new Date(a.start_at)-new Date(b.start_at));
  const upcoming=events.filter(e=>String(e.start_at||'').slice(0,10)>=today).map(e=>{const date=String(e.start_at).slice(0,10),days=Math.round((new Date(`${date}T12:00:00Z`)-new Date(`${today}T12:00:00Z`))/86400000);return {...e,details:rDetails[e.id]||{},days_until:days}});
  const prepLinks=(data.links||[]).filter(l=>l.source_type==='event'&&l.relation==='preparation_task'&&l.target_type==='task');
  const prepTasks=prepLinks.map(l=>{const t=(data.tasks||[]).find(x=>x.id===l.target_id);const e=events.find(x=>x.id===l.source_id);return t?{...t,event_id:e?.id||l.source_id,event_title:e?.title||'مناسبت'}:null}).filter(Boolean);
  const doneToday=routines.filter(r=>r.today_done).length;
  return {stage:'V11.11',today,spiritual:{routines,summary:{active:routines.length,today_done:doneToday,today_percent:routines.length?Math.round(doneToday/routines.length*100):0,seven_day_percent:v1111Adherence(routines,7),twenty_eight_day_percent:v1111Adherence(routines,28)}},religious:{events,upcoming,preparation_tasks:prepTasks,summary:{upcoming:upcoming.length,next:upcoming[0]||null,open_preparation:prepTasks.filter(t=>t.status!=='done').length}},generated_at:new Date().toISOString()};
}
app.get('/api/v11.11/integration',async request=>v1111Payload(request.user.id));
app.post('/api/v11.11/spiritual-routines',async(request,reply)=>{await v1111EnsureCanonicalSources(request.user.id);const body=request.body||{},title=String(body.title||'').trim();if(!title)return reply.code(400).send({error:'عنوان روتین الزامی است.'});const data=await getV11Canonical(request.user.id),area=v11AreaForName(data.areas,'معنوی');const routine={id:id(),title,area_id:area?.id||null,routine_type:'spiritual',description:String(body.description||''),target_weekly:Math.max(1,Math.min(7,Number(body.target_weekly||7))),status:'active',color:'#765fd3',logs:{},created_at:new Date().toISOString(),updated_at:new Date().toISOString()};if(!hasDatabase){v1111EnsureMemorySeed();memory.v11.spiritual_routines.push(routine)}else await app.pg.query(`INSERT INTO routines (id,user_id,title,area_id,routine_type,description,target_weekly,status,color) VALUES ($1,$2,$3,$4,'spiritual',$5,$6,'active','#765fd3')`,[routine.id,request.user.id,routine.title,routine.area_id,routine.description,routine.target_weekly]);await v1111SaveSpiritualDetails(request.user.id,routine.id,body);return reply.code(201).send(await v1111Payload(request.user.id))});
app.patch('/api/v11.11/spiritual-routines/:id',async(request,reply)=>{await v1111EnsureCanonicalSources(request.user.id);const body=request.body||{},data=await getV11Canonical(request.user.id),cur=data.routines.find(r=>r.id===request.params.id&&r.routine_type==='spiritual');if(!cur)return reply.code(404).send({error:'روتین معنوی پیدا نشد.'});const title=String(body.title??cur.title).trim(),target=Math.max(1,Math.min(7,Number((body.target_weekly??cur.target_weekly)||7)));if(!hasDatabase){v1111EnsureMemorySeed();const i=memory.v11.spiritual_routines.findIndex(r=>r.id===cur.id);if(i>=0)memory.v11.spiritual_routines[i]={...memory.v11.spiritual_routines[i],title,target_weekly:target,description:String((body.description??cur.description)||''),status:body.status||cur.status,updated_at:new Date().toISOString()}}else await app.pg.query('UPDATE routines SET title=$1,target_weekly=$2,description=$3,status=$4,updated_at=NOW() WHERE id=$5 AND user_id=$6 AND routine_type=\'spiritual\'',[title,target,String((body.description??cur.description)||''),body.status||cur.status,cur.id,request.user.id]);await v1111SaveSpiritualDetails(request.user.id,cur.id,{...(await v1111SpiritualDetails(request.user.id))[cur.id],...body});return v1111Payload(request.user.id)});
app.post('/api/v11.11/spiritual-routines/:id/toggle',async(request,reply)=>{await v1111EnsureCanonicalSources(request.user.id);const date=String(request.body?.date||v1111Today()).slice(0,10),data=await getV11Canonical(request.user.id),cur=data.routines.find(r=>r.id===request.params.id&&r.routine_type==='spiritual');if(!cur)return reply.code(404).send({error:'روتین معنوی پیدا نشد.'});const value=request.body?.value===undefined?!Boolean(cur.logs?.[date]):Boolean(request.body.value);if(!hasDatabase){v1111EnsureMemorySeed();const i=memory.v11.spiritual_routines.findIndex(r=>r.id===cur.id);if(i>=0){memory.v11.spiritual_routines[i].logs ||= {};memory.v11.spiritual_routines[i].logs[date]=value}}else await app.pg.query(`INSERT INTO routine_logs (id,user_id,routine_id,log_date,value) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (user_id,routine_id,log_date) DO UPDATE SET value=EXCLUDED.value,updated_at=NOW()`,[id(),request.user.id,cur.id,date,value]);return v1111Payload(request.user.id)});
app.post('/api/v11.11/religious-events',async(request,reply)=>{const body=request.body||{},title=String(body.title||'').trim();if(!title)return reply.code(400).send({error:'عنوان مناسبت الزامی است.'});const date=String(body.date||'').slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return reply.code(400).send({error:'تاریخ مناسبت الزامی است.'});const time=/^\d{2}:\d{2}$/.test(String(body.time||''))?String(body.time):'09:00',start=`${date}T${time}:00`,end=new Date(new Date(start).getTime()+30*60000).toISOString();const event=await createEvent(request.user.id,{title,type:'religious',start_at:start,end_at:end,color:'#765fd3',notes:String(body.notes||'')});await v1111SaveReligiousDetails(request.user.id,event.id,body);return reply.code(201).send(await v1111Payload(request.user.id))});
app.patch('/api/v11.11/religious-events/:id',async(request,reply)=>{const events=await listEvents(request.user.id),cur=events.find(e=>e.id===request.params.id&&e.type==='religious');if(!cur)return reply.code(404).send({error:'مناسبت پیدا نشد.'});const body=request.body||{},date=String(body.date||cur.start_at.slice(0,10)),time=/^\d{2}:\d{2}$/.test(String(body.time||''))?String(body.time):String(cur.start_at).slice(11,16),start=`${date}T${time}:00`,end=new Date(new Date(start).getTime()+30*60000).toISOString();await updateEvent(request.user.id,cur.id,{title:body.title??cur.title,type:'religious',start_at:start,end_at:end,color:cur.color||'#765fd3',notes:body.notes??cur.notes,project_id:cur.project_id||null});await v1111SaveReligiousDetails(request.user.id,cur.id,{...(await v1111ReligiousDetails(request.user.id))[cur.id],...body});return v1111Payload(request.user.id)});
app.post('/api/v11.11/religious-events/:id/create-task',async(request,reply)=>{const data=await v1111Payload(request.user.id),event=data.religious.events.find(e=>e.id===request.params.id);if(!event)return reply.code(404).send({error:'مناسبت پیدا نشد.'});const reminder=Number(event.details?.reminder_days??1),due=request.body?.due_date||v1111AddDays(String(event.start_at).slice(0,10),-reminder),task=await createTask(request.user.id,{title:String(request.body?.title||`آمادگی برای ${event.title}`),description:String(request.body?.description||event.details?.preparation_notes||`اقدام مرتبط با مناسبت «${event.title}»`),due_date:due,priority:request.body?.priority||'medium',estimate_minutes:Number(request.body?.estimate_minutes||30),category:'معنوی'});if(!hasDatabase){v1111EnsureMemorySeed();memory.v11.links ||= [];memory.v11.links.push({id:id(),source_type:'event',source_id:event.id,relation:'preparation_task',target_type:'task',target_id:task.id,created_at:new Date().toISOString()})}else await app.pg.query(`INSERT INTO entity_links (id,user_id,source_type,source_id,relation,target_type,target_id) VALUES ($1,$2,'event',$3,'preparation_task','task',$4) ON CONFLICT DO NOTHING`,[id(),request.user.id,event.id,task.id]);return reply.code(201).send({task,payload:await v1111Payload(request.user.id)})});
app.get('/api/v11.11/health',async()=>({ok:true,stage:'V11.11',storage:hasDatabase?'postgresql':'memory',capabilities:['spiritual-routine-view','shared-routine-engine','religious-event-subtype','religious-event-metadata','preparation-task-linking','dedicated-spiritual-view','dedicated-religious-calendar'],now:new Date().toISOString()}));


app.get('/api/settings', async (request) => listSettings(request.user.id))
app.patch('/api/settings', async (request, reply) => {
  try { return await updateSettings(request.user.id, request.body || {}) } catch (error) { return reply.code(400).send({ error: error.message }) }
})
app.get('/api/stats', async (request) => {
  const userId = request.user.id
  const [tasks, projects, events, life] = await Promise.all([listTasks(userId), listProjects(userId), listEvents(userId), getLifeData(userId)])
  return buildStats(tasks, projects, events, life)
})


// NOVA V11.12 — Finance & Personal Resource Control
function v1112MonthKey(date = today()) { return String(date || today()).slice(0, 7) }
function v1112Num(value) { const n = Number(value); return Number.isFinite(n) ? n : 0 }
function v1112NormalizeFinance(finance = {}) {
  return {
    accounts: Array.isArray(finance.accounts) ? finance.accounts : [],
    transactions: Array.isArray(finance.transactions) ? finance.transactions : [],
    debts: Array.isArray(finance.debts) ? finance.debts : [],
    budgets: Array.isArray(finance.budgets) ? finance.budgets : [],
    commitments: Array.isArray(finance.commitments) ? finance.commitments : []
  }
}
function v1112Summary(finance = {}) {
  const f = v1112NormalizeFinance(finance), month = v1112MonthKey()
  const monthTx = f.transactions.filter(x => String(x.date || '').slice(0, 7) === month && x.status !== 'cancelled')
  const income = monthTx.filter(x => x.type === 'income').reduce((a,b)=>a+v1112Num(b.amount),0)
  const expense = monthTx.filter(x => x.type === 'expense').reduce((a,b)=>a+v1112Num(b.amount),0)
  const liquid = f.accounts.filter(x => x.status !== 'closed').reduce((a,b)=>a+v1112Num(b.balance),0)
  const debtOutstanding = f.debts.filter(x => x.status !== 'done' && x.status !== 'closed').reduce((a,b)=>a+v1112Num(b.amount),0)
  const open = f.commitments.filter(x => x.status !== 'done' && x.status !== 'cancelled')
  const overdue = open.filter(x => x.due_date && String(x.due_date).slice(0,10) < today())
  const due14 = open.filter(x => { if(!x.due_date) return false; const d=(new Date(`${String(x.due_date).slice(0,10)}T12:00:00`)-new Date(`${today()}T12:00:00`))/86400000; return d>=0 && d<=14 })
  const budgetRows = f.budgets.filter(b => !b.period || b.period === month).map(b => {
    const spent = monthTx.filter(x => x.type === 'expense' && (!b.category || x.category === b.category)).reduce((a,t)=>a+v1112Num(t.amount),0)
    const limit = Math.max(0,v1112Num(b.limit_amount)); return {...b, spent_amount:spent, remaining_amount:limit-spent, usage_percent:limit?Math.round(spent/limit*100):0}
  })
  return {month,income,expense,cash_flow:income-expense,liquid_balance:liquid,debt_outstanding:debtOutstanding,commitments_open:open.length,commitments_overdue:overdue.length,commitments_due_14:due14.length,budgets:budgetRows}
}
async function v1112Payload(userId) {
  const life=await getLifeData(userId), finance=v1112NormalizeFinance(life.finance), summary=v1112Summary(finance)
  const commitments=[...finance.commitments].sort((a,b)=>String(a.due_date||'9999').localeCompare(String(b.due_date||'9999')))
  const transactions=[...finance.transactions].sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))).slice(0,120)
  return {stage:'V11.12',finance:{...finance,transactions,commitments,budgets:summary.budgets},summary,generated_at:new Date().toISOString()}
}
app.get('/api/v11.12/finance', async request => v1112Payload(request.user.id))
app.post('/api/v11.12/budgets', async (request, reply) => {
  const life=await getLifeData(request.user.id), f=v1112NormalizeFinance(life.finance), body=request.body||{}, name=String(body.name||body.category||'').trim(), limit=Math.max(0,v1112Num(body.limit_amount))
  if(!name || !limit) return reply.code(400).send({error:'نام و سقف بودجه الزامی است.'})
  const row={id:id(),name,category:String(body.category||name).trim(),period:String(body.period||v1112MonthKey()).slice(0,7),limit_amount:limit,note:String(body.note||''),created_at:new Date().toISOString()}
  f.budgets.push(row); await persistLifeData(request.user.id,{...life,finance:f}); return reply.code(201).send(await v1112Payload(request.user.id))
})
app.patch('/api/v11.12/budgets/:id', async (request, reply) => {
  const life=await getLifeData(request.user.id), f=v1112NormalizeFinance(life.finance), i=f.budgets.findIndex(x=>x.id===request.params.id); if(i<0)return reply.code(404).send({error:'بودجه پیدا نشد.'})
  f.budgets[i]={...f.budgets[i],...(request.body||{}),id:request.params.id,updated_at:new Date().toISOString()}; await persistLifeData(request.user.id,{...life,finance:f}); return v1112Payload(request.user.id)
})
app.post('/api/v11.12/commitments', async (request, reply) => {
  const life=await getLifeData(request.user.id), f=v1112NormalizeFinance(life.finance), body=request.body||{}, title=String(body.title||'').trim(), amount=Math.max(0,v1112Num(body.amount))
  if(!title || !amount) return reply.code(400).send({error:'عنوان و مبلغ تعهد مالی الزامی است.'})
  const row={id:id(),title,amount,due_date:body.due_date?String(body.due_date).slice(0,10):null,direction:body.direction==='receive'?'receive':'pay',status:'open',category:String(body.category||'عمومی'),account:String(body.account||''),note:String(body.note||''),task_id:null,event_id:null,created_at:new Date().toISOString()}
  f.commitments.push(row); await persistLifeData(request.user.id,{...life,finance:f}); return reply.code(201).send(await v1112Payload(request.user.id))
})
app.patch('/api/v11.12/commitments/:id', async (request, reply) => {
  const life=await getLifeData(request.user.id), f=v1112NormalizeFinance(life.finance), i=f.commitments.findIndex(x=>x.id===request.params.id); if(i<0)return reply.code(404).send({error:'تعهد مالی پیدا نشد.'})
  f.commitments[i]={...f.commitments[i],...(request.body||{}),id:request.params.id,updated_at:new Date().toISOString()}; await persistLifeData(request.user.id,{...life,finance:f}); return v1112Payload(request.user.id)
})
app.post('/api/v11.12/commitments/:id/create-task', async (request, reply) => {
  const life=await getLifeData(request.user.id), f=v1112NormalizeFinance(life.finance), c=f.commitments.find(x=>x.id===request.params.id); if(!c)return reply.code(404).send({error:'تعهد مالی پیدا نشد.'})
  if(c.task_id) return {task_id:c.task_id,payload:await v1112Payload(request.user.id)}
  const task=await createTask(request.user.id,{title:String(request.body?.title||`${c.direction==='receive'?'پیگیری دریافت':'پرداخت'} — ${c.title}`),description:String(c.note||'تعهد مالی'),due_date:c.due_date||null,priority:c.due_date&&c.due_date<=today()?'high':'medium',estimate_minutes:Number(request.body?.estimate_minutes||15),category:'مالی'})
  c.task_id=task.id; c.updated_at=new Date().toISOString(); await persistLifeData(request.user.id,{...life,finance:f}); return reply.code(201).send({task,payload:await v1112Payload(request.user.id)})
})
app.post('/api/v11.12/commitments/:id/create-event', async (request, reply) => {
  const life=await getLifeData(request.user.id), f=v1112NormalizeFinance(life.finance), c=f.commitments.find(x=>x.id===request.params.id); if(!c)return reply.code(404).send({error:'تعهد مالی پیدا نشد.'}); if(!c.due_date)return reply.code(400).send({error:'برای تعهد موعد ثبت نشده است.'})
  if(c.event_id) return {event_id:c.event_id,payload:await v1112Payload(request.user.id)}
  const start=`${c.due_date}T09:00:00`, end=`${c.due_date}T09:30:00`; const event=await createEvent(request.user.id,{title:`مالی — ${c.title}`,type:'deadline',start_at:start,end_at:end,color:'#d69b32',notes:c.note||'تعهد مالی'})
  c.event_id=event.id; c.updated_at=new Date().toISOString(); await persistLifeData(request.user.id,{...life,finance:f}); return reply.code(201).send({event,payload:await v1112Payload(request.user.id)})
})
app.post('/api/v11.12/transactions', async (request, reply) => {
  const life=await getLifeData(request.user.id), f=v1112NormalizeFinance(life.finance), body=request.body||{}, amount=Math.max(0,v1112Num(body.amount)); if(!amount)return reply.code(400).send({error:'مبلغ تراکنش الزامی است.'})
  const type=body.type==='income'?'income':'expense', row={id:id(),date:String(body.date||today()).slice(0,10),type,amount,category:String(body.category||'عمومی'),description:String(body.description||'تراکنش'),account:String(body.account||''),status:'confirmed',currency:'IRR',created_at:new Date().toISOString()}
  f.transactions.push(row)
  const acc=f.accounts.find(a=>a.name===row.account||a.id===row.account); if(acc)acc.balance=v1112Num(acc.balance)+(type==='income'?amount:-amount)
  await persistLifeData(request.user.id,{...life,finance:f}); return reply.code(201).send(await v1112Payload(request.user.id))
})
app.get('/api/v11.12/health', async ()=>({ok:true,stage:'V11.12',storage:hasDatabase?'postgresql':'memory',capabilities:['cash-flow-summary','accounts','transactions','budgets','financial-commitments','debt-register','commitment-to-task','commitment-to-calendar','semantic-finance-status'],now:new Date().toISOString()}))

app.post('/api/assistant', async (request, reply) => {
  const message = String(request.body?.message || '').trim()
  if (!message) return reply.code(400).send({ error: 'پیام خالی است.' })
  const context = request.body?.context || {}
  try {
    if (process.env.OPENAI_API_KEY) {
      try {
        return await openAiAssistantStructured(request.user.id, message, context)
      } catch (error) {
        request.log.warn({ err: error }, 'OpenAI assistant unavailable; using local planner fallback')
        const tasks = await listTasks(request.user.id)
        const projects = await listProjects(request.user.id)
        const result = localAssistant(message, tasks, projects)
        for (const item of result.created || []) {
          if (item.type === 'task') await createTask(request.user.id, item.payload)
          if (item.type === 'project') await createProject(request.user.id, item.payload)
        }
        return { ...result, created: result.created || [], provider: 'local-fallback' }
      }
    }
    const tasks = await listTasks(request.user.id)
    const projects = await listProjects(request.user.id)
    const result = localAssistant(message, tasks, projects)
    for (const item of result.created || []) {
      if (item.type === 'task') await createTask(request.user.id, item.payload)
      if (item.type === 'project') await createProject(request.user.id, item.payload)
    }
    return { ...result, created: result.created || [] }
  } catch (error) {
    request.log.error(error)
    return reply.code(502).send({ error: 'دستیار موقتاً در دسترس نیست.' })
  }
})

if (!process.env.VERCEL) {
  await initDatabase()
  app.listen({ port: PORT, host: process.env.HOST || '0.0.0.0' }).then(() => {
    app.log.info(`NOVA API listening on port ${PORT} (${hasDatabase ? 'PostgreSQL' : 'memory fallback'})`)
  }).catch((error) => {
    app.log.error(error)
    process.exit(1)
  })
} else {
  await initDatabase()
}

export default app
