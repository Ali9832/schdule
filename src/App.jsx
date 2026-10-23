import { useEffect, useMemo, useState } from 'react'

const icons = {
  dashboard: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm10 0h6v-9h-6v9Zm0-16v5h6V4h-6Z" /></svg>
  ),
  tasks: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.1 16.6-3.7-3.7 1.4-1.4 2.3 2.3 7.1-7.1 1.4 1.4-8.5 8.5ZM4 4h16v2H4V4Zm0 14h11v2H4v-2Z" /></svg>
  ),
  projects: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h4l2 2h5A2.5 2.5 0 0 1 20 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5v-11ZM6.5 5a.5.5 0 0 0-.5.5V7h12V7.5a.5.5 0 0 0-.5-.5h-5.8l-2-2H6.5Z" /></svg>
  ),
  calendar: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 2h2v3h6V2h2v3h1.5A2.5 2.5 0 0 1 21 7.5v11a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 18.5v-11A2.5 2.5 0 0 1 5.5 5H7V2Zm12 8H5v8.5c0 .28.22.5.5.5h13a.5.5 0 0 0 .5-.5V10ZM5.5 7a.5.5 0 0 0-.5.5V8h14v-.5a.5.5 0 0 0-.5-.5h-13Z" /></svg>
  ),
  spark: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 1.4 5.1L18 9l-4.6 1.9L12 16l-1.4-5.1L6 9l4.6-1.9L12 2Zm7 11 .8 2.2L22 16l-2.2.8L19 19l-.8-2.2L16 16l2.2-.8L19 13ZM5 14l.9 2.6L8.5 18l-2.6.9L5 21.5l-.9-2.6L1.5 18l2.6-.9L5 14Z" /></svg>
  ),
  plus: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5Z" /></svg>
  ),
  arrow: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m13.2 5.2 1.4 1.4L11.2 10H20v2h-8.8l3.4 3.4-1.4 1.4-5.8-5.8 5.8-5.8Z" /></svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.4 16.6-4-4 1.4-1.4 2.6 2.6 7.8-7.8 1.4 1.4-9.2 9.2Z" /></svg>
  ),
  close: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6.4 5 5.6 5.6L17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4 6.4 5Z" /></svg>
  ),
  menu: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16v2H4V6Zm0 5h16v2H4v-2Zm0 5h16v2H4v-2Z" /></svg>
  ),
  bolt: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.1 2 4 13h6l-.9 9L18 11h-6l1.1-9Z" /></svg>
  ),
  clock: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 1 1-9 9 9 9 0 0 1 9-9Zm0 2a7 7 0 1 0 7 7 7 7 0 0 0-7-7Zm1 1v5.6l3.6 2.1-1 1.7-4.6-2.8V6h2Z" /></svg>
  ),
  more: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 10a2 2 0 1 1 0 4 2 2 0 0 1 0-4Zm7 0a2 2 0 1 1 0 4 2 2 0 0 1 0-4Zm7 0a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z" /></svg>
  ),
  chat: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-5 3v-3.2A2 2 0 0 1 2 16V6a2 2 0 0 1 2-2Zm0 2v10.9l4.4-2.9H20V6H4Zm3 3h10v2H7V9Zm0 4h7v2H7v-2Z" /></svg>
  ),
  search: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m16.3 14.9 4.4 4.4-1.4 1.4-4.4-4.4a7 7 0 1 1 1.4-1.4ZM10 15a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z" /></svg>
  )
}

const priorityLabels = { high: 'بالا', medium: 'متوسط', low: 'کم' }
const statusLabels = { todo: 'در صف', in_progress: 'در حال انجام', done: 'انجام شد' }
const statusOrder = ['todo', 'in_progress', 'done']

function formatDate(dateString, options = {}) {
  if (!dateString) return 'بدون تاریخ'
  return new Intl.DateTimeFormat('fa-IR', { month: 'short', day: 'numeric', ...options }).format(new Date(dateString))
}

function formatLongDate(date = new Date()) {
  return new Intl.DateTimeFormat('fa-IR', { weekday: 'long', day: 'numeric', month: 'long' }).format(date)
}

function percent(value) {
  return `${Math.min(100, Math.max(0, Number(value) || 0))}%`
}

function App() {
  const [token, setToken] = useState(() => localStorage.getItem('nova_session') || '')
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('nova_user') || 'null') } catch { return null }
  })
  const [view, setView] = useState('dashboard')
  const [mobileNav, setMobileNav] = useState(false)
  const [data, setData] = useState({
    tasks: [],
    projects: [],
    events: [],
    stats: {},
    activity: [],
    goals: [],
    habits: [],
    weekly_plan: [],
    daily_logs: [],
    ideas: [],
    finance: { accounts: [], transactions: [], debts: [] },
    settings: {
      display_name: 'مهسا رضایی',
      workspace_name: 'NOAVA',
      page_titles: {}
    }
  })
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState('')
  const [modal, setModal] = useState(null)
  const [selectedTask, setSelectedTask] = useState(null)
  const [taskFilter, setTaskFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [assistantOpen, setAssistantOpen] = useState(true)
  const [assistantMessages, setAssistantMessages] = useState([
    { role: 'assistant', text: 'سلام! من همراه برنامه‌ریزی تو هستم. یک هدف یا کار خام را بنویس تا آن را به قدم‌های روشن و اولویت‌دار تبدیل کنیم.' }
  ])
  const [assistantInput, setAssistantInput] = useState('')
  const [assistantBusy, setAssistantBusy] = useState(false)

  const loadData = async () => {
    if (!token) { setLoading(false); return }
    try {
      setLoading(true)
      const response = await fetch('/api/bootstrap', { headers: { Authorization: `Bearer ${token}` } })
      if (!response.ok) throw new Error('bootstrap failed')
      setData(await response.json())
    } catch {
      setNotice('دریافت اطلاعات ممکن نشد. اتصال یا نشست کاربری را بررسی کنید.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [token])

  useEffect(() => {
    if (!notice) return undefined
    const timer = setTimeout(() => setNotice(''), 3600)
    return () => clearTimeout(timer)
  }, [notice])

  useEffect(() => {
    const labels = data.settings?.page_titles || {}
    const fallback = {
      dashboard: 'نمای کلی',
      today: 'امروز',
      weekly: 'برنامه هفتگی',
      tasks: 'تسک‌ها',
      projects: 'پروژه‌ها',
      goals: 'هدف‌ها',
      habits: 'عادت‌ها',
      finance: 'مالی',
      ideas: 'ایده‌ها',
      journal: 'ثبت روزانه',
      calendar: 'تقویم تمرکز',
      analytics: 'تحلیل عملکرد',
      settings: 'تنظیمات',
      profile: 'پروفایل کاربری'
    }
    document.title = `${labels[view] || fallback[view] || 'NOAVA'} · ${data.settings?.workspace_name || 'NOAVA'}`
  }, [view, data.settings])

  const visibleTasks = useMemo(() => {
    const normalized = search.trim().toLowerCase()
    return data.tasks.filter((task) => {
      const matchesFilter = taskFilter === 'all' || task.status === taskFilter
      const matchesSearch = !normalized || `${task.title} ${task.description || ''}`.toLowerCase().includes(normalized)
      return matchesFilter && matchesSearch
    })
  }, [data.tasks, taskFilter, search])

  const todayTasks = useMemo(() => data.tasks.filter((task) => task.due_date === data.stats.today), [data.tasks, data.stats.today])
  const activeProjects = useMemo(() => data.projects.filter((project) => project.status !== 'done'), [data.projects])
  const todayEvents = useMemo(() => data.events.filter((event) => event.start_at?.slice(0, 10) === data.stats.today), [data.events, data.stats.today])

  const notify = (message) => setNotice(message)

  async function api(path, options = {}) {
    const headers = { ...(options.headers || {}) }
    if (token) headers.Authorization = `Bearer ${token}`
    if (options.body !== undefined && options.body !== null && !headers['Content-Type'] && !headers['content-type']) {
      headers['Content-Type'] = 'application/json'
    }
    const response = await fetch(path, {
      ...options,
      headers
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload.error || 'خطایی رخ داد')
    return payload
  }

  function handleAuth(session) {
    localStorage.setItem('nova_session', session.token)
    localStorage.setItem('nova_user', JSON.stringify(session.user))
    setToken(session.token)
    setUser(session.user)
  }

  function logout() {
    localStorage.removeItem('nova_session')
    localStorage.removeItem('nova_user')
    setToken('')
    setUser(null)
  }

  async function saveTask(task) {
    try {
      if (task.id) {
        await api(`/api/tasks/${task.id}`, { method: 'PATCH', body: JSON.stringify(task) })
        notify('تسک با موفقیت به‌روزرسانی شد.')
      } else {
        await api('/api/tasks', { method: 'POST', body: JSON.stringify(task) })
        notify('تسک جدید به برنامه اضافه شد.')
      }
      setModal(null)
      await loadData()
    } catch (error) { notify(error.message) }
  }

  async function changeTaskStatus(task, status) {
    try {
      await api(`/api/tasks/${task.id}`, { method: 'PATCH', body: JSON.stringify({ status }) })
      await loadData()
      notify(status === 'done' ? 'عالیه! یک قدم دیگر کامل شد.' : 'وضعیت تسک تغییر کرد.')
    } catch (error) { notify(error.message) }
  }

  async function removeTask(task) {
    if (!window.confirm(`تسک «${task.title}» حذف شود؟`)) return
    try {
      await api(`/api/tasks/${task.id}`, { method: 'DELETE' })
      setData((current) => ({ ...current, tasks: current.tasks.filter((item) => item.id !== task.id) }))
      notify('تسک حذف شد.')
    } catch (error) { notify(error.message) }
  }

  async function saveProject(project) {
    try {
      if (project.id) {
        await api(`/api/projects/${project.id}`, { method: 'PATCH', body: JSON.stringify(project) })
        notify('پروژه به‌روزرسانی شد.')
      } else {
        await api('/api/projects', { method: 'POST', body: JSON.stringify(project) })
        notify('پروژه جدید ساخته شد.')
      }
      setModal(null)
      await loadData()
    } catch (error) { notify(error.message) }
  }

  async function removeProject(project) {
    if (!window.confirm(`پروژه «${project.name}» حذف شود؟ تسک‌های آن بدون پروژه باقی می‌مانند.`)) return
    try {
      await api(`/api/projects/${project.id}`, { method: 'DELETE' })
      await loadData()
      notify('پروژه حذف شد.')
    } catch (error) { notify(error.message) }
  }

  async function saveEvent(event) {
    try {
      if (event.id) {
        await api(`/api/events/${event.id}`, { method: 'PATCH', body: JSON.stringify(event) })
        notify('رویداد به‌روزرسانی شد.')
      } else {
        await api('/api/events', { method: 'POST', body: JSON.stringify(event) })
        notify('رویداد به تقویم اضافه شد.')
      }
      setModal(null)
      await loadData()
    } catch (error) { notify(error.message) }
  }

  async function removeEvent(event) {
    if (!window.confirm(`رویداد «${event.title}» حذف شود؟`)) return
    try {
      await api(`/api/events/${event.id}`, { method: 'DELETE' })
      await loadData()
      notify('رویداد حذف شد.')
    } catch (error) { notify(error.message) }
  }

  async function toggleHabit(habit, date) {
    try {
      await api(`/api/habits/${habit.id}/toggle`, {
        method: 'POST',
        body: JSON.stringify({ date })
      })
      await loadData()
      notify(`عادت «${habit.title}» به‌روزرسانی شد.`)
    } catch (error) { notify(error.message) }
  }

  async function saveGoal(goal) {
    try {
      if (goal.id) {
        await api(`/api/goals/${goal.id}`, { method: 'PATCH', body: JSON.stringify(goal) })
        notify('هدف به‌روزرسانی شد.')
      } else {
        await api('/api/goals', { method: 'POST', body: JSON.stringify(goal) })
        notify('هدف جدید ثبت شد.')
      }
      setModal(null)
      await loadData()
    } catch (error) { notify(error.message) }
  }

  async function removeGoal(goal) {
    if (!window.confirm(`هدف «${goal.title}» حذف شود؟`)) return
    try {
      await api(`/api/goals/${goal.id}`, { method: 'DELETE' })
      await loadData()
      notify('هدف حذف شد.')
    } catch (error) { notify(error.message) }
  }

  async function saveHabit(habit) {
    try {
      if (habit.id) {
        await api(`/api/habits/${habit.id}`, { method: 'PATCH', body: JSON.stringify(habit) })
        notify('عادت به‌روزرسانی شد.')
      } else {
        await api('/api/habits', { method: 'POST', body: JSON.stringify(habit) })
        notify('عادت جدید ثبت شد.')
      }
      setModal(null)
      await loadData()
    } catch (error) { notify(error.message) }
  }

  async function removeHabit(habit) {
    if (!window.confirm(`عادت «${habit.title}» حذف شود؟`)) return
    try {
      await api(`/api/habits/${habit.id}`, { method: 'DELETE' })
      await loadData()
      notify('عادت حذف شد.')
    } catch (error) { notify(error.message) }
  }

  async function saveIdea(idea) {
    try {
      await api(idea.id ? `/api/ideas/${idea.id}` : '/api/ideas', { method: idea.id ? 'PATCH' : 'POST', body: JSON.stringify(idea) })
      setModal(null); await loadData(); notify(idea.id ? 'ایده به‌روزرسانی شد.' : 'ایده ثبت شد.')
    } catch (error) { notify(error.message) }
  }
  async function removeIdea(idea) {
    if (!window.confirm(`ایده «${idea.title}» حذف شود؟`)) return
    try { await api(`/api/ideas/${idea.id}`, { method: 'DELETE' }); await loadData(); notify('ایده حذف شد.') } catch (error) { notify(error.message) }
  }
  async function saveJournal(log) {
    try {
      await api(log.id ? `/api/daily-logs/${log.id}` : '/api/daily-logs', { method: log.id ? 'PATCH' : 'POST', body: JSON.stringify(log) })
      setModal(null); await loadData(); notify(log.id ? 'ثبت روزانه به‌روزرسانی شد.' : 'ثبت روزانه ذخیره شد.')
    } catch (error) { notify(error.message) }
  }
  async function removeJournal(log) {
    if (!window.confirm('این ثبت روزانه حذف شود؟')) return
    try { await api(`/api/daily-logs/${log.id}`, { method: 'DELETE' }); await loadData(); notify('ثبت روزانه حذف شد.') } catch (error) { notify(error.message) }
  }
  async function saveFinance(kind, item) {
    const base = `/api/finance/${kind}`
    const path = item.id ? `${base}/${item.id}` : base
    try {
      await api(path, { method: item.id ? 'PATCH' : 'POST', body: JSON.stringify(item) })
      setModal(null); await loadData(); notify(item.id ? 'مورد مالی به‌روزرسانی شد.' : 'مورد مالی ثبت شد.')
    } catch (error) { notify(error.message) }
  }
  async function removeFinance(kind, item) {
    if (!window.confirm('این مورد مالی حذف شود؟')) return
    try { await api(`/api/finance/${kind}/${item.id}`, { method: 'DELETE' }); await loadData(); notify('مورد مالی حذف شد.') } catch (error) { notify(error.message) }
  }
  async function saveWeekly(item) {
    try {
      await api(item.id ? `/api/weekly-plan/${item.id}` : '/api/weekly-plan', { method: item.id ? 'PATCH' : 'POST', body: JSON.stringify(item) })
      setModal(null); await loadData(); notify(item.id ? 'آیتم برنامه به‌روزرسانی شد.' : 'آیتم برنامه ثبت شد.')
    } catch (error) { notify(error.message) }
  }
  async function removeWeekly(item) {
    if (!window.confirm('این آیتم برنامه حذف شود؟')) return
    try { await api(`/api/weekly-plan/${item.id}`, { method: 'DELETE' }); await loadData(); notify('آیتم برنامه حذف شد.') } catch (error) { notify(error.message) }
  }

  async function saveSettings(settings) {
    try {
      const updated = await api('/api/settings', { method: 'PATCH', body: JSON.stringify(settings) })
      setData((current) => ({ ...current, settings: updated }))
      notify('تنظیمات ذخیره شد.')
    } catch (error) { notify(error.message) }
  }

  async function sendAssistant(message = assistantInput) {
    const trimmed = message.trim()
    if (!trimmed || assistantBusy) return
    setAssistantInput('')
    setAssistantMessages((messages) => [...messages, { role: 'user', text: trimmed }])
    setAssistantBusy(true)
    try {
      const result = await api('/api/assistant', {
        method: 'POST',
        body: JSON.stringify({
          message: trimmed,
          context: { tasks: data.tasks, projects: data.projects, events: data.events, stats: data.stats }
        })
      })
      const providerNote = result.provider === 'openai' ? ' · پاسخ با مدل متصل تولید شد' : result.provider === 'local-fallback' ? ' · حالت محلی' : ''
      setAssistantMessages((messages) => [...messages, { role: 'assistant', text: `${result.reply}${providerNote}`, actions: result.actions || [] }])
      if (result.created?.length) {
        await loadData()
        notify(`${result.created.length} مورد از پیشنهاد دستیار به برنامه اضافه شد.`)
      }
    } catch (error) {
      setAssistantMessages((messages) => [...messages, { role: 'assistant', text: `نتوانستم درخواست را پردازش کنم: ${error.message}` }])
    } finally { setAssistantBusy(false) }
  }

  const pageTitles = data.settings?.page_titles || {}
  const titleFor = (id, fallback) => pageTitles[id] || fallback
  const navItems = [
    { id: 'dashboard', label: titleFor('dashboard', 'نمای کلی'), icon: icons.dashboard },
    { id: 'today', label: titleFor('today', 'امروز'), icon: icons.bolt, badge: data.stats.due_today },
    { id: 'weekly', label: titleFor('weekly', 'برنامه هفتگی'), icon: icons.calendar },
    { id: 'tasks', label: titleFor('tasks', 'تسک‌ها'), icon: icons.tasks, badge: data.stats.open_tasks },
    { id: 'projects', label: titleFor('projects', 'پروژه‌ها'), icon: icons.projects },
    { id: 'goals', label: titleFor('goals', 'هدف‌ها'), icon: <span className="nav-icon nav-icon--text">◎</span>, badge: data.stats.active_goals },
    { id: 'habits', label: titleFor('habits', 'عادت‌ها'), icon: <span className="nav-icon nav-icon--text">✓</span> },
    { id: 'finance', label: titleFor('finance', 'مالی'), icon: <span className="nav-icon nav-icon--text">₮</span> },
    { id: 'ideas', label: titleFor('ideas', 'ایده‌ها'), icon: <span className="nav-icon nav-icon--text">✦</span> },
    { id: 'journal', label: titleFor('journal', 'ثبت روزانه'), icon: <span className="nav-icon nav-icon--text">✎</span> },
    { id: 'calendar', label: titleFor('calendar', 'تقویم تمرکز'), icon: icons.calendar },
    { id: 'analytics', label: titleFor('analytics', 'تحلیل عملکرد'), icon: <span className="nav-icon nav-icon--text">◒</span> }
  ]

  const openProfile = () => { setView('profile'); setMobileNav(false) }

  if (!token || !user) return <AuthScreen onAuth={handleAuth} />

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? 'sidebar--open' : ''}`}>
        <div className="brand">
          <div className="brand-mark"><span></span><span></span><span></span></div>
          <div><strong>NOAVA</strong><small>آوای نو</small></div>
        </div>
        <div className="workspace-switcher">
          <div className="avatar avatar--small">م</div>
          <div><b>{data.settings?.workspace_name || 'فضای شخصی من'}</b><span>Workspace · خصوصی</span></div>
          <span className="chevron">⌄</span>
        </div>
        <nav className="side-nav">
          <p className="nav-caption">فضای کاری</p>
          {navItems.map((item) => (
            <button key={item.id} className={`nav-item ${view === item.id ? 'nav-item--active' : ''}`} onClick={() => { setView(item.id); setMobileNav(false) }}>
              {item.icon}<span>{item.label}</span>{item.badge ? <em>{item.badge}</em> : null}
            </button>
          ))}
          <p className="nav-caption nav-caption--spaced">تنظیمات</p>
          <button className={`nav-item ${view === 'profile' ? 'nav-item--active' : ''}`} onClick={openProfile}>
            <span className="nav-icon nav-icon--text">◉</span><span>پروفایل کاربری</span>
          </button>
          <button className={`nav-item ${view === 'settings' ? 'nav-item--active' : ''}`} onClick={() => { setView('settings'); setMobileNav(false) }}>
            <span className="nav-icon nav-icon--text">⚙</span><span>{titleFor('settings', 'تنظیمات')}</span>
          </button>
          <button className="nav-item" onClick={() => notify('راهنما به‌زودی در دسترس است.')}>
            <span className="nav-icon nav-icon--text">?</span><span>راهنما و میانبرها</span>
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="streak-card">
            <div className="streak-icon">{icons.bolt}</div>
            <div><strong>۷ روز پیوسته</strong><span>ریتمت را حفظ کن!</span></div>
            <span className="streak-dots">•••</span>
          </div>
          <div className="profile-row profile-row--button" role="button" tabIndex={0} onClick={openProfile} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openProfile() } }}>
            <div className="avatar">م</div>
            <div><strong>{user.display_name || data.settings?.display_name}</strong><span>{user.email}</span></div>
            <button className="icon-button icon-button--muted" title="خروج" onClick={(event) => { event.stopPropagation(); logout() }}>↪</button>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <button className="mobile-menu icon-button" onClick={() => setMobileNav((value) => !value)}>{icons.menu}</button>
          <div className="breadcrumb"><span>فضای شخصی</span><b>/</b><strong>{view === 'settings' ? titleFor('settings', 'تنظیمات') : view === 'profile' ? 'پروفایل کاربری' : navItems.find((item) => item.id === view)?.label}</strong></div>
          <div className="topbar-actions">
            <label className="search-box"><span>{icons.search}</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="جست‌وجو در برنامه..." /><kbd>⌘ K</kbd></label>
            <button className="icon-button notification-button" onClick={() => notify('فعلاً اعلان جدیدی نداری.')}>♢<i></i></button>
            <button className="top-avatar avatar" onClick={openProfile} aria-label="باز کردن پروفایل کاربری" title="پروفایل کاربری">م</button>
          </div>
        </header>

        <div className="page">
          {notice ? <div className="toast"><span>✦</span>{notice}</div> : null}
          {view === 'dashboard' && (
            <Dashboard
              stats={data.stats}
              tasks={todayTasks}
              projects={activeProjects}
              activity={data.activity}
              loading={loading}
              onAddTask={() => setModal({ type: 'task' })}
              onOpenTasks={() => setView('tasks')}
              onOpenProjects={() => setView('projects')}
              onStatus={changeTaskStatus}
              onEdit={(task) => setModal({ type: 'task', item: task })}
              onAssistant={() => setAssistantOpen(true)}
            />
          )}
          {view === 'today' && (
            <TodayView
              tasks={todayTasks}
              events={todayEvents}
              stats={data.stats}
              onAddTask={() => setModal({ type: 'task' })}
              onAddEvent={() => setModal({ type: 'event' })}
              onStatus={changeTaskStatus}
              onEdit={(task) => setModal({ type: 'task', item: task })}
            />
          )}
          {view === 'weekly' && <WeeklyPlannerView plan={data.weekly_plan} events={data.events} tasks={data.tasks} onAddEvent={() => setModal({ type: 'event' })} onAdd={() => setModal({ type: 'weekly' })} onEdit={(item) => setModal({ type: 'weekly', item })} onDelete={removeWeekly} />}
          {view === 'tasks' && (
            <TasksView
              tasks={visibleTasks}
              filter={taskFilter}
              setFilter={setTaskFilter}
              onAdd={() => setModal({ type: 'task' })}
              onStatus={changeTaskStatus}
              onEdit={(task) => setModal({ type: 'task', item: task })}
              onDelete={removeTask}
              onSelect={(task) => setSelectedTask(task)}
            />
          )}
          {view === 'projects' && (
            <ProjectsView projects={data.projects} onAdd={() => setModal({ type: 'project' })} onEdit={(project) => setModal({ type: 'project', item: project })} onDelete={removeProject} onOpenTasks={() => setView('tasks')} />
          )}
          {view === 'goals' && <GoalsView goals={data.goals} onAdd={() => setModal({ type: 'goal' })} onEdit={(goal) => setModal({ type: 'goal', item: goal })} onDelete={removeGoal} />}
          {view === 'habits' && <HabitsView habits={data.habits} today={data.stats.today} onToggle={toggleHabit} onAdd={() => setModal({ type: 'habit' })} onEdit={(habit) => setModal({ type: 'habit', item: habit })} onDelete={removeHabit} />}
          {view === 'finance' && <FinanceView finance={data.finance} stats={data.stats} onAdd={(type) => setModal({ type })} onEdit={(type, item) => setModal({ type, item })} onDelete={removeFinance} />}
          {view === 'ideas' && <IdeasView ideas={data.ideas} onAdd={() => setModal({ type: 'idea' })} onEdit={(idea) => setModal({ type: 'idea', item: idea })} onDelete={removeIdea} />}
          {view === 'journal' && <JournalView logs={data.daily_logs} onAdd={() => setModal({ type: 'journal' })} onEdit={(log) => setModal({ type: 'journal', item: log })} onDelete={removeJournal} />}
          {view === 'calendar' && <CalendarView tasks={data.tasks} events={data.events} onStatus={changeTaskStatus} onAddTask={() => setModal({ type: 'task' })} onAddEvent={() => setModal({ type: 'event' })} onEditEvent={(event) => setModal({ type: 'event', item: event })} onDeleteEvent={removeEvent} />}
          {view === 'analytics' && <AnalyticsView stats={data.stats} tasks={data.tasks} projects={data.projects} />}
          {view === 'settings' && <SettingsView settings={data.settings} onSave={saveSettings} onReset={() => saveSettings({ page_titles: {} })} />}
          {view === 'profile' && <ProfileView user={user} settings={data.settings} onLogout={logout} />}
        </div>
      </main>

      <AssistantPanel
        open={assistantOpen}
        messages={assistantMessages}
        input={assistantInput}
        setInput={setAssistantInput}
        busy={assistantBusy}
        onClose={() => setAssistantOpen(false)}
        onSend={sendAssistant}
      />
      {!assistantOpen ? <button className="assistant-fab" onClick={() => setAssistantOpen(true)}>{icons.spark}<span>همراه من</span></button> : null}

      {modal?.type === 'task' ? <TaskModal task={modal.item} projects={data.projects} onClose={() => setModal(null)} onSave={saveTask} /> : null}
      {modal?.type === 'project' ? <ProjectModal project={modal.item} onClose={() => setModal(null)} onSave={saveProject} /> : null}
      {modal?.type === 'event' ? <EventModal event={modal.item} projects={data.projects} onClose={() => setModal(null)} onSave={saveEvent} /> : null}
      {modal?.type === 'goal' ? <GoalModal goal={modal.item} onClose={() => setModal(null)} onSave={saveGoal} /> : null}
      {modal?.type === 'habit' ? <HabitModal habit={modal.item} onClose={() => setModal(null)} onSave={saveHabit} /> : null}
      {modal?.type === 'idea' ? <IdeaModal idea={modal.item} onClose={() => setModal(null)} onSave={saveIdea} /> : null}
      {modal?.type === 'journal' ? <JournalModal log={modal.item} onClose={() => setModal(null)} onSave={saveJournal} /> : null}
      {modal?.type === 'account' ? <FinanceModal kind="accounts" item={modal.item} onClose={() => setModal(null)} onSave={(item) => saveFinance('accounts', item)} /> : null}
      {modal?.type === 'transaction' ? <FinanceModal kind="transactions" item={modal.item} onClose={() => setModal(null)} onSave={(item) => saveFinance('transactions', item)} /> : null}
      {modal?.type === 'debt' ? <FinanceModal kind="debts" item={modal.item} onClose={() => setModal(null)} onSave={(item) => saveFinance('debts', item)} /> : null}
      {modal?.type === 'weekly' ? <WeeklyModal item={modal.item} onClose={() => setModal(null)} onSave={saveWeekly} /> : null}
      {selectedTask ? <TaskDetail task={selectedTask} onClose={() => setSelectedTask(null)} onStatus={changeTaskStatus} onEdit={(task) => { setSelectedTask(null); setModal({ type: 'task', item: task }) }} /> : null}
    </div>
  )
}

function ProfileView({ user, settings, onLogout }) {
  const displayName = user?.display_name || settings?.display_name || 'کاربر'
  return <>
    <section className="page-heading"><div><span className="eyebrow"><span className="eyebrow-dot"></span>حساب من</span><h1>پروفایل کاربری</h1><p>اطلاعات حساب و فضای کاری شما</p></div></section>
    <section className="profile-page-panel">
      <div className="profile-page-avatar" aria-hidden="true">{displayName.slice(0, 1)}</div>
      <div className="profile-page-details"><h2>{displayName}</h2><p>{user?.email || 'نشانی ایمیل ثبت نشده'}</p><span>عضو فضای {settings?.workspace_name || 'NOAVA'}</span></div>
      <button className="secondary-button profile-logout" onClick={onLogout}>خروج از حساب</button>
    </section>
  </>
}

function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState('login')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const response = await fetch(`/api/auth/${mode === 'login' ? 'login' : 'register'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mode === 'login' ? { email, password } : { display_name: displayName, email, password })
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'امکان ورود وجود ندارد.')
      onAuth(payload)
    } catch (submitError) {
      setError(submitError.message)
    } finally { setBusy(false) }
  }

  return (
    <main className="auth-page" dir="rtl">
      <section className="auth-card">
        <div className="brand auth-brand"><div className="brand-mark"><span></span><span></span><span></span></div><div><strong>NOAVA</strong><small>برنامه‌ریزی شخصی، برای هر نفر</small></div></div>
        <h1>{mode === 'login' ? 'خوش آمدی' : 'حساب جدید بساز'}</h1>
        <p>{mode === 'login' ? 'برای دیدن فضای شخصی خود وارد شو.' : 'هر کاربر فضای خصوصی و داده‌های مستقل خودش را دارد.'}</p>
        <form className="auth-form" onSubmit={submit}>
          {mode === 'register' ? <label className="field"><span>نام نمایشی</span><input required minLength="2" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="مثلاً علی" /></label> : null}
          <label className="field"><span>ایمیل</span><input required type="email" dir="ltr" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" /></label>
          <label className="field"><span>رمز عبور</span><input required minLength="8" type="password" dir="ltr" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="حداقل ۸ کاراکتر" /></label>
          {error ? <p className="auth-error">{error}</p> : null}
          <button className="primary-button" disabled={busy}>{busy ? 'لطفاً صبر کن...' : mode === 'login' ? 'ورود به NOAVA' : 'ساخت حساب'}</button>
        </form>
        <button className="auth-switch" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}>
          {mode === 'login' ? 'حساب نداری؟ ثبت‌نام کن' : 'حساب داری؟ وارد شو'}
        </button>
      </section>
    </main>
  )
}

function Dashboard({ stats, tasks, projects, activity, loading, onAddTask, onOpenTasks, onOpenProjects, onStatus, onEdit, onAssistant }) {
  const chart = stats.weekly?.length ? stats.weekly.map((item) => Math.min(100, item.planned * 24 + item.done * 18 + 12)) : [36, 54, 42, 70, 58, 78, 64]
  return (
    <>
      <section className="hero-row">
        <div>
          <div className="eyebrow"><span className="eyebrow-dot"></span>{formatLongDate()}</div>
          <h1>روزت را با <span>تمرکز</span> بساز، مهسا.</h1>
          <p className="hero-subtitle">هر قدم کوچک، بخشی از تصویری بزرگ‌تر است. امروز فقط روی مهم‌ترین‌ها تمرکز کن.</p>
        </div>
        <button className="primary-button" onClick={onAddTask}>{icons.plus}<span>تسک جدید</span></button>
      </section>

      <section className="metrics-grid">
        <MetricCard icon="◎" label="تسک‌های باز" value={stats.open_tasks ?? '—'} helper="از هفته قبل" trend={stats.task_trend} tone="purple" />
        <MetricCard icon="◷" label="زمان برنامه‌ریزی‌شده" value={`${stats.focus_hours ?? 0}h`} helper={`${stats.due_today ?? 0} کار برای امروز`} trend="+۱۸٪" tone="mint" />
        <MetricCard icon="◒" label="پروژه‌های فعال" value={stats.active_projects ?? '—'} helper="در مسیر رشد" trend="پایدار" tone="peach" />
        <MetricCard icon="✦" label="امتیاز ریتم" value={`${stats.rhythm_score ?? 0}%`} helper={`${stats.events_today ?? 0} رویداد امروز`} trend="عالی" tone="blue" />
      </section>

      <section className="content-grid content-grid--main">
        <div className="panel focus-panel">
          <PanelHeader title="تمرکز امروز" caption={`${tasks.length} کار برای امروز`} action="مشاهده همه" onAction={onOpenTasks} />
          {loading ? <LoadingRows count={3} /> : tasks.length ? (
            <div className="task-list">
              {tasks.slice(0, 4).map((task) => <TaskRow key={task.id} task={task} onStatus={onStatus} onEdit={onEdit} />)}
            </div>
          ) : <EmptyState icon="☀" title="امروز سبک و خلوت است" text="یک کار کوچک به فهرستت اضافه کن تا ریتم روز شکل بگیرد." action="افزودن تسک" onAction={onAddTask} />}
          <button className="dashed-add" onClick={onAddTask}>{icons.plus}<span>افزودن به تمرکز امروز</span></button>
        </div>

        <div className="panel rhythm-panel">
          <PanelHeader title="ریتم هفتگی" caption="دقایق تمرکز عمیق" action="این هفته" />
          <div className="chart-summary"><strong>{stats.focus_hours ?? 0}<small> ساعت</small></strong><span className="trend-pill trend-pill--up">↗ ۱۸٪</span><span>در مقایسه با هفته قبل</span></div>
          <div className="bar-chart">
            {chart.map((height, index) => <div className={`bar-column ${index === chart.length - 1 ? 'bar-column--active' : ''}`} key={index}><div className="bar-track"><div className="bar-value" style={{ height: `${height}%` }}></div></div><span>{stats.weekly?.[index]?.label || ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'][index]}</span></div>)}
          </div>
          <div className="chart-footnote"><span className="legend-dot"></span><span>میانگین روزانه: {Math.round((stats.focus_hours || 0) * 60 / 7)} دقیقه</span><span className="muted">هدف: ۶۰ دقیقه</span></div>
        </div>
      </section>

      <section className="content-grid content-grid--lower">
        <div className="panel projects-panel">
          <PanelHeader title="پروژه‌های در جریان" caption="چیزهایی که در حال ساختنشان هستی" action="همه پروژه‌ها" onAction={onOpenProjects} />
          <div className="project-list">
            {projects.slice(0, 3).map((project) => <ProjectRow key={project.id} project={project} />)}
            {!projects.length ? <EmptyState icon="✧" title="هنوز پروژه‌ای نساخته‌ای" text="یک پروژه به زندگی‌ات اضافه کن و قدم‌هایش را ردیف کن." action="ساخت پروژه" onAction={onOpenProjects} /> : null}
          </div>
        </div>
        <div className="panel activity-panel">
          <PanelHeader title="ردپای اخیر" caption="آخرین تغییرات فضای کاری" action="تاریخچه" />
          <div className="activity-list">
            {activity.slice(0, 4).map((item) => <ActivityRow key={item.id} item={item} />)}
            {!activity.length ? <EmptyState icon="◌" title="هنوز فعالیتی ثبت نشده" text="با اولین تغییر، اینجا زنده می‌شود." /> : null}
          </div>
        </div>
      </section>

      <section className="coach-banner">
        <div className="coach-orbit"><div className="coach-orbit-core">{icons.spark}</div><i></i><i></i><i></i></div>
        <div className="coach-copy"><span className="eyebrow eyebrow--light">پیشنهاد همراه هوشمند</span><h3>برای رسیدن به هدف بزرگت، قدم بعدی چیست؟</h3><p>یک گفت‌وگوی کوتاه شروع کن تا برنامه‌ات را به مسیر قابل‌اجرا تبدیل کنیم.</p></div>
        <button className="ghost-light-button" onClick={onAssistant}>{icons.chat}<span>شروع گفت‌وگو</span>{icons.arrow}</button>
      </section>
    </>
  )
}

function MetricCard({ icon, label, value, helper, trend, tone }) {
  return <div className={`metric-card metric-card--${tone}`}><div className="metric-top"><span className="metric-icon">{icon}</span><span className="trend-pill">{trend || '—'}</span></div><strong>{value}</strong><span>{label}</span><small>{helper}</small></div>
}

function PanelHeader({ title, caption, action, onAction }) {
  return <div className="panel-header"><div><h2>{title}</h2><span>{caption}</span></div><button className="text-button" onClick={onAction}>{action}<span>←</span></button></div>
}

function TaskRow({ task, onStatus, onEdit }) {
  return <div className={`task-row ${task.status === 'done' ? 'task-row--done' : ''}`}><button className={`task-check task-check--${task.status}`} onClick={() => onStatus(task, task.status === 'done' ? 'todo' : 'done')} aria-label="تغییر وضعیت">{task.status === 'done' ? icons.check : null}</button><div className="task-row-main" onClick={() => onEdit(task)}><strong>{task.title}</strong><span>{task.description || 'بدون توضیح'}</span></div><div className="task-row-meta"><span className={`priority-dot priority-dot--${task.priority}`}></span><span>{priorityLabels[task.priority] || task.priority}</span><span className="task-time">{task.estimate_minutes ? `${task.estimate_minutes}د` : '—'}</span><button className="icon-button icon-button--muted" onClick={(event) => { event.stopPropagation(); onEdit(task) }}>{icons.more}</button></div></div>
}

function ProjectRow({ project }) {
  return <div className="project-row"><div className="project-symbol" style={{ '--project-color': project.color || '#6d5dfc' }}>{project.icon || '✦'}</div><div className="project-row-main"><div><strong>{project.name}</strong><span>{project.task_count || 0} تسک · {project.due_date ? `تا ${formatDate(project.due_date)}` : 'بدون ضرب‌العجل'}</span></div><div className="progress-line"><i style={{ width: percent(project.progress) }}></i></div></div><strong className="progress-value">{project.progress || 0}%</strong></div>
}

function ActivityRow({ item }) {
  return <div className="activity-row"><div className={`activity-icon activity-icon--${item.kind || 'default'}`}>{item.kind === 'done' ? icons.check : item.kind === 'project' ? icons.projects : icons.spark}</div><div><strong>{item.text}</strong><span>{item.created_at ? formatDate(item.created_at, { hour: '2-digit', minute: '2-digit' }) : 'اخیراً'}</span></div></div>
}

function LoadingRows({ count }) {
  return <div className="loading-rows">{Array.from({ length: count }).map((_, index) => <div className="skeleton-row" key={index}><i></i><div><b></b><span></span></div></div>)}</div>
}

function EmptyState({ icon, title, text, action, onAction }) {
  return <div className="empty-state"><div className="empty-icon">{icon}</div><strong>{title}</strong><span>{text}</span>{action ? <button className="small-button" onClick={onAction}>{action}</button> : null}</div>
}

function TasksView({ tasks, filter, setFilter, onAdd, onStatus, onEdit, onDelete, onSelect }) {
  const filters = [['all', 'همه'], ['todo', 'در صف'], ['in_progress', 'در حال انجام'], ['done', 'انجام شده']]
  return <><section className="page-heading"><div><span className="eyebrow"><span className="eyebrow-dot"></span>مدیریت اجرا</span><h1>تسک‌ها</h1><p>کارهای روزانه‌ات را سبک، روشن و قابل‌اجرا نگه دار.</p></div><button className="primary-button" onClick={onAdd}>{icons.plus}<span>تسک جدید</span></button></section><div className="toolbar"><div className="filter-tabs">{filters.map(([id, label]) => <button className={filter === id ? 'filter-tab filter-tab--active' : 'filter-tab'} key={id} onClick={() => setFilter(id)}>{label}</button>)}</div><span className="result-count">{tasks.length} تسک</span></div><section className="panel task-table-panel"><div className="task-table-head"><span>عنوان و جزئیات</span><span>اولویت</span><span>زمان</span><span>وضعیت</span><span></span></div>{tasks.length ? tasks.map((task) => <div className="task-table-row" key={task.id}><div className="task-title-cell"><button className={`task-check task-check--${task.status}`} onClick={() => onStatus(task, task.status === 'done' ? 'todo' : 'done')}>{task.status === 'done' ? icons.check : null}</button><button className="plain-link" onClick={() => onSelect(task)}><strong>{task.title}</strong><span>{task.description || 'بدون توضیح'}</span></button></div><span className="priority-cell"><i className={`priority-dot priority-dot--${task.priority}`}></i>{priorityLabels[task.priority]}</span><span>{task.estimate_minutes ? `${task.estimate_minutes} دقیقه` : '—'}</span><span><StatusBadge status={task.status} /></span><div className="row-actions"><button onClick={() => onEdit(task)}>ویرایش</button><button onClick={() => onDelete(task)}>حذف</button></div></div>) : <EmptyState icon="⌁" title="تسکی پیدا نشد" text="فیلتر یا عبارت جست‌وجو را تغییر بده." action="ساخت تسک" onAction={onAdd} />}</section></>
}

function StatusBadge({ status }) { return <span className={`status-badge status-badge--${status}`}>{statusLabels[status] || status}</span> }

function ProjectsView({ projects, onAdd, onEdit, onDelete, onOpenTasks }) {
  return <><section className="page-heading"><div><span className="eyebrow"><span className="eyebrow-dot"></span>تصویر بزرگ‌تر</span><h1>پروژه‌ها</h1><p>هدف‌ها را به مسیرهای کوچک‌تر تقسیم کن و پیشرفت را ببین.</p></div><button className="primary-button" onClick={onAdd}>{icons.plus}<span>پروژه جدید</span></button></section><div className="project-cards-grid">{projects.map((project) => <article className="project-card" key={project.id} onClick={() => onEdit(project)}><div className="project-card-top"><div className="project-symbol" style={{ '--project-color': project.color || '#6d5dfc' }}>{project.icon || '✦'}</div><div className="project-card-actions"><button className="icon-button icon-button--muted" onClick={(event) => { event.stopPropagation(); onEdit(project) }} aria-label="ویرایش">{icons.more}</button><button className="project-delete-button" onClick={(event) => { event.stopPropagation(); onDelete(project) }} aria-label="حذف پروژه">×</button></div></div><h3>{project.name}</h3><p>{project.description || 'یک مسیر تازه برای رشد.'}</p><div className="project-card-meta"><span>{project.task_count || 0} تسک</span><span>{project.due_date ? `تا ${formatDate(project.due_date)}` : 'بدون ضرب‌العجل'}</span></div><div className="progress-line progress-line--large"><i style={{ width: percent(project.progress) }}></i></div><div className="project-progress-footer"><span>پیشرفت</span><strong>{project.progress || 0}%</strong></div></article>)}{!projects.length ? <div className="panel project-empty"><EmptyState icon="✧" title="اولین پروژه‌ات را بساز" text="یک هدف مشخص انتخاب کن و آن را به قدم‌های کوچک تبدیل کن." action="ساخت پروژه" onAction={onAdd} /></div> : null}<button className="insight-card" onClick={onOpenTasks}><span>{icons.spark}</span><div><strong>بین پروژه‌ها گم نشو</strong><p>از نمای تسک‌ها برای دیدن قدم بعدی هر پروژه استفاده کن.</p></div><span className="insight-arrow">←</span></button></div></>
}

function CalendarView({ tasks, events, onStatus, onAddTask, onAddEvent, onEditEvent, onDeleteEvent }) {
  const today = new Date()
  const days = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(today)
    day.setDate(today.getDate() + index)
    return day
  })
  const iso = (date) => date.toISOString().slice(0, 10)
  const formatTime = (value) => value ? new Intl.DateTimeFormat('fa-IR', { hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : ''
  return <><section className="page-heading"><div><span className="eyebrow"><span className="eyebrow-dot"></span>زمان‌بندی نرم</span><h1>تقویم تمرکز</h1><p>هفته را در یک نگاه ببین؛ جای خالی را برای کار عمیق نگه دار.</p></div><div className="heading-actions"><button className="secondary-button" onClick={onAddTask}>{icons.plus}<span>تسک</span></button><button className="primary-button" onClick={onAddEvent}>{icons.plus}<span>رزرو زمان</span></button></div></section><section className="calendar-board">{days.map((day, index) => { const dayTasks = tasks.filter((task) => task.due_date === iso(day)); const dayEvents = events.filter((event) => event.start_at?.slice(0, 10) === iso(day)); return <div className={`calendar-day ${index === 0 ? 'calendar-day--today' : ''}`} key={iso(day)}><div className="calendar-day-head"><span>{new Intl.DateTimeFormat('fa-IR', { weekday: 'short' }).format(day)}</span><strong>{new Intl.DateTimeFormat('fa-IR', { day: 'numeric' }).format(day)}</strong>{index === 0 ? <i>امروز</i> : null}</div><div className="calendar-tasks">{dayEvents.map((event) => <div className="calendar-event" key={event.id} style={{ '--event-color': event.color || '#7165f3' }}><button onClick={() => onEditEvent(event)}><b>{formatTime(event.start_at)}</b><span>{event.title}</span></button><button className="calendar-event-delete" onClick={() => onDeleteEvent(event)} aria-label="حذف رویداد">×</button></div>)}{dayTasks.map((task) => <button className={`calendar-task calendar-task--${task.priority}`} key={task.id} onClick={() => onStatus(task, task.status === 'done' ? 'todo' : 'done')}><span>{task.status === 'done' ? '✓' : '•'}</span>{task.title}</button>)}{!dayTasks.length && !dayEvents.length ? <span className="calendar-empty">فضای آزاد</span> : null}</div></div> })}</section></>
}

function TodayView({ tasks, events, stats, onAddTask, onAddEvent, onStatus, onEdit }) {
  const openTasks = tasks.filter((task) => task.status !== 'done')
  const doneTasks = tasks.filter((task) => task.status === 'done')
  return <><section className="page-heading"><div><span className="eyebrow"><span className="eyebrow-dot"></span>{formatLongDate()}</span><h1>امروز، یک قدم روشن</h1><p>برنامه را سبک نگه دار؛ اول کار مهم را انجام بده، بعد بقیه.</p></div><div className="heading-actions"><button className="secondary-button" onClick={onAddEvent}>{icons.clock}<span>رزرو زمان</span></button><button className="primary-button" onClick={onAddTask}>{icons.plus}<span>تسک جدید</span></button></div></section><section className="today-hero-grid"><div className="panel today-intro"><span className="eyebrow">تمرکز پیشنهادی</span><h2>{openTasks[0]?.title || 'امروز برای یک برد کوچک آماده است'}</h2><p>{openTasks[0]?.description || 'یک کار مشخص انتخاب کن و فقط ۲۵ دقیقه با آن بمان.'}</p><div className="today-progress"><span>پیشرفت امروز</span><strong>{stats.completed_today || 0} از {tasks.length || 0}</strong><div className="progress-line progress-line--large"><i style={{ width: percent(tasks.length ? ((doneTasks.length / tasks.length) * 100) : 0) }}></i></div></div></div><div className="panel today-score"><div className="focus-ring focus-ring--small" style={{ '--progress': `${Math.min(100, (stats.completed_today || 0) * 25 + (openTasks.length ? 15 : 0))}%` }}><div className="focus-ring-content"><strong>{stats.completed_today || 0}</strong><span>کامل‌شده</span></div></div><span>امروز {stats.due_today || 0} کار باز داری</span></div></section><section className="content-grid content-grid--main today-columns"><div className="panel"><PanelHeader title="صف امروز" caption={`${openTasks.length} کار باز`} action="افزودن تسک" onAction={onAddTask} />{openTasks.length ? <div className="task-list">{openTasks.map((task) => <TaskRow key={task.id} task={task} onStatus={onStatus} onEdit={onEdit} />)}</div> : <EmptyState icon="✓" title="صف امروز خالی است" text="این خلوت را جشن بگیر یا یک قدم تازه اضافه کن." action="تسک جدید" onAction={onAddTask} />}</div><div className="panel"><PanelHeader title="رزروهای امروز" caption={`${events.length} بازه زمانی`} action="رزرو زمان" onAction={onAddEvent} />{events.length ? <div className="today-event-list">{events.map((event) => <div className="today-event" key={event.id} style={{ '--event-color': event.color || '#7165f3' }}><span className="today-event-dot"></span><div><strong>{event.title}</strong><span>{new Intl.DateTimeFormat('fa-IR', { hour: '2-digit', minute: '2-digit' }).format(new Date(event.start_at))} · {event.type === 'focus' ? 'تمرکز' : event.type === 'review' ? 'مرور' : event.type === 'health' ? 'سلامت' : 'شخصی'}</span></div></div>)}</div> : <EmptyState icon="◷" title="زمانی رزرو نشده" text="برای کار مهمت یک بازه‌ی محافظت‌شده بساز." action="رزرو زمان" onAction={onAddEvent} />}</div></section></>
}

function AnalyticsView({ stats, tasks, projects }) {
  const weekly = stats.weekly || []
  const categories = stats.categories || []
  const maxPlanned = Math.max(1, ...weekly.map((item) => item.planned || 0))
  return <><section className="page-heading"><div><span className="eyebrow"><span className="eyebrow-dot"></span>تصمیم‌گیری با داده</span><h1>تحلیل عملکرد</h1><p>به‌جای قضاوت خودت، الگوهای واقعی هفته را ببین.</p></div><span className="analytics-date">به‌روزرسانی زنده از فضای کاری</span></section><section className="metrics-grid analytics-metrics"><MetricCard icon="✓" label="نرخ تکمیل" value={`${stats.completion_rate || 0}%`} helper={`${stats.completed_tasks || 0} تسک انجام‌شده`} trend="پایدار" tone="mint" /><MetricCard icon="◎" label="کارهای باز" value={stats.open_tasks || 0} helper={`${stats.due_today || 0} مورد برای امروز`} trend="قابل‌مدیریت" tone="purple" /><MetricCard icon="◷" label="تمرکز برنامه‌ریزی‌شده" value={`${stats.focus_hours || 0}h`} helper="بر اساس برآورد تسک‌ها" trend="+۱۸٪" tone="blue" /><MetricCard icon="◆" label="پروژه‌های فعال" value={stats.active_projects || 0} helper="مسیرهای در حال رشد" trend="زنده" tone="peach" /></section><section className="analytics-grid"><div className="panel analytics-chart-panel"><PanelHeader title="ریتم هفت روز اخیر" caption="تعداد کارهای برنامه‌ریزی‌شده و انجام‌شده" /><div className="analytics-bars">{weekly.map((item) => <div className="analytics-bar-group" key={item.date}><div className="analytics-bars-track"><i className="analytics-bar analytics-bar--planned" style={{ height: `${Math.max(8, (item.planned / maxPlanned) * 100)}%` }}></i><i className="analytics-bar analytics-bar--done" style={{ height: `${Math.max(5, (item.done / maxPlanned) * 100)}%` }}></i></div><span>{item.label}</span><small>{item.done}/{item.planned}</small></div>)}</div><div className="analytics-legend"><span><i className="legend-square legend-square--planned"></i>برنامه‌ریزی‌شده</span><span><i className="legend-square legend-square--done"></i>انجام‌شده</span></div></div><div className="panel"><PanelHeader title="توزیع حوزه‌ها" caption="کجا بیشترین انرژی را گذاشتی؟" /><div className="category-list">{categories.length ? categories.map((item) => <div className="category-item" key={item.category}><div><strong>{item.category}</strong><span>{item.done} از {item.total} انجام شده</span></div><b>{item.total ? Math.round((item.done / item.total) * 100) : 0}%</b><div className="progress-line"><i style={{ width: percent(item.total ? (item.done / item.total) * 100 : 0) }}></i></div></div>) : <EmptyState icon="◌" title="داده کافی نیست" text="با چند تسک جدید، این نمودار شخصی‌تر می‌شود." />}</div></div></section><section className="content-grid content-grid--lower"><div className="panel"><PanelHeader title="اولویت‌های باز" caption="برای سبک‌کردن صف" /><div className="priority-analytics">{(stats.priority_breakdown || []).map((item) => <div className="priority-analytics-row" key={item.priority}><span className={`priority-dot priority-dot--${item.priority}`}></span><strong>{priorityLabels[item.priority]}</strong><b>{item.count}</b><span>تسک</span></div>)}</div></div><div className="panel"><PanelHeader title="پروژه‌ها" caption={`${projects.length} مسیر فعال`} /><div className="mini-project-list">{projects.slice(0, 4).map((project) => <div className="mini-project" key={project.id}><span className="project-symbol" style={{ '--project-color': project.color || '#7165f3' }}>{project.icon || '✦'}</span><div><strong>{project.name}</strong><div className="progress-line"><i style={{ width: percent(project.progress) }}></i></div></div><b>{project.progress || 0}%</b></div>)}</div></div></section></>
}

function SettingsView({ settings, onSave, onReset }) {
  const defaults = { dashboard: 'نمای کلی', today: 'امروز', tasks: 'تسک‌ها', projects: 'پروژه‌ها', calendar: 'تقویم تمرکز', analytics: 'تحلیل عملکرد', settings: 'تنظیمات' }
  const [form, setForm] = useState({
    display_name: settings?.display_name || 'مهسا رضایی',
    workspace_name: settings?.workspace_name || 'NOAVA',
    page_titles: { ...defaults, ...(settings?.page_titles || {}) }
  })
  useEffect(() => {
    setForm({
      display_name: settings?.display_name || 'مهسا رضایی',
      workspace_name: settings?.workspace_name || 'NOAVA',
      page_titles: { ...defaults, ...(settings?.page_titles || {}) }
    })
  }, [settings])
  const updateTitle = (key, value) => setForm((current) => ({ ...current, page_titles: { ...current.page_titles, [key]: value } }))
  return <><section className="page-heading"><div><span className="eyebrow"><span className="eyebrow-dot"></span>فضای قابل‌تنظیم تو</span><h1>تنظیمات</h1><p>نام فضا و عنوان صفحه‌ها را با زبان خودت هماهنگ کن.</p></div><button className="primary-button" onClick={() => onSave(form)}>ذخیره تنظیمات</button></section><section className="settings-grid"><div className="panel settings-card"><PanelHeader title="هویت فضای کاری" caption="اطلاعاتی که در پوسته برنامه می‌بینی" /><div className="form-grid settings-form"><label className="field field--wide"><span>نام نمایشی</span><input value={form.display_name} onChange={(event) => setForm((current) => ({ ...current, display_name: event.target.value }))} /></label><label className="field field--wide"><span>نام فضای کاری</span><input value={form.workspace_name} onChange={(event) => setForm((current) => ({ ...current, workspace_name: event.target.value }))} /></label></div></div><div className="panel settings-card"><PanelHeader title="عنوان صفحات" caption="هر بخش می‌تواند اسم مخصوص خودش را داشته باشد" /><div className="page-title-grid">{Object.entries(form.page_titles).map(([key, value]) => <label className="field" key={key}><span>{key}</span><input value={value} onChange={(event) => updateTitle(key, event.target.value)} /></label>)}</div><div className="settings-actions"><button className="secondary-button" onClick={onReset}>بازنشانی عنوان‌ها</button><button className="primary-button" onClick={() => onSave(form)}>ذخیره تغییرات</button></div></div></section><section className="panel settings-note"><span className="settings-note-icon">{icons.spark}</span><div><strong>اتصال هوشمند امن</strong><p>کلید OpenAI فقط روی سرور خوانده می‌شود و هر زمان حذف شود، دستیار محلی همچنان برای دسته‌بندی و ساخت تسک فعال می‌ماند.</p></div></section></>
}

function SectionHeader({ eyebrow, title, action, onAction }) {
  return <section className="page-heading"><div><span className="eyebrow"><span className="eyebrow-dot"></span>{eyebrow}</span><h1>{title}</h1></div>{action ? <button className="primary-button" onClick={onAction}>{action}</button> : null}</section>
}

function WeeklyPlannerView({ plan = [], events = [], tasks = [], onAddEvent, onAdd, onEdit, onDelete }) {
  const days = ['شنبه','یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه','جمعه']
  return <><SectionHeader eyebrow="ریتم هفتگی" title="برنامه هفتگی" action="آیتم جدید" onAction={onAdd} /><div className="weekly-grid">{days.map((day) => { const items = plan.filter((x) => x.day === day || x.weekday === day); return <div className="weekly-day" key={day}><h3>{day}</h3>{items.length ? items.map((item, i) => <div className="weekly-item" key={item.id || i}><strong>{item.activity || item.title}</strong><span>{item.start_time || item.start || ''} {item.category ? `· ${item.category}` : ''}</span><span className="row-actions"><button onClick={() => onEdit(item)}>ویرایش</button><button onClick={() => onDelete(item)}>حذف</button></span></div>) : <div className="empty-state">زمان آزادی برای تنفس</div>}</div> })}</div><div className="panel"><PanelHeader title="رویدادها و کارهای زمان‌بندی‌شده" caption={`${events.length + tasks.length} مورد`} action="رزرو زمان" onAction={onAddEvent} /><div className="simple-list">{[...events.map((e) => ({ ...e, label: 'رویداد' })), ...tasks.filter((t) => t.due_date).map((t) => ({ ...t, label: 'تسک' }))].slice(0, 10).map((item, i) => <div className="simple-row" key={item.id || i}><span>{item.label}</span><strong>{item.title}</strong><small>{formatDate(item.start_at || item.due_date)}</small></div>)}</div></div></>
}

function GoalsView({ goals = [], onAdd, onEdit, onDelete }) {
  const labels = { active: 'فعال', in_progress: 'در حال انجام', done: 'انجام‌شده', paused: 'متوقف' }
  return <><SectionHeader eyebrow="جهت‌گیری" title="هدف‌های من" action="هدف جدید" onAction={onAdd} /><div className="cards-grid">{goals.map((goal) => <article className="goal-card panel" key={goal.id}><div className="goal-card-top"><span className="goal-area">{goal.area || 'عمومی'}</span><span className={`status-pill status-pill--${goal.status || 'active'}`}>{labels[goal.status] || 'فعال'}</span></div><h3>{goal.title}</h3><div className="goal-progress"><i style={{ width: percent(goal.progress_percent) }}></i></div><div className="goal-meta"><span>{Number(goal.current_value || 0).toLocaleString('fa-IR')} / {Number(goal.target_value || 0).toLocaleString('fa-IR')} {goal.unit || ''}</span><b>{percent(goal.progress_percent)}</b></div><small>اقدام بعدی: {goal.next_action || 'یک قدم کوچک تعریف کن'}</small><div className="row-actions"><button onClick={() => onEdit(goal)}>ویرایش</button><button onClick={() => onDelete(goal)}>حذف</button></div></article>)}</div>{!goals.length ? <div className="empty-state panel">هنوز هدفی ثبت نشده است.<button className="small-button" onClick={onAdd}>ساخت هدف</button></div> : null}</>
}

function HabitsView({ habits = [], today, onToggle, onAdd, onEdit, onDelete }) {
  const dates = Array.from({ length: 7 }, (_, i) => { const d = new Date(today || Date.now()); d.setDate(d.getDate() - (6 - i)); return d.toISOString().slice(0, 10) })
  return <><SectionHeader eyebrow="ثبات روزانه" title="عادت‌ها" action="عادت جدید" onAction={onAdd} /><div className="panel habits-panel"><div className="habit-header"><span>عادت</span>{dates.map((d) => <span key={d}>{new Intl.DateTimeFormat('fa-IR',{weekday:'short'}).format(new Date(`${d}T12:00:00`))}</span>)}<span>پایبندی</span></div>{habits.map((habit) => <div className="habit-row" key={habit.id}><strong title={habit.description || habit.title}>{habit.title}</strong>{dates.map((date) => { const done = Boolean(habit.logs?.[date]); return <button key={date} className={`habit-check ${done ? 'habit-check--done' : ''}`} onClick={() => onToggle(habit, date)} aria-label={`${habit.title} در ${date}`}>{done ? '✓' : ''}</button> })}<b>{percent(habit.adherence_percent)}</b><span className="row-actions"><button onClick={() => onEdit(habit)}>ویرایش</button><button onClick={() => onDelete(habit)}>حذف</button></span></div>)}</div>{!habits.length ? <div className="empty-state panel">هنوز عادتی ثبت نشده است.<button className="small-button" onClick={onAdd}>ساخت عادت</button></div> : null}</>
}

function FinanceView({ finance = {}, stats = {}, onAdd, onEdit, onDelete }) {
  const accounts = finance.accounts || [], transactions = finance.transactions || [], debts = finance.debts || []
  return <><SectionHeader eyebrow="آرامش مالی" title="نمای مالی" action="تراکنش جدید" onAction={() => onAdd('transaction')} /><div className="metric-grid"><MetricCard label="موجودی کل" value={`${(stats.total_balance || 0).toLocaleString('fa-IR')} تومان`} tone="violet" /><MetricCard label="درآمد این ماه" value={`${(stats.month_income || 0).toLocaleString('fa-IR')} تومان`} tone="green" /><MetricCard label="هزینه این ماه" value={`${(stats.month_expense || 0).toLocaleString('fa-IR')} تومان`} tone="orange" /><MetricCard label="بدهی کل" value={`${(stats.total_debt || 0).toLocaleString('fa-IR')} تومان`} tone="red" /></div><div className="content-grid content-grid--lower"><div className="panel"><PanelHeader title="حساب‌ها" caption={`${accounts.length} حساب`} action="حساب جدید" onAction={() => onAdd('account')} />{accounts.map((a) => <div className="simple-row" key={a.id}><strong>{a.name}</strong><b>{Number(a.balance || 0).toLocaleString('fa-IR')} تومان</b><span className="row-actions"><button onClick={() => onEdit('account', a)}>ویرایش</button><button onClick={() => onDelete('accounts', a)}>حذف</button></span></div>)}</div><div className="panel"><PanelHeader title="آخرین تراکنش‌ها" caption={`${transactions.length} تراکنش`} />{transactions.slice(0, 8).map((t) => <div className="simple-row" key={t.id}><span>{t.category || 'عمومی'}</span><strong>{t.description || t.title}</strong><b className={t.type === 'income' ? 'positive' : 'negative'}>{Number(t.amount || 0).toLocaleString('fa-IR')}</b><span className="row-actions"><button onClick={() => onEdit('transaction', t)}>ویرایش</button><button onClick={() => onDelete('transactions', t)}>حذف</button></span></div>)}</div></div><div className="panel"><PanelHeader title="بدهی‌ها" caption={`${debts.length} مورد`} action="بدهی جدید" onAction={() => onAdd('debt')} />{debts.map((d) => <div className="simple-row" key={d.id}><strong>{d.name || d.title}</strong><span>{Number(d.remaining || d.amount || 0).toLocaleString('fa-IR')} تومان</span><span className="row-actions"><button onClick={() => onEdit('debt', d)}>ویرایش</button><button onClick={() => onDelete('debts', d)}>حذف</button></span></div>)}</div></>
}

function IdeasView({ ideas = [], onAdd, onEdit, onDelete }) {
  return <><SectionHeader eyebrow="جرقه‌های ذهنی" title="ایده‌ها" action="ایده جدید" onAction={onAdd} /><div className="cards-grid">{ideas.map((idea) => <article className="panel idea-card" key={idea.id}><span className="idea-tag">{idea.area || 'عمومی'} · {idea.status || 'ایده'}</span><h3>{idea.title}</h3><p>{idea.description || 'برای این ایده هنوز توضیحی ثبت نشده است.'}</p><small>اقدام بعدی: {idea.next_action || 'هنوز مشخص نشده'} · {formatDate(idea.created_at)}</small><div className="row-actions"><button onClick={() => onEdit(idea)}>ویرایش</button><button onClick={() => onDelete(idea)}>حذف</button></div></article>)}</div>{!ideas.length ? <div className="empty-state panel">هنوز ایده‌ای ثبت نشده است.<button className="small-button" onClick={onAdd}>ثبت ایده</button></div> : null}</>
}

function JournalView({ logs = [], onAdd, onEdit, onDelete }) {
  return <><SectionHeader eyebrow="بازتاب روزانه" title="ثبت روزانه" action="ثبت امروز" onAction={onAdd} /><div className="journal-grid">{logs.map((log) => <article className="panel journal-card" key={log.id}><div className="journal-date">{formatDate(log.date || log.created_at, { weekday: 'long', year: 'numeric' })}</div><div className="journal-moods"><span>انرژی {log.energy ?? '—'}</span><span>حال‌وهوا {log.mood || '—'}</span></div><p>{log.note || 'یادداشتی ثبت نشده است.'}</p><small>تمرکز امروز: {log.focus || 'ثبت نشده'}</small><div className="row-actions"><button onClick={() => onEdit(log)}>ویرایش</button><button onClick={() => onDelete(log)}>حذف</button></div></article>)}</div>{!logs.length ? <div className="empty-state panel">امروز را با چند خط کوتاه ثبت کن.<button className="small-button" onClick={onAdd}>ثبت روزانه</button></div> : null}</>
}

function AssistantPanel({ open, messages, input, setInput, busy, onClose, onSend }) {
  if (!open) return null
  const suggestions = ['امروز را برایم اولویت‌بندی کن', 'این ایده را به پروژه تبدیل کن', 'یک برنامه سبک برای فردا بچین']
  return <aside className="assistant-panel"><div className="assistant-header"><div className="assistant-title"><span className="assistant-avatar">{icons.spark}</span><div><strong>همراه NOAVA</strong><span>دستیار برنامه‌ریزی تو</span></div></div><button className="icon-button icon-button--muted" onClick={onClose}>{icons.close}</button></div><div className="assistant-status"><span></span> آماده برای فکر کردن با تو</div><div className="assistant-messages">{messages.map((message, index) => <div className={`message message--${message.role}`} key={`${message.role}-${index}`}><div className="message-bubble">{message.text}</div>{message.actions?.length ? <div className="assistant-actions">{message.actions.map((action, actionIndex) => <span key={actionIndex}>{action}</span>)}</div> : null}</div>)}{busy ? <div className="message message--assistant"><div className="message-bubble typing"><i></i><i></i><i></i></div></div> : null}</div><div className="assistant-suggestions">{suggestions.map((suggestion) => <button key={suggestion} onClick={() => onSend(suggestion)}>{suggestion}</button>)}</div><form className="assistant-input" onSubmit={(event) => { event.preventDefault(); onSend() }}><input value={input} onChange={(event) => setInput(event.target.value)} placeholder="مثلاً: جلسه دندانپزشکی را برای سه‌شنبه..." /><button aria-label="ارسال">{icons.arrow}</button></form><small className="assistant-disclaimer">پیشنهادها توسط هوش مصنوعی تولید می‌شوند؛ قبل از اجرا مرورشان کن.</small></aside>
}

function ModalShell({ title, subtitle, children, onClose }) {
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><div className="modal-card"><div className="modal-header"><div><h2>{title}</h2><span>{subtitle}</span></div><button className="icon-button icon-button--muted" onClick={onClose}>{icons.close}</button></div>{children}</div></div>
}

function GoalModal({ goal, onClose, onSave }) {
  const [form, setForm] = useState({
    title: goal?.title || '', area: goal?.area || 'عمومی',
    current_value: goal?.current_value ?? 0, target_value: goal?.target_value ?? 1,
    unit: goal?.unit || '', status: goal?.status || 'active',
    priority: goal?.priority || 'medium', due_date: goal?.due_date || '',
    next_action: goal?.next_action || '', note: goal?.note || ''
  })
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  return <ModalShell title={goal ? 'ویرایش هدف' : 'هدف جدید'} subtitle="هدف را قابل‌اندازه‌گیری و روشن تعریف کن." onClose={onClose}><form className="form-grid" onSubmit={(event) => { event.preventDefault(); if (!form.title.trim()) return; onSave({ ...form, title: form.title.trim(), current_value: Number(form.current_value) || 0, target_value: Number(form.target_value) || 0 }) }}><label className="field field--wide"><span>عنوان هدف</span><input autoFocus value={form.title} onChange={(event) => update('title', event.target.value)} placeholder="مثلاً: مطالعه ۱۲ فصل کتاب" required /></label><label className="field"><span>حوزه</span><input value={form.area} onChange={(event) => update('area', event.target.value)} /></label><label className="field"><span>واحد</span><input value={form.unit} onChange={(event) => update('unit', event.target.value)} placeholder="فصل، تومان، جلسه..." /></label><label className="field"><span>مقدار فعلی</span><input type="number" min="0" value={form.current_value} onChange={(event) => update('current_value', event.target.value)} /></label><label className="field"><span>مقدار هدف</span><input type="number" min="0" value={form.target_value} onChange={(event) => update('target_value', event.target.value)} /></label><label className="field"><span>وضعیت</span><select value={form.status} onChange={(event) => update('status', event.target.value)}><option value="active">فعال</option><option value="in_progress">در حال انجام</option><option value="paused">متوقف</option><option value="done">انجام‌شده</option></select></label><label className="field"><span>اولویت</span><select value={form.priority} onChange={(event) => update('priority', event.target.value)}><option value="high">بالا</option><option value="medium">متوسط</option><option value="low">کم</option></select></label><label className="field"><span>ضرب‌العجل</span><input type="date" value={form.due_date || ''} onChange={(event) => update('due_date', event.target.value)} /></label><label className="field field--wide"><span>اقدام بعدی</span><input value={form.next_action} onChange={(event) => update('next_action', event.target.value)} placeholder="قدم بعدی کوچک و مشخص..." /></label><label className="field field--wide"><span>یادداشت</span><textarea rows="2" value={form.note} onChange={(event) => update('note', event.target.value)} /></label><div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>انصراف</button><button className="primary-button" type="submit">{goal ? 'ذخیره تغییرات' : 'افزودن هدف'}</button></div></form></ModalShell>
}

function HabitModal({ habit, onClose, onSave }) {
  const [form, setForm] = useState({ title: habit?.title || '', description: habit?.description || '', target_weekly: habit?.target_weekly ?? 5, color: habit?.color || '#7165f3', status: habit?.status || 'active' })
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  return <ModalShell title={habit ? 'ویرایش عادت' : 'عادت جدید'} subtitle="تکرار کوچک، نتیجه بزرگ می‌سازد." onClose={onClose}><form className="form-grid" onSubmit={(event) => { event.preventDefault(); if (!form.title.trim()) return; onSave({ ...form, title: form.title.trim(), target_weekly: Number(form.target_weekly) || 1 }) }}><label className="field field--wide"><span>عنوان عادت</span><input autoFocus value={form.title} onChange={(event) => update('title', event.target.value)} placeholder="مثلاً: ۲۰ دقیقه مطالعه" required /></label><label className="field field--wide"><span>توضیح</span><textarea rows="3" value={form.description} onChange={(event) => update('description', event.target.value)} placeholder="نشانه یا زمان انجام عادت..." /></label><label className="field"><span>هدف هفتگی</span><input type="number" min="1" max="7" value={form.target_weekly} onChange={(event) => update('target_weekly', event.target.value)} /></label><label className="field"><span>رنگ</span><input className="color-input" type="color" value={form.color} onChange={(event) => update('color', event.target.value)} /></label><label className="field"><span>وضعیت</span><select value={form.status} onChange={(event) => update('status', event.target.value)}><option value="active">فعال</option><option value="paused">متوقف</option></select></label><div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>انصراف</button><button className="primary-button" type="submit">{habit ? 'ذخیره تغییرات' : 'افزودن عادت'}</button></div></form></ModalShell>
}

function IdeaModal({ idea, onClose, onSave }) {
  const [form, setForm] = useState({ title: idea?.title || '', area: idea?.area || 'عمومی', description: idea?.description || '', status: idea?.status || 'idea', impact: idea?.impact || 'متوسط', next_action: idea?.next_action || '' })
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  return <ModalShell title={idea ? 'ویرایش ایده' : 'ایده جدید'} subtitle="جرقه را ثبت کن تا بعداً گم نشود." onClose={onClose}><form className="form-grid" onSubmit={(event) => { event.preventDefault(); if (!form.title.trim()) return; onSave({ ...form, title: form.title.trim() }) }}><label className="field field--wide"><span>عنوان ایده</span><input autoFocus value={form.title} onChange={(event) => update('title', event.target.value)} required /></label><label className="field"><span>حوزه</span><input value={form.area} onChange={(event) => update('area', event.target.value)} /></label><label className="field"><span>اثر</span><select value={form.impact} onChange={(event) => update('impact', event.target.value)}><option>بالا</option><option>متوسط</option><option>کم</option></select></label><label className="field"><span>وضعیت</span><select value={form.status} onChange={(event) => update('status', event.target.value)}><option value="idea">ایده</option><option value="reviewing">در حال بررسی</option><option value="planned">برنامه‌ریزی‌شده</option><option value="archived">بایگانی</option></select></label><label className="field field--wide"><span>توضیح</span><textarea rows="3" value={form.description} onChange={(event) => update('description', event.target.value)} /></label><label className="field field--wide"><span>اقدام بعدی</span><input value={form.next_action} onChange={(event) => update('next_action', event.target.value)} /></label><div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>انصراف</button><button className="primary-button" type="submit">{idea ? 'ذخیره تغییرات' : 'ثبت ایده'}</button></div></form></ModalShell>
}

function JournalModal({ log, onClose, onSave }) {
  const [form, setForm] = useState({ date: log?.date || new Date().toISOString().slice(0, 10), energy: log?.energy ?? '', mood: log?.mood || '', focus: log?.focus || '', note: log?.note || '' })
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  return <ModalShell title={log ? 'ویرایش ثبت روزانه' : 'ثبت روزانه'} subtitle="چند خط صادقانه برای خودت بنویس." onClose={onClose}><form className="form-grid" onSubmit={(event) => { event.preventDefault(); onSave({ ...form, energy: form.energy === '' ? null : Number(form.energy), note: form.note.trim() }) }}><label className="field"><span>تاریخ</span><input type="date" value={form.date} onChange={(event) => update('date', event.target.value)} required /></label><label className="field"><span>انرژی (۰ تا ۱۰)</span><input type="number" min="0" max="10" value={form.energy} onChange={(event) => update('energy', event.target.value)} /></label><label className="field"><span>حال‌وهوا</span><input value={form.mood} onChange={(event) => update('mood', event.target.value)} placeholder="خوب، آرام، خسته..." /></label><label className="field"><span>اولویت روز</span><input value={form.focus} onChange={(event) => update('focus', event.target.value)} /></label><label className="field field--wide"><span>یادداشت</span><textarea rows="5" value={form.note} onChange={(event) => update('note', event.target.value)} placeholder="امروز چه چیزی مهم بود؟" /></label><div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>انصراف</button><button className="primary-button" type="submit">ذخیره ثبت روزانه</button></div></form></ModalShell>
}

function FinanceModal({ kind, item, onClose, onSave }) {
  const isAccount = kind === 'accounts', isTransaction = kind === 'transactions'
  const [form, setForm] = useState(isAccount
    ? { name: item?.name || '', balance: item?.balance ?? 0, currency: item?.currency || 'IRR', note: item?.note || '' }
    : isTransaction
      ? { date: item?.date || new Date().toISOString().slice(0, 10), type: item?.type || 'expense', amount: item?.amount ?? '', category: item?.category || 'عمومی', description: item?.description || '', account: item?.account || '', currency: item?.currency || 'IRR' }
      : { title: item?.title || item?.name || '', creditor: item?.creditor || '', amount: item?.amount ?? '', installment: item?.installment ?? '', next_due: item?.next_due || '', status: item?.status || 'active' })
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  const title = isAccount ? 'حساب مالی' : isTransaction ? 'تراکنش مالی' : 'بدهی'
  return <ModalShell title={item ? `ویرایش ${title}` : `${title} جدید`} subtitle="اطلاعات را دقیق و قابل‌پیگیری ثبت کن." onClose={onClose}><form className="form-grid" onSubmit={(event) => { event.preventDefault(); onSave({ ...form, ...(isAccount ? { balance: Number(form.balance) || 0 } : { amount: Number(form.amount) || 0, installment: form.installment === '' ? 0 : Number(form.installment) || 0 }) }) }}>{
    isAccount ? <><label className="field field--wide"><span>نام حساب</span><input autoFocus value={form.name} onChange={(event) => update('name', event.target.value)} required /></label><label className="field"><span>موجودی</span><input type="number" min="0" value={form.balance} onChange={(event) => update('balance', event.target.value)} /></label><label className="field"><span>ارز</span><input value={form.currency} onChange={(event) => update('currency', event.target.value)} /></label><label className="field field--wide"><span>یادداشت</span><textarea rows="2" value={form.note} onChange={(event) => update('note', event.target.value)} /></label></>
    : isTransaction ? <><label className="field"><span>تاریخ</span><input type="date" value={form.date} onChange={(event) => update('date', event.target.value)} required /></label><label className="field"><span>نوع</span><select value={form.type} onChange={(event) => update('type', event.target.value)}><option value="expense">هزینه</option><option value="income">درآمد</option></select></label><label className="field"><span>مبلغ</span><input type="number" min="1" value={form.amount} onChange={(event) => update('amount', event.target.value)} required /></label><label className="field"><span>دسته</span><input value={form.category} onChange={(event) => update('category', event.target.value)} /></label><label className="field"><span>حساب</span><input value={form.account} onChange={(event) => update('account', event.target.value)} /></label><label className="field field--wide"><span>شرح</span><input value={form.description} onChange={(event) => update('description', event.target.value)} /></label></>
    : <><label className="field field--wide"><span>عنوان بدهی</span><input autoFocus value={form.title} onChange={(event) => update('title', event.target.value)} required /></label><label className="field"><span>طلبکار</span><input value={form.creditor} onChange={(event) => update('creditor', event.target.value)} /></label><label className="field"><span>مبلغ</span><input type="number" min="0" value={form.amount} onChange={(event) => update('amount', event.target.value)} /></label><label className="field"><span>قسط</span><input type="number" min="0" value={form.installment} onChange={(event) => update('installment', event.target.value)} /></label><label className="field"><span>سررسید بعدی</span><input type="date" value={form.next_due} onChange={(event) => update('next_due', event.target.value)} /></label></>
  }<div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>انصراف</button><button className="primary-button" type="submit">ذخیره</button></div></form></ModalShell>
}

function WeeklyModal({ item, onClose, onSave }) {
  const [form, setForm] = useState({ day: item?.day || 'شنبه', start: item?.start || '09:00', end: item?.end || '10:00', title: item?.title || '', category: item?.category || 'شخصی', status: item?.status || 'planned', color: item?.color || '#7165f3' })
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  return <ModalShell title={item ? 'ویرایش آیتم برنامه' : 'آیتم جدید برنامه'} subtitle="یک بازه روشن برای ریتم هفتگی بساز." onClose={onClose}><form className="form-grid" onSubmit={(event) => { event.preventDefault(); if (!form.title.trim() || form.end <= form.start) return; onSave({ ...form, title: form.title.trim() }) }}><label className="field field--wide"><span>عنوان</span><input autoFocus value={form.title} onChange={(event) => update('title', event.target.value)} required /></label><label className="field"><span>روز</span><select value={form.day} onChange={(event) => update('day', event.target.value)}>{['شنبه','یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه','جمعه'].map((day) => <option key={day}>{day}</option>)}</select></label><label className="field"><span>شروع</span><input type="time" value={form.start} onChange={(event) => update('start', event.target.value)} /></label><label className="field"><span>پایان</span><input type="time" value={form.end} onChange={(event) => update('end', event.target.value)} /></label><label className="field"><span>دسته</span><input value={form.category} onChange={(event) => update('category', event.target.value)} /></label><div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>انصراف</button><button className="primary-button" type="submit">ذخیره</button></div></form></ModalShell>
}

function TaskModal({ task, projects, onClose, onSave }) {
  const [form, setForm] = useState({ title: task?.title || '', description: task?.description || '', due_date: task?.due_date || new Date().toISOString().slice(0, 10), priority: task?.priority || 'medium', status: task?.status || 'todo', estimate_minutes: task?.estimate_minutes || 30, project_id: task?.project_id || '', category: task?.category || 'شخصی' })
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  return <ModalShell title={task ? 'ویرایش تسک' : 'تسک جدید'} subtitle="کار را واضح و قابل‌اجرا تعریف کن." onClose={onClose}><form className="form-grid" onSubmit={(event) => { event.preventDefault(); if (!form.title.trim()) return; onSave({ ...form, title: form.title.trim(), estimate_minutes: Number(form.estimate_minutes) || 0 }) }}><label className="field field--wide"><span>عنوان تسک</span><input autoFocus value={form.title} onChange={(event) => update('title', event.target.value)} placeholder="مثلاً: آماده‌سازی ارائه محصول" required /></label><label className="field field--wide"><span>توضیح کوتاه</span><textarea rows="3" value={form.description} onChange={(event) => update('description', event.target.value)} placeholder="نتیجه‌ای که می‌خواهی به آن برسی..."></textarea></label><label className="field"><span>اولویت</span><select value={form.priority} onChange={(event) => update('priority', event.target.value)}><option value="high">بالا</option><option value="medium">متوسط</option><option value="low">کم</option></select></label><label className="field"><span>دسته</span><select value={form.category} onChange={(event) => update('category', event.target.value)}><option>کار</option><option>شخصی</option><option>سلامت</option><option>یادگیری</option><option>برنامه‌ریزی</option></select></label><label className="field"><span>وضعیت</span><select value={form.status} onChange={(event) => update('status', event.target.value)}><option value="todo">در صف</option><option value="in_progress">در حال انجام</option><option value="done">انجام شد</option></select></label><label className="field"><span>تاریخ انجام</span><input type="date" value={form.due_date} onChange={(event) => update('due_date', event.target.value)} /></label><label className="field"><span>زمان تخمینی (دقیقه)</span><input type="number" min="0" step="5" value={form.estimate_minutes} onChange={(event) => update('estimate_minutes', event.target.value)} /></label><label className="field field--wide"><span>پروژه مرتبط</span><select value={form.project_id || ''} onChange={(event) => update('project_id', event.target.value)}><option value="">بدون پروژه</option>{projects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}</select></label><div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>انصراف</button><button className="primary-button" type="submit">{task ? 'ذخیره تغییرات' : 'افزودن تسک'}</button></div></form></ModalShell>
}

function ProjectModal({ project, onClose, onSave }) {
  const [form, setForm] = useState({ name: project?.name || '', description: project?.description || '', due_date: project?.due_date || '', color: project?.color || '#6d5dfc', icon: project?.icon || '✦' })
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  return <ModalShell title={project ? 'ویرایش پروژه' : 'پروژه جدید'} subtitle="مسیر را تعریف کن؛ جزئیات را بعداً کامل می‌کنیم." onClose={onClose}><form className="form-grid" onSubmit={(event) => { event.preventDefault(); if (!form.name.trim()) return; onSave({ ...form, name: form.name.trim() }) }}><label className="field field--wide"><span>نام پروژه</span><input autoFocus value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="مثلاً: راه‌اندازی وب‌سایت شخصی" required /></label><label className="field field--wide"><span>تعریف موفقیت</span><textarea rows="3" value={form.description} onChange={(event) => update('description', event.target.value)} placeholder="وقتی پروژه تمام شد، چه چیزی باید وجود داشته باشد؟"></textarea></label><label className="field"><span>نماد</span><input value={form.icon} maxLength="2" onChange={(event) => update('icon', event.target.value)} /></label><label className="field"><span>رنگ پروژه</span><input className="color-input" type="color" value={form.color} onChange={(event) => update('color', event.target.value)} /></label><label className="field field--wide"><span>ضرب‌العجل (اختیاری)</span><input type="date" value={form.due_date || ''} onChange={(event) => update('due_date', event.target.value)} /></label><div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>انصراف</button><button className="primary-button" type="submit">{project ? 'ذخیره تغییرات' : 'ساخت پروژه'}</button></div></form></ModalShell>
}

function EventModal({ event, projects, onClose, onSave }) {
  const toInputDate = (value) => value ? new Date(value).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)
  const toInputTime = (value) => value ? new Date(value).toISOString().slice(11, 16) : '09:00'
  const initialDate = toInputDate(event?.start_at)
  const [form, setForm] = useState({
    title: event?.title || '',
    type: event?.type || 'focus',
    date: initialDate,
    start_time: toInputTime(event?.start_at),
    end_time: toInputTime(event?.end_at),
    color: event?.color || '#7165f3',
    project_id: event?.project_id || '',
    notes: event?.notes || ''
  })
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  const submit = (eventObject) => {
    eventObject.preventDefault()
    if (!form.title.trim()) return
    onSave({
      id: event?.id,
      title: form.title.trim(),
      type: form.type,
      start_at: `${form.date}T${form.start_time}:00`,
      end_at: `${form.date}T${form.end_time}:00`,
      color: form.color,
      project_id: form.project_id || null,
      notes: form.notes.trim()
    })
  }
  return <ModalShell title={event ? 'ویرایش بازه زمانی' : 'رزرو زمان'} subtitle="برای کار مهمت یک بازه‌ی محافظت‌شده بساز." onClose={onClose}><form className="form-grid" onSubmit={submit}><label className="field field--wide"><span>عنوان بازه</span><input autoFocus value={form.title} onChange={(eventObject) => update('title', eventObject.target.value)} placeholder="مثلاً: تمرکز روی گزارش ماهانه" required /></label><label className="field"><span>نوع</span><select value={form.type} onChange={(eventObject) => update('type', eventObject.target.value)}><option value="focus">تمرکز عمیق</option><option value="meeting">جلسه</option><option value="review">مرور</option><option value="health">سلامت</option><option value="personal">شخصی</option></select></label><label className="field"><span>رنگ</span><input className="color-input" type="color" value={form.color} onChange={(eventObject) => update('color', eventObject.target.value)} /></label><label className="field"><span>تاریخ</span><input type="date" value={form.date} onChange={(eventObject) => update('date', eventObject.target.value)} required /></label><label className="field"><span>شروع</span><input type="time" value={form.start_time} onChange={(eventObject) => update('start_time', eventObject.target.value)} required /></label><label className="field"><span>پایان</span><input type="time" value={form.end_time} onChange={(eventObject) => update('end_time', eventObject.target.value)} required /></label><label className="field field--wide"><span>پروژه مرتبط</span><select value={form.project_id || ''} onChange={(eventObject) => update('project_id', eventObject.target.value)}><option value="">بدون پروژه</option>{projects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}</select></label><label className="field field--wide"><span>یادداشت</span><textarea rows="3" value={form.notes} onChange={(eventObject) => update('notes', eventObject.target.value)} placeholder="قانون این بازه یا خروجی مورد انتظار..."></textarea></label><div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>انصراف</button><button className="primary-button" type="submit">{event ? 'ذخیره تغییرات' : 'رزرو زمان'}</button></div></form></ModalShell>
}

function TaskDetail({ task, onClose, onStatus, onEdit }) {
  return <ModalShell title="جزئیات تسک" subtitle="یک نگاه سریع به قدم بعدی." onClose={onClose}><div className="detail-view"><div className="detail-title-row"><span className={`priority-dot priority-dot--${task.priority}`}></span><h3>{task.title}</h3><StatusBadge status={task.status} /></div><p>{task.description || 'برای این تسک هنوز توضیحی نوشته نشده است.'}</p><div className="detail-grid"><div><span>تاریخ انجام</span><strong>{formatDate(task.due_date, { year: 'numeric' })}</strong></div><div><span>زمان تخمینی</span><strong>{task.estimate_minutes ? `${task.estimate_minutes} دقیقه` : 'ثبت نشده'}</strong></div></div><div className="modal-actions"><button className="secondary-button" onClick={() => onStatus(task, task.status === 'done' ? 'todo' : 'done')}>{task.status === 'done' ? 'بازگرداندن به صف' : 'علامت‌گذاری انجام شد'}</button><button className="primary-button" onClick={() => onEdit(task)}>ویرایش تسک</button></div></div></ModalShell>
}

export default App
