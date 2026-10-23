(() => {
  'use strict';
  const ctx = DateContext, scopedPages = new Set(['today', 'daily', 'workspace', 'finance', 'meetings']);
  const currentPage = () => document.querySelector('.page:not(.hidden)')?.id;
  const label = value => new Intl.DateTimeFormat('fa-IR-u-ca-persian', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(new Date(value + 'T12:00:00Z'));
  let revision = 0, refreshing = Promise.resolve(), financeRequest = 0;
  function bars() {
    document.querySelectorAll('.page').forEach(page => {
      let bar = page.querySelector(':scope > .planning-date-bar');
      if (!bar) {
        bar = document.createElement('section'); bar.className = 'planning-date-bar'; bar.setAttribute('aria-label', 'تاریخ مبنای این صفحه');
        const heading = document.createElement('div'), title = document.createElement('strong'), actual = document.createElement('small');
        title.className = 'planning-date-label'; actual.className = 'planning-real-date'; heading.append(title, actual);
        const controls = document.createElement('div'); controls.className = 'planning-date-controls';
        const button = (text, name, click) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = text; b.setAttribute('aria-label', name); b.onclick = click; controls.append(b); return b; };
        button('→', 'روز قبل', () => ctx.set(ctx.shift(ctx.date, -1)));
        const dateLabel = document.createElement('label'); dateLabel.textContent = 'تاریخ مبنا';
        const input = document.createElement('input'); input.type = 'date'; input.className = 'planning-date-input'; input.setAttribute('aria-label', 'انتخاب تاریخ مبنای صفحه'); input.value = ctx.date;
        input.onchange = () => { if (input.value) ctx.set(input.value); };
        dateLabel.append(input); controls.append(dateLabel);
        button('←', 'روز بعد', () => ctx.set(ctx.shift(ctx.date, 1)));
        button('امروز', 'بازگشت به امروز تهران', () => ctx.set(ctx.today()));
        bar.append(heading, controls);
        if (scopedPages.has(page.id)) {
          const filter = document.createElement('label'); filter.className = 'planning-date-filter';
          const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = ctx.scoped(page.id);
          checkbox.onchange = () => ctx.setScope(page.id, checkbox.checked);
          filter.append(checkbox, document.createTextNode('نمایش فقط موارد این روز')); bar.append(filter);
        }
        const hint = document.createElement('small'); hint.className = 'planning-date-hint'; bar.append(hint); page.prepend(bar);
        PersianUI.scan(bar);
      }
      bar.querySelector('.planning-date-label').textContent = (ctx.date === ctx.today() ? 'امروز، ' : 'روز انتخاب‌شده، ') + label(ctx.date);
      bar.querySelector('.planning-real-date').textContent = ctx.date === ctx.today() ? 'به وقت تهران' : 'امروز: ' + label(ctx.today());
      const input = bar.querySelector('.planning-date-input'); if (document.activeElement !== input) input.value = ctx.date;
      const filter = bar.querySelector('.planning-date-filter input'); if (filter) filter.checked = ctx.scoped(page.id);
      bar.querySelector('.planning-date-hint').textContent = page.id === 'finance'
        ? 'فیلتر روز برای تراکنش‌ها و موعدهاست؛ بودجه مربوط به ماه انتخابی و مانده حساب‌ها، مانده فعلی است. موارد بدون موعد باقی می‌مانند.'
        : ['calendar', 'schedule', 'habits'].includes(page.id) ? 'بازهٔ تقویم / ماه روتین‌ها و تاریخ پیشنهادی ثبت جدید با این روز هماهنگ است.'
        : scopedPages.has(page.id) ? 'موارد بدون موعد هم نمایش داده می‌شوند؛ با برداشتن تیک، فهرست همهٔ روزها را ببینید.'
        : 'تاریخ پیشنهادی ثبت جدید؛ فهرست‌های دائمی این بخش بدون حذف یا مخفی‌سازی باقی می‌مانند.';
    });
  }
  function prepare(page) {
    if (page === 'calendar' && window.UnifiedCalendar) UnifiedCalendar.state.anchor = ctx.date;
    if (page === 'schedule' && typeof V115_ANCHOR !== 'undefined') V115_ANCHOR = new Date(ctx.date + 'T12:00:00');
    if (page === 'habits') {
      const p = PersianUI.localParts(new Date(ctx.date + 'T12:00:00'));
      for (const [id, value] of [['habitMonthSelect', p.month], ['habitYearSelect', p.year]]) {
        const select = document.getElementById(id); if (!select) continue;
        if (![...select.options].some(o => Number(o.value) === value)) select.add(new Option(String(value), String(value)));
        select.value = String(value);
      }
    }
    // Untouched proposals may follow the day; manually changed dates and drafts do not.
    const proposals = { health: ['v119Date', 'v119ApptStart', 'v119ApptEnd'], religious: ['v1111RelDate'], relationships: ['v1110CommitDue'] };
    for (const id of proposals[page] || []) {
      const input = document.getElementById(id); if (!input) continue;
      if (!input.value || input.value === input.dataset.planningProposal) {
        input.value = ctx.date + (id.endsWith('Start') ? 'T09:00' : id.endsWith('End') ? 'T10:00' : '');
        input.dataset.planningProposal = input.value;
      }
    }
  }
  window.renderTodayBase = function () {
    if (!BASE_DATA) return;
    const root = document.getElementById('todayPageBody'); if (!root) return;
    const rows = (BASE_DATA.tasks || []).filter(row => ctx.matches(row.due_date, 'today'));
    const done = rows.filter(row => row.status === 'done').length;
    const habits = BASE_DATA.habits || [], habitDone = habits.filter(row => row.logs?.[ctx.date]).length;
    root.innerHTML = cardsHtml([{ title: 'کارهای این نما', value: toFaNum(rows.length), sub: label(ctx.date) }, { title: 'انجام‌شده', value: toFaNum(done), sub: `${toFaNum(pct(done, rows.length))}٪ از موارد نمایش‌داده‌شده` }, { title: 'روتین‌های روز انتخابی', value: toFaNum(habitDone), sub: `از ${toFaNum(habits.length)} روتین` }]) + `<div class="functional-card" style="grid-column:1/-1"><h3>کارهای روز انتخابی و بدون موعد</h3><div class="data-list">${rows.map(row => `<div class="data-row"><div><b>${escapeHtml(row.title)}</b><small>${row.due_date ? escapeHtml(faDateLabel(row.due_date)) : 'بدون موعد'}</small></div><span class="badge ${row.status === 'done' ? 'good' : 'warn'}">${row.status === 'done' ? 'انجام‌شده' : 'باز'}</span></div>`).join('') || '<p>برای این روز کاری ثبت نشده است.</p>'}</div></div>`;
  };
  const params = window.v111TaskParams;
  window.v111TaskParams = function (cursor) {
    const query = new URLSearchParams(params(cursor));
    if (ctx.scoped('workspace')) query.set('date', ctx.date);
    return query.toString();
  };
  const localTasks = window.v11FilteredTasks;
  window.v11FilteredTasks = () => localTasks().filter(row => ctx.matches(row.due_date, 'workspace'));
  const meetings = window.v116FilteredMeetings;
  window.v116FilteredMeetings = () => meetings().filter(row => ctx.matches(row.start_at, 'meetings'));
  const renderMeetings = window.renderV116;
  window.renderV116 = function () { renderMeetings(); if (V116_DATA) v116SetText('v116KpiToday', (V116_DATA.items || []).filter(row => String(row.start_at).slice(0, 10) === ctx.date).length); };
  const financeRender = window.v1112Render;
  window.v1112Render = function () {
    if (!V1112_DATA) return;
    const original = V1112_DATA;
    if (ctx.scoped('finance')) {
      const f = original.finance;
      V1112_DATA = { ...original, finance: { ...f,
        transactions: (f.transactions || []).filter(row => ctx.matches(row.date, 'finance')),
        commitments: (f.commitments || []).filter(row => ctx.matches(row.due_date, 'finance') || row.paid_date === ctx.date),
        debts: (f.debts || []).filter(row => ctx.matches(row.next_due, 'finance') || row.paid_date === ctx.date)
      } };
    }
    try { financeRender(); } finally { V1112_DATA = original; }
  };
  window.v1112Load = async function () {
    const request = ++financeRequest, date = ctx.date;
    try {
      const data = await apiFetch(ctx.query('/api/v11.12/finance') + (ctx.scoped('finance') ? '' : '&all_dates=1'));
      if (request !== financeRequest || date !== ctx.date) return;
      V1112_DATA = data; v1112Render();
    } catch (error) { if (request === financeRequest) showToast('دریافت مالی انجام نشد', error.message); }
  };
  const openPage = window.handleFunctionalPageOpen;
  window.handleFunctionalPageOpen = async function (page) {
    prepare(page); bars();
    await openPage?.(page);
    if (page === 'today') renderTodayBase();
    if (page === 'workspace') await reloadV111Tasks();
    if (page === 'daily') renderDailyTaskManager();
  };
  async function refresh() {
    const request = ++revision, page = currentPage(); bars(); prepare(page);
    const bar = document.getElementById(page)?.querySelector('.planning-date-bar');
    bar?.setAttribute('aria-busy', 'true');
    try {
      v112Invalidate('dashboard');
      if (page === 'dashboard' || page === 'control-center') await v112RefreshDashboard(true);
      else await handleFunctionalPageOpen(page);
    } catch (error) { if (request === revision) showToast('تغییر تاریخ انجام نشد', error.message); }
    finally { if (request === revision) { bars(); bar?.setAttribute('aria-busy', 'false'); } }
  }
  window.addEventListener('nova:date-changed', event => {
    bars();
    if (event.detail.source === 'calendar' || event.detail.source === 'schedule') return;
    refreshing = refresh();
  });
  window.addEventListener('nova:date-scope', () => { refreshing = refresh(); });
  window.addEventListener('nova:clock-day', bars);
  for (const event of ['click', 'change']) document.addEventListener(event, e => {
    if (e.target.closest('#unifiedCalendar') && window.UnifiedCalendar) ctx.set(UnifiedCalendar.state.anchor, 'calendar');
  });
  const shiftSchedule = window.v115ShiftRange;
  window.v115ShiftRange = function (step) { shiftSchedule(step); ctx.set(v115Iso(V115_ANCHOR), 'schedule'); };
  window.v115JumpToday = function () { V115_ANCHOR = new Date(ctx.today() + 'T12:00:00'); ctx.set(ctx.today(), 'schedule'); loadV115Schedule(true); };
  const clearMeeting = window.clearMeetingForm;
  window.clearMeetingForm = function () { clearMeeting(); document.getElementById('meetingDate').value = ctx.date; };
  // The selected date is a proposal, not a forced value: the user can clear/change it.
  const openGeneric = window.openGenericAdd, saveGeneric = window.saveGenericAdd, editTask = window.baseEditTask, closeGeneric = window.closeGenericAdd;
  window.closeGenericAdd = function () { closeGeneric(); document.getElementById('planningGenericDue')?.closest('label').remove(); };
  window.openGenericAdd = function (type, title) {
    openGeneric(type, title);
    document.getElementById('planningGenericDue')?.closest('label').remove();
    if (!['daily', 'general', 'item', 'project', 'finance'].includes(currentAddType)) return;
    const label = document.createElement('label'); label.className = 'planning-generic-date'; label.textContent = 'تاریخ پیشنهادی / موعد (قابل تغییر)';
    const input = document.createElement('input'); input.type = 'date'; input.id = 'planningGenericDue'; input.value = ctx.date;
    label.append(input); document.getElementById('genericNotes').after(label); PersianUI.scan(label);
  };
  window.baseEditTask = function (id) { document.getElementById('planningGenericDue')?.closest('label').remove(); return editTask(id); };
  let genericSaving = false;
  window.saveGenericAdd = async function () {
    const due = document.getElementById('planningGenericDue');
    if (BASE_EDIT || !due || !['daily', 'general', 'item', 'project', 'finance'].includes(currentAddType)) return saveGeneric();
    if (genericSaving || !due.reportValidity()) return;
    const title = document.getElementById('genericTitleInput').value.trim(); if (!title) return showToast('عنوان لازم است', 'عنوان را وارد کنید.');
    const note = document.getElementById('genericNotes').value.trim(), selectedDate = due.value || null;
    const priority = document.getElementById('genericPriority').value === 'P2' ? 'medium' : 'high';
    let path = '/api/tasks', body = { title, description: note, priority, status: 'todo', due_date: selectedDate, category: 'شخصی' };
    if (currentAddType === 'project') { path = '/api/projects'; body = { name: title, description: note, status: 'in_progress', due_date: selectedDate, color: '#7165f3', icon: '✦' }; }
    if (currentAddType === 'finance') { path = '/api/finance/transactions'; body = { type: 'expense', amount: Number(document.getElementById('genericAmount').value), description: title, date: selectedDate || ctx.date, status: 'confirmed', category: 'عمومی' }; }
    genericSaving = true;
    try { await apiFetch(path, { method: 'POST', body: JSON.stringify(body) }); closeGenericAdd(); showToast('ذخیره شد', title); await refreshAll(); await refresh(); }
    catch (error) { showToast('ذخیره نشد', error.message); }
    finally { genericSaving = false; }
  };
  window.DateContextUI = { refresh, bars, prepare, get refreshing() { return refreshing; } };
  bars(); prepare(currentPage());
})();
