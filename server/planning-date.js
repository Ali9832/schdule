export const tehranToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
export function planningDate(value, fallback = tehranToday()) {
  if (value === undefined || value === null || value === '') return fallback
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1900-01-01' || value > '2099-12-31' || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw Object.assign(new Error('تاریخ انتخاب‌شده معتبر نیست.'), { statusCode: 400 })
  return value
}
export function tasksForDay(rows, day, includeUndated = true) {
  return rows.filter(row => String(row.due_date || '').slice(0, 10) === day || (includeUndated && !row.due_date))
}
