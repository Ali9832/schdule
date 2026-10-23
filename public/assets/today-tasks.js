(() => {
  'use strict';
  const pending = new Map();
  const isDone = task => pending.get(task.id)?.done ?? task.status === 'done';
  function button(label, icon, action) {
    const node = document.createElement('button'); node.type = 'button'; node.textContent = icon;
    node.setAttribute('aria-label', label); node.title = label; node.onclick = action; return node;
  }
  async function change(task, done) {
    if (pending.has(task.id)) return;
    pending.set(task.id, { done }); renderTodayBase();
    try {
      // Only this view is optimistic; the shared models change after server confirmation.
      await apiFetch(`/api/tasks/${encodeURIComponent(task.id)}`, { method: 'PATCH', body: JSON.stringify({ status: done ? 'done' : 'todo' }) });
      window.NovaFastUI?.scheduleVisibleRefresh();
    } catch (error) { showToast('ذخیره نشد', error.message || 'تغییر وضعیت انجام نشد. دوباره تلاش کنید.'); }
    finally { pending.delete(task.id); renderTodayBase(); }
  }
  async function remove(task) {
    if (pending.has(task.id) || !window.confirm(`«${task.title}» حذف شود؟ این کار با انجام‌شدن متفاوت است.`)) return;
    pending.set(task.id, { deleting: true }); renderTodayBase();
    try {
      await apiFetch(`/api/tasks/${encodeURIComponent(task.id)}`, { method: 'DELETE' });
      window.NovaFastUI?.scheduleVisibleRefresh();
    } catch (error) { showToast('حذف انجام نشد', error.message || 'دوباره تلاش کنید.'); }
    finally { pending.delete(task.id); renderTodayBase(); }
  }
  function render(list, rows) {
    list.replaceChildren();
    if (!rows.length) { const empty = document.createElement('p'); empty.textContent = 'برای این روز کاری ثبت نشده است.'; list.append(empty); return; }
    for (const task of rows) {
      const done = isDone(task), busy = pending.has(task.id);
      const row = document.createElement('article'); row.className = 'today-task-row' + (done ? ' is-done' : '') + (busy ? ' is-saving' : '');
      row.dataset.taskId = task.id; row.setAttribute('aria-busy', String(busy));
      const checkLabel = document.createElement('label'); checkLabel.className = 'today-task-check';
      const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = done; checkbox.disabled = busy;
      checkbox.setAttribute('aria-label', `انجام‌شده: ${task.title}`); checkbox.onchange = () => change(task, checkbox.checked); checkLabel.append(checkbox);
      const content = document.createElement('div'); content.className = 'today-task-content';
      const title = document.createElement('strong'); title.textContent = task.title;
      const meta = document.createElement('small'); meta.textContent = [task.due_date ? faDateLabel(task.due_date) : 'بدون موعد', task.category].filter(Boolean).join(' • ');
      content.append(title, meta);
      const actions = document.createElement('div'); actions.className = 'today-task-actions';
      const status = document.createElement('span'); status.className = 'badge ' + (done ? 'good' : 'warn'); status.textContent = busy ? 'در حال ذخیره…' : done ? 'انجام‌شده' : 'باز';
      const edit = button(`ویرایش ${task.title}`, '✎', () => baseEditTask(task.id));
      const trash = button(`حذف ${task.title}`, '🗑', () => remove(task)); trash.className = 'today-task-delete';
      edit.disabled = trash.disabled = busy; actions.append(status, edit, trash); row.append(checkLabel, content, actions); list.append(row);
    }
  }
  window.TodayTasks = { render, isDone, change, remove, get pendingCount() { return pending.size; } };
  if (!document.getElementById('today')?.classList.contains('hidden')) renderTodayBase();
})();
