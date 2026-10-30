// Apply confirmed task responses locally. Reconciliation never blocks save feedback.
(() => {
  'use strict';
  const activePage = () => document.querySelector('.page:not(.hidden)')?.id;
  let timer, running, again = false, revision = 0;
  function matchesWorkspace(task) {
    const p = new URLSearchParams(v111TaskParams('0'));
    if (p.get('date') && task.due_date && String(task.due_date).slice(0, 10) !== p.get('date')) return false;
    if (p.get('status') && task.status !== p.get('status')) return false;
    if (p.get('area_id') && task.area_id !== p.get('area_id')) return false;
    if (p.get('context') && task.context !== p.get('context')) return false;
    if (p.get('energy') && task.energy !== p.get('energy')) return false;
    if (p.get('max_minutes') && Number(task.estimate_minutes || 0) > Number(p.get('max_minutes'))) return false;
    const q = p.get('q')?.toLowerCase();
    return !q || `${task.title || ''} ${task.description || ''} ${task.category || ''}`.toLowerCase().includes(q);
  }
  const sortTasks = rows => rows.sort((a, b) => String(a.due_date || '9999').localeCompare(String(b.due_date || '9999')) || ({ urgent: 0, high: 1, medium: 2, low: 3 }[a.priority] ?? 4) - ({ urgent: 0, high: 1, medium: 2, low: 3 }[b.priority] ?? 4) || String(a.title).localeCompare(String(b.title)));
  function applyMutation(path, method, response) {
    const route = String(path).split('?')[0].match(/^\/api\/(?:v11\/)?tasks(?:\/([^/]+))?$/);
    if (!route || !['POST', 'PATCH', 'DELETE', 'PUT'].includes(method)) return false;
    const id = route[1] ? decodeURIComponent(route[1]) : response?.id;
    if (!id || (method !== 'DELETE' && (!response?.id || !response.title))) return false;
    revision++;
    const lists = [...new Set([BASE_DATA?.tasks, V11_DATA?.tasks, BASE_TASKS].filter(Array.isArray))];
    if (lists.includes(V111_PAGE.items)) V111_PAGE.items = [...V111_PAGE.items];
    const old = lists.map(rows => rows.find(row => row.id === id)).find(Boolean) || V111_PAGE.items.find(row => row.id === id);
    const task = method === 'DELETE' ? null : { ...old, ...response };
    for (const rows of lists) {
      const index = rows.findIndex(row => row.id === id);
      if (!task) { if (index >= 0) rows.splice(index, 1); }
      else if (index >= 0) rows[index] = task;
      else rows.unshift(task);
    }
    const index = V111_PAGE.items.findIndex(row => row.id === id), had = index >= 0, visible = task && matchesWorkspace(task);
    if (had) V111_PAGE.items.splice(index, 1);
    if (visible) V111_PAGE.items.push(task);
    V111_PAGE.total = Math.max(0, Number(V111_PAGE.total || 0) + Number(!!visible) - Number(had));
    sortTasks(V111_PAGE.items);
    if (V112_DASH) {
      const day = window.DateContext?.date || todayIso(), beforeToday = old?.due_date === day, afterToday = task?.due_date === day;
      const now = V112_DASH.now ||= {};
      now.today_total = Math.max(0, Number(now.today_total || 0) + Number(afterToday) - Number(beforeToday));
      now.today_done = Math.max(0, Number(now.today_done || 0) + Number(afterToday && task.status === 'done') - Number(beforeToday && old.status === 'done'));
      now.today_open = Math.max(0, Number(now.today_total || 0) - Number(now.today_done || 0));
      now.next_actions = (now.next_actions || []).filter(row => row.id !== id);
      if (task && task.status !== 'done' && (!task.due_date || afterToday)) now.next_actions.unshift(task);
      now.next_actions = now.next_actions.slice(0, 3);
    }
    const page = activePage();
    if (page === 'workspace') renderV111Workspace();
    if (page === 'today') renderTodayBase();
    if (page === 'daily') renderDailyTaskManager();
    if ((page === 'dashboard') && V112_DASH) v112RenderDashboard(V112_DASH);
    return true;
  }
  async function refreshVisible() {
    clearTimeout(timer);
    if (running) { again = true; return running; }
    const page = activePage();
    running = (async () => {
      if (page === 'dashboard') await v112RefreshDashboard(true);
      else if (page === 'workspace') { await reloadV111Tasks(); window.NovaViewSync?.markClean(page); }
      else await window.handleFunctionalPageOpen?.(page);
    })().finally(() => { running = null; if (again) { again = false; scheduleVisibleRefresh(); } });
    return running;
  }
  function scheduleVisibleRefresh() {
    clearTimeout(timer);
    timer = setTimeout(() => refreshVisible().catch(error => {
      console.warn('Saved, but background reconciliation failed:', error);
      showToast('ثبت انجام شد', 'تازه‌سازی فهرست انجام نشد؛ برای تلاش دوباره صفحه را باز کنید.');
    }), 400);
  }
  window.NovaFastUI = { applyMutation, refreshVisible, scheduleVisibleRefresh, matchesWorkspace, get revision() { return revision; } };
})();
