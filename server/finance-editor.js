// User-scoped finance mutations. Settlement records are idempotent and explicit.
export function registerFinanceEditor(app, { life, saveLife, payload, id, today, withUserLock = (user, action) => action() }) {
  const kinds = ['accounts', 'budgets', 'commitments', 'debts', 'transactions']
  const queues = new Map()
  const bad = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode })
  const text = value => String(value ?? '').trim().slice(0, 2000)
  const number = (value, positive = false) => {
    const n = Number(value)
    if (!Number.isFinite(n) || (positive && n <= 0)) throw bad('مبلغ معتبر وارد کنید.')
    return n
  }
  const date = (value, required = false) => {
    if (!value && !required) return null
    const s = text(value)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || !Number.isFinite(Date.parse(s)) || new Date(s).toISOString().slice(0, 10) !== s) throw bad('تاریخ معتبر وارد کنید.')
    return s
  }
  const lock = async (user, action) => {
    const previous = queues.get(user) || Promise.resolve()
    const task = previous.catch(() => {}).then(() => withUserLock(user, action))
    queues.set(user, task)
    try { return await task } finally { if (queues.get(user) === task) queues.delete(user) }
  }
  function balance(f, transaction, sign) {
    if (transaction.status !== 'confirmed') return
    const account = f.accounts.find(a => a.id === transaction.account || a.name === transaction.account)
    if (account) account.balance = number(account.balance || 0) + sign * (transaction.type === 'income' ? 1 : -1) * number(transaction.amount)
  }
  function normalize(kind, body, current, f) {
    const row = { ...current }
    const allowed = {
      accounts: ['name', 'balance', 'note', 'masked', 'status'],
      budgets: ['name', 'category', 'limit_amount', 'period', 'note'],
      commitments: ['title', 'amount', 'direction', 'due_date', 'category', 'account', 'note'],
      debts: ['title', 'creditor', 'amount', 'installment', 'next_due', 'account', 'note'],
      transactions: ['description', 'amount', 'type', 'category', 'account', 'date', 'status']
    }[kind]
    for (const key of allowed) if (Object.hasOwn(body, key)) row[key] = body[key]
    for (const key of allowed.filter(k => !['balance', 'amount', 'limit_amount', 'installment'].includes(k))) if (row[key] != null) row[key] = text(row[key])
    const titleKey = kind === 'accounts' || kind === 'budgets' ? 'name' : kind === 'transactions' ? 'description' : 'title'
    if (!text(row[titleKey])) throw bad('عنوان الزامی است.')
    if (kind === 'accounts') {
      row.balance = number(row.balance ?? 0)
      row.status ||= 'active'
      if (!['active', 'closed'].includes(row.status)) throw bad('وضعیت حساب نامعتبر است.')
      if (f.accounts.some(a => a.id !== current.id && a.name === row.name)) throw bad('نام حساب تکراری است.')
    } else if (kind === 'budgets') {
      row.limit_amount = number(row.limit_amount, true)
      row.period ||= today().slice(0, 7)
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(row.period)) throw bad('ماه بودجه نامعتبر است.')
      row.category ||= row.name
    } else {
      row.amount = number(row.amount, true)
      row.account ||= ''
      if (row.account && !f.accounts.some(a => a.id === row.account || a.name === row.account)) {
        if (row.account !== current.account) throw bad('حساب انتخاب‌شده پیدا نشد.')
      }
      if (kind === 'transactions') {
        row.date = date(row.date || today(), true)
        row.type ||= 'expense'; row.status ||= 'confirmed'
        if (!['income', 'expense'].includes(row.type) || !['confirmed', 'pending', 'cancelled'].includes(row.status)) throw bad('نوع یا وضعیت تراکنش نامعتبر است.')
      } else if (kind === 'commitments') {
        row.direction ||= 'pay'; row.due_date = date(row.due_date)
        if (!['pay', 'receive'].includes(row.direction)) throw bad('جهت تعهد نامعتبر است.')
        row.status ||= 'open'
      } else {
        row.installment = number(row.installment ?? 0)
        if (row.installment < 0) throw bad('مبلغ قسط منفی نیست.')
        row.next_due = date(row.next_due); row.status ||= 'open'
      }
      row.category ||= 'عمومی'
    }
    if (current.paid_at || current.settlement_id) {
      const fixed = kind === 'transactions' ? ['amount', 'account', 'type', 'date', 'status'] : ['amount', 'account', 'direction']
      if (fixed.some(key => row[key] !== current[key])) throw bad('مبلغ و حساب مورد تسویه‌شده قابل تغییر نیست؛ مشخصات و یادداشت قابل ویرایش است.', 409)
    }
    return row
  }
  async function mutate(request, reply, mode) {
    const { kind, id: rowId } = request.params
    if (!kinds.includes(kind)) throw bad('بخش مالی پیدا نشد.', 404)
    return lock(request.user.id, async () => {
      const data = structuredClone(await life(request.user.id)), f = data.finance ||= {}
      for (const key of kinds) if (!Array.isArray(f[key])) f[key] = []
      const index = f[kind].findIndex(row => row.id === rowId)
      if (mode !== 'create' && index < 0) throw bad('آیتم پیدا نشد.', 404)
      const current = mode === 'create' ? { id: id(), created_at: new Date().toISOString() } : f[kind][index]
      const body = request.body || {}
      if (mode === 'settle') {
        if (!['commitments', 'debts', 'transactions'].includes(kind)) throw bad('این بخش پرداخت ندارد.')
        if (body.record_transaction !== undefined && typeof body.record_transaction !== 'boolean') throw bad('گزینه ثبت تراکنش نامعتبر است.')
        if (['done', 'closed'].includes(current.status) || current.paid_at || (kind === 'transactions' && current.status === 'confirmed')) return payload(request.user.id)
        const paidDate = date(body.date || today(), true)
        if (kind === 'transactions') {
          if (current.status === 'cancelled') throw bad('تراکنش لغوشده قابل پرداخت نیست.')
          current.status = 'confirmed'; current.date = paidDate; current.paid_at = new Date().toISOString(); balance(f, current, 1)
        } else {
          if (body.record_transaction !== false) {
            const tx = normalize('transactions', { description: current.title, amount: current.amount, account: body.account ?? current.account ?? '', type: current.direction === 'receive' ? 'income' : 'expense', date: paidDate, status: 'confirmed', category: current.category || 'عمومی' }, { id: id() }, f)
            tx.settlement_id = current.id; tx.settlement_kind = kind
            current.settlement_id = tx.id; current.account = tx.account
            f.transactions.push(tx); balance(f, tx, 1)
          }
          current.status = 'done'; current.paid_at = new Date().toISOString(); current.paid_date = paidDate
        }
        current.updated_at = new Date().toISOString()
      } else {
        const row = normalize(kind, body, current, f)
        row.updated_at = new Date().toISOString()
        if (kind === 'transactions') { if (mode !== 'create') balance(f, current, -1); balance(f, row, 1) }
        if (kind === 'accounts' && mode !== 'create' && row.name !== current.name) {
          for (const key of ['transactions', 'commitments', 'debts']) for (const item of f[key]) if (item.account === current.name) item.account = row.id
        }
        if (mode === 'create') f[kind].push(row); else f[kind][index] = row
      }
      await saveLife(request.user.id, data)
      if (mode === 'create') reply.code(201)
      return payload(request.user.id)
    })
  }
  app.post('/api/finance-editor/:kind', (request, reply) => mutate(request, reply, 'create'))
  app.patch('/api/finance-editor/:kind/:id', (request, reply) => mutate(request, reply, 'edit'))
  app.post('/api/finance-editor/:kind/:id/settle', (request, reply) => mutate(request, reply, 'settle'))
}
