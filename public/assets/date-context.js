// Real clock and planning date are deliberately separate (reminders keep the real clock).
(() => {
  const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const valid = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && value >= '1900-01-01' && value <= '2099-12-31' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  const shift = (value, days) => { const d = new Date(value + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };
  let selected = today(), lastToday = selected;
  const scopes = new Map();
  window.DateContext = {
    get date() { return selected; }, today, valid, shift,
    scoped: page => scopes.get(page) !== false,
    matches(value, page, undated = true) { return !this.scoped(page) || (!value ? undated : String(value).slice(0, 10) === selected); },
    setScope(page, enabled) { scopes.set(page, !!enabled); window.dispatchEvent(new CustomEvent('nova:date-scope', { detail: { page } })); },
    set(value, source = '') {
      if (!valid(value)) return false;
      if (selected === value) return true;
      selected = value;
      window.dispatchEvent(new CustomEvent('nova:date-changed', { detail: { date: value, source } }));
      return true;
    },
    checkDay() { const current = today(); if (current !== lastToday) { const follow = selected === lastToday; lastToday = current; if (follow) this.set(current); window.dispatchEvent(new Event('nova:clock-day')); } },
    query(path) { return path + (path.includes('?') ? '&' : '?') + 'date=' + selected; }
  };
  setInterval(() => DateContext.checkDay(), 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) DateContext.checkDay(); });
})();
