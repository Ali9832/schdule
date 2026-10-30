import { randomUUID } from 'node:crypto'
import { tehranToday } from './planning-date.js'

// The caller supplies a user-scoped transaction; unrelated life data is never rewritten.
export function registerReading(app, { read, change }) {
  const bad = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode })
  const text = (value, max = 300) => String(value ?? '').trim().slice(0, max)
  const bookIn = (state, id) => { const book = state.books.find(b => b.id === id); if (!book) throw bad('کتاب پیدا نشد.', 404); return book }
  const validDay = value => {
    const day = String(value || tehranToday())
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(Date.parse(day)) || new Date(day).toISOString().slice(0, 10) !== day || day > tehranToday()) throw bad('تاریخ مطالعه معتبر نیست یا در آینده است.')
    return day
  }
  function bookValues(body, current = {}) {
    const row = { ...current }
    for (const key of ['title', 'author', 'status', 'reminder_time']) if (Object.hasOwn(body, key)) row[key] = text(body[key])
    if (!row.title) throw bad('نام کتاب را وارد کنید.')
    row.status ||= 'reading'
    if (!['reading', 'planned', 'finished'].includes(row.status)) throw bad('وضعیت کتاب معتبر نیست.')
    if (Object.hasOwn(body, 'daily_minutes')) row.daily_minutes = Number(body.daily_minutes)
    row.daily_minutes ??= 20
    if (!Number.isInteger(row.daily_minutes) || row.daily_minutes < 1 || row.daily_minutes > 1440) throw bad('هدف روزانه باید بین ۱ و ۱۴۴۰ دقیقه باشد.')
    if (Object.hasOwn(body, 'reminder_enabled')) { if (typeof body.reminder_enabled !== 'boolean') throw bad('تنظیم یادآور معتبر نیست.'); row.reminder_enabled = body.reminder_enabled }
    row.reminder_enabled ??= false
    row.reminder_time ||= '20:00'
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(row.reminder_time)) throw bad('ساعت یادآوری معتبر نیست.')
    if(Object.hasOwn(body,'total_pages'))row.total_pages=body.total_pages==null||body.total_pages===''?null:Number(body.total_pages)
    if(row.total_pages!=null&&(!Number.isInteger(row.total_pages)||row.total_pages<1||row.total_pages>100000))throw bad('تعداد صفحهٔ کتاب معتبر نیست.')
    if(Object.hasOwn(body,'current_page')){row.current_page=Number(body.current_page);if(!current.id||row.current_page!==(current.current_page||0))row.progress_date=row.current_page>0||current.id?tehranToday():''}
    row.current_page??=0
    if(!Number.isInteger(row.current_page)||row.current_page<0||row.current_page>100000||(row.total_pages&&row.current_page>row.total_pages))throw bad('صفحهٔ فعلی از تعداد صفحه‌های کتاب بیشتر است یا معتبر نیست.')
    return row
  }
  function pageValues(body,book){
    if(body.start_page==null&&body.end_page==null)return {start_page:null,end_page:null,pages_read:0}
    const start=Number(body.start_page),end=Number(body.end_page)
    if(!Number.isInteger(start)||!Number.isInteger(end)||start<1||end<start||end>100000||(book.total_pages&&end>book.total_pages))throw bad('بازهٔ صفحه‌ها معتبر نیست؛ صفحهٔ پایان باید بین صفحهٔ شروع و پایان کتاب باشد.')
    return {start_page:start,end_page:end,pages_read:end-start+1}
  }
  function timing(body){
    const date=validDay(body.date)
    if(body.start_time!=null||body.end_time!=null){
      const re=/^([01]\d|2[0-3]):[0-5]\d$/
      if(!re.test(body.start_time)||!re.test(body.end_time))throw bad('ساعت شروع و پایان معتبر وارد کنید.')
      const start=Date.parse(date+'T'+body.start_time+':00+03:30'),end=Date.parse(date+'T'+body.end_time+':00+03:30')+(body.end_next_day===true?86400000:0)
      if(end<=start||end-start>86400000)throw bad('پایان باید پس از شروع و مدت حداکثر یک روز باشد.')
      if(end>Date.now()+60000)throw bad('مطالعهٔ انجام‌شده نمی‌تواند در آینده باشد.')
      return {date,start,end,seconds:(end-start)/1000}
    }
    const minutes=Number(body.minutes)
    if(!Number.isInteger(minutes)||minutes<1||minutes>1440)throw bad('مدت مطالعه باید بین ۱ و ۱۴۴۰ دقیقه باشد.')
    return {date,start:null,end:null,seconds:minutes*60}
  }
  const payload = state => {
    const today = tehranToday(), sessions = state.sessions || [], totals=new Map()
    for(const session of sessions){const sum=totals.get(session.book_id)||{total:0,today:0,pages:0};sum.total+=session.seconds;sum.pages+=Number(session.pages_read||0);if(session.date===today)sum.today+=session.seconds;totals.set(session.book_id,sum)}
    return { ...state, today, books: state.books.map(book => {
      const sum=totals.get(book.id)||{total:0,today:0,pages:0}
      return { ...book, current_page:book.current_page||0, total_pages:book.total_pages||null, total_pages_read:sum.pages, total_seconds:sum.total, today_seconds:sum.today }
    }), summary: { total_seconds: sessions.reduce((n, s) => n + s.seconds, 0), today_seconds: sessions.filter(s => s.date === today).reduce((n, s) => n + s.seconds, 0) } }
  }
  app.get('/api/reading', async req => payload(await read(req.user.id)))
  app.get('/api/reading/reminders',async req=>{
    const state=await read(req.user.id),today=tehranToday(),totals=new Map(),pages=new Map()
    for(const session of state.sessions||[]){if(session.date===today)totals.set(session.book_id,(totals.get(session.book_id)||0)+session.seconds);pages.set(session.book_id,(pages.get(session.book_id)||0)+Number(session.pages_read||0))}
    return {today,timer:state.timer,books:state.books.filter(b=>b.reminder_enabled&&b.status==='reading').map(b=>({id:b.id,title:b.title,status:b.status,current_page:b.current_page||0,total_pages:b.total_pages||null,total_pages_read:pages.get(b.id)||0,daily_minutes:b.daily_minutes,reminder_enabled:true,reminder_time:b.reminder_time,today_seconds:totals.get(b.id)||0}))}
  })
  app.post('/api/reading/books', async (req, reply) => {
    const data = await change(req.user.id, state => { state.books.unshift({ ...bookValues(req.body || {}), id: randomUUID(), created_at: new Date().toISOString() }); return payload(state) })
    return reply.code(201).send(data)
  })
  app.patch('/api/reading/books/:id', async req => change(req.user.id, state => {
    const book = bookIn(state, req.params.id)
    if (state.timer?.book_id === book.id && req.body?.status && req.body.status !== 'reading') throw bad('ابتدا زمان‌سنج این کتاب را متوقف کنید.')
    Object.assign(book, bookValues(req.body || {}, book)); return payload(state)
  }))
  app.post('/api/reading/books/:id/sessions', async (req, reply) => {
    const result = await change(req.user.id, state => {
      const book=bookIn(state, req.params.id),body=req.body||{}
      const key = text(body.request_id, 100)
      if (!key) throw bad('شناسهٔ ثبت لازم است.')
      if (state.sessions.some(s => s.id === key)) return payload(state)
      if(body.timer_id&&(!state.timer||state.timer.id!==body.timer_id||state.timer.book_id!==book.id))throw bad('زمان‌سنج این کتاب فعال نیست.',409)
      const pages=pageValues(body,book),time=timing(body),created=new Date().toISOString()
      const base={group_id:key,book_id:book.id,note:text(body.note,2000),created_at:created,source:body.timer_id?'timer':'manual'}
      if(time.start==null)state.sessions.unshift({...base,id:key,date:time.date,seconds:time.seconds,...pages})
      else{
        let cursor=time.start,index=0
        while(cursor<time.end){
          const date=new Date(cursor+12600000).toISOString().slice(0,10),midnight=Date.parse(date+'T00:00:00+03:30')+86400000,end=Math.min(midnight,time.end),last=end===time.end
          state.sessions.unshift({...base,id:index++===0?key:randomUUID(),date,seconds:(end-cursor)/1000,started_at:new Date(cursor).toISOString(),ended_at:new Date(end).toISOString(),...(last?pages:{start_page:null,end_page:null,pages_read:0})});cursor=end
        }
      }
      const progressDate=time.end?new Date(time.end-1+12600000).toISOString().slice(0,10):time.date
      if(pages.end_page!=null&&(!book.progress_date||progressDate>=book.progress_date)){book.current_page=pages.end_page;book.progress_date=progressDate}
      if(body.timer_id)state.timer=null
      return payload(state)
    }); return reply.code(201).send(result)
  })
  app.post('/api/reading/books/:id/start', async req => change(req.user.id, state => {
    const book = bookIn(state, req.params.id)
    if (book.status !== 'reading') throw bad('برای شروع مطالعه وضعیت کتاب را «در حال خواندن» بگذارید.')
    if (state.timer) { if (state.timer.book_id === book.id) return payload(state); throw bad('زمان‌سنج کتاب دیگری فعال است؛ ابتدا آن را متوقف کنید.', 409) }
    state.timer = { id: randomUUID(), book_id: book.id, started_at: new Date().toISOString(), date: tehranToday() }
    return payload(state)
  }))
  app.post('/api/reading/timer/stop', async req => change(req.user.id, state => {
    const timerId = text(req.body?.timer_id, 100)
    if (!timerId) throw bad('شناسهٔ زمان‌سنج لازم است.')
    if (!state.timer || state.timer.id !== timerId) {
      if (state.sessions.some(s => s.id === timerId)) return payload(state)
      throw bad('این زمان‌سنج فعال نیست.', 409)
    }
    const timer = state.timer, seconds = Math.max(1, Math.floor((Date.now() - Date.parse(timer.started_at)) / 1000))
    if (seconds > 86400 && !req.body?.discard) throw bad('زمان‌سنج بیش از یک روز باز مانده؛ آن را کنار بگذارید و زمان واقعی مطالعه را دستی ثبت کنید.')
    if (!req.body?.discard) {
      // Split sessions at Tehran midnight so daily totals remain accurate.
      let cursor = Date.parse(timer.started_at), remaining = seconds
      while (remaining > 0) {
        const local = new Date(cursor + 12600000), date = local.toISOString().slice(0, 10)
        const midnight = Date.parse(date + 'T00:00:00+03:30') + 86400000
        const part = Math.min(remaining, Math.max(1, Math.ceil((midnight - cursor) / 1000)))
        state.sessions.unshift({ id: cursor === Date.parse(timer.started_at) ? timer.id : randomUUID(), book_id: timer.book_id, seconds: part, date, note: '', source: 'timer', created_at: new Date().toISOString() })
        cursor += part * 1000; remaining -= part
      }
    }
    state.timer = null; return payload(state)
  }))
}
