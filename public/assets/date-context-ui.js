(() => {
  'use strict';
  const ctx = DateContext, scopedPages = new Set(['today', 'daily', 'workspace', 'finance', 'meetings']);
  const currentPage = () => document.querySelector('.page:not(.hidden)')?.id;
  const label = value => { const parts=new Intl.DateTimeFormat('fa-IR-u-ca-persian', { weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'UTC' }).formatToParts(new Date(value+'T12:00:00Z'));const get=type=>parts.find(part=>part.type===type)?.value||'';return [get('weekday'),get('day'),get('month'),get('year')].join(' '); };
  const weekLabel = value => { const first=ctx.shift(value,-((new Date(value+'T12:00:00Z').getUTCDay()+1)%7)),last=ctx.shift(first,6);const short=day=>{const parts=new Intl.DateTimeFormat('fa-IR-u-ca-persian',{day:'numeric',month:'long',timeZone:'UTC'}).formatToParts(new Date(day+'T12:00:00Z'));return ['day','month'].map(type=>parts.find(part=>part.type===type)?.value).join(' ');};return short(first)+' تا '+short(last); };
  let revision = 0, refreshing = Promise.resolve(), financeRequest = 0;
  const pageBar = page => document.querySelector(`.planning-date-bar[data-planning-page="${page}"]`);
  const modes = { dashboard: 'day', today: 'day', daily: 'filter', workspace: 'filter', meetings: 'filter', finance: 'filter', academic: 'week' };
  function proposalDate(page=currentPage()) {
    return ['calendar','schedule','academic','dashboard','today','finance'].includes(page) || (scopedPages.has(page) && ctx.scoped(page)) ? ctx.date : ctx.today();
  }
  function mountBar(page,bar) {
    const week=page.id==='academic'&&page.querySelector('.academic-week-panel');
    if(week){if(bar.parentElement!==week)week.querySelector('h2').after(bar);return;}
    if(bar.parentElement===page)return;
    const heading=page.querySelector(':scope > .hero,:scope > .sheet-dashboard-hero,:scope > .v116-hero')||page.firstElementChild;
    if(heading)heading.after(bar);else page.append(bar);
  }
  function bars() {
    document.querySelectorAll('.page').forEach(page => {
      if(!modes[page.id])return;
      let bar=pageBar(page.id);
      if(!bar){
        bar=document.createElement('section');bar.className='planning-date-bar';bar.dataset.planningPage=page.id;bar.setAttribute('aria-label',page.id==='academic'?'انتخاب هفته':'انتخاب روز و فیلتر تاریخ');
        if(modes[page.id]==='filter'){
          const filter=document.createElement('label');filter.className='planning-date-filter';
          const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=ctx.scoped(page.id);checkbox.onchange=()=>ctx.setScope(page.id,checkbox.checked);
          filter.append(checkbox,document.createTextNode('فقط روز انتخابی'));bar.append(filter);
        }
        const controls=document.createElement('div');controls.className='planning-date-controls';
        const button=(text,name,action,className='')=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.className=className;b.title=name;b.setAttribute('aria-label',name);b.onclick=action;controls.append(b);return b;};
        const week=modes[page.id]==='week',step=week?7:1;
        button('→',week?'هفتهٔ قبل':'روز قبل',()=>ctx.set(ctx.shift(ctx.date,-step),week?'academic':''));
        const pick=button('انتخاب تاریخ','انتخاب تاریخ شمسی',()=>bar.querySelector('.persian-calendar-button').click(),'planning-date-label');pick.setAttribute('aria-haspopup','dialog');
        const editor=document.createElement('label');editor.className='planning-date-editor';editor.hidden=true;editor.textContent='انتخاب تاریخ';
        const input=document.createElement('input');input.type='date';input.className='planning-date-input';input.tabIndex=-1;input.value=ctx.date;input.onchange=()=>{if(input.value)ctx.set(input.value,week?'academic':'');};editor.append(input);controls.append(editor);
        button('←',week?'هفتهٔ بعد':'روز بعد',()=>ctx.set(ctx.shift(ctx.date,step),week?'academic':''));
        button('امروز','بازگشت به امروز تهران',()=>ctx.set(ctx.today(),week?'academic':''),'planning-today');
        bar.append(controls);
        const status=document.createElement('small');status.className='planning-date-hint';bar.append(status);
        mountBar(page,bar);PersianUI.scan(bar);
      }
      mountBar(page,bar);bar.hidden=page.id!==currentPage();
      const scoped=ctx.scoped(page.id),filtered=modes[page.id]==='filter';
      bar.classList.toggle('date-filter-off',filtered&&!scoped);
      bar.querySelector('.planning-date-controls').hidden=filtered&&!scoped&&page.id!=='finance';
      const input=bar.querySelector('.planning-date-input');if(document.activeElement!==input)input.value=ctx.date;
      const pick=bar.querySelector('.planning-date-label');pick.textContent=(modes[page.id]==='week'?weekLabel(ctx.date):label(ctx.date))+' ▾';
      const filter=bar.querySelector('.planning-date-filter input');if(filter)filter.checked=scoped;
      bar.querySelector('.planning-date-hint').textContent=page.id==='finance'?'بودجه برای ماه انتخابی است؛ ماندهٔ حساب‌ها مقدار فعلی است.':filtered?(scoped?'موارد بدون موعد هم نمایش داده می‌شوند.':'همهٔ روزها؛ برای محدودکردن فهرست، فیلتر را فعال کن.'):'';
    });
  }
  function prepare(page) {
    if (page === 'calendar' && window.UnifiedCalendar) UnifiedCalendar.state.anchor = ctx.date;
    if (page === 'schedule' && typeof V115_ANCHOR !== 'undefined') V115_ANCHOR = new Date(ctx.date + 'T12:00:00');
    // Untouched proposals may follow the day; manually changed dates and drafts do not.
    const proposals = { habits: ['v119Date'], calendar: ['v119ApptStart', 'v119ApptEnd', 'v1111RelDate'], relationships: ['v1110CommitDue'] };
    for (const id of proposals[page] || []) {
      const input = document.getElementById(id); if (!input) continue;
      if (!input.value || input.value === input.dataset.planningProposal) {
        input.value = proposalDate(page) + (id.endsWith('Start') ? 'T09:00' : id.endsWith('End') ? 'T10:00' : '');
        input.dataset.planningProposal = input.value;
      }
    }
  }
  window.renderTodayBase = function () {
    if (!BASE_DATA) return;
    const root = document.getElementById('todayPageBody'); if (!root) return;
    const isDone = row => window.TodayTasks?.isDone(row) ?? (row.status === 'done');
    const rows = (BASE_DATA.tasks || []).filter(row => ctx.matches(row.due_date, 'today')).slice().sort((a,b)=>Number(isDone(a))-Number(isDone(b)));
    const done = rows.filter(isDone).length;
    const habits = BASE_DATA.habits || [], habitDone = habits.filter(row => row.logs?.[ctx.date]).length;
    root.innerHTML = cardsHtml([{ title: 'کارهای این نما', value: toFaNum(rows.length), sub: label(ctx.date) }, { title: 'انجام‌شده', value: toFaNum(done), sub: `${toFaNum(pct(done, rows.length))}٪ از موارد نمایش‌داده‌شده` }, { title: 'روتین‌های روز انتخابی', value: toFaNum(habitDone), sub: `از ${toFaNum(habits.length)} روتین` }]) + `<div class="functional-card today-task-card" style="grid-column:1/-1"><h3>کارهای روز انتخابی و بدون موعد</h3><p>موارد انجام‌شده در انتهای فهرست می‌مانند؛ برای بازگرداندن، تیک را بردارید.</p><div class="data-list today-task-list"></div></div>`;
    const list=root.querySelector('.today-task-list');
    if(window.TodayTasks)TodayTasks.render(list,rows);
    else list.textContent=rows.length?'در حال آماده‌سازی فهرست…':'برای این روز کاری ثبت نشده است.';
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
  window.renderV116 = function () { renderMeetings(); if (V116_DATA) v116SetText('v116KpiToday', (V116_DATA.items || []).filter(row => String(row.start_at).slice(0, 10) === proposalDate('meetings')).length); };
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
    if (page === 'workspace' && V111_PAGE.criteria !== v111TaskParams('0')) await reloadV111Tasks();
    if (page === 'daily') renderDailyTaskManager();
  };
  async function refresh() {
    const request = ++revision, page = currentPage(); bars(); prepare(page);
    const bar = pageBar(page);
    bar?.setAttribute('aria-busy', 'true');
    try {
      v112Invalidate('dashboard');
      if (page === 'dashboard') await v112RefreshDashboard(true);
      else await handleFunctionalPageOpen(page);
    } catch (error) { if (request === revision) showToast('تغییر تاریخ انجام نشد', error.message); }
    finally { if (request === revision) { bars(); bar?.setAttribute('aria-busy', 'false'); } }
  }
  window.addEventListener('nova:date-changed', event => {
    bars();
    if(!modes[currentPage()] || currentPage() === 'academic')return; // Academic owns its weekly reload.
    if (event.detail.source === 'calendar' || event.detail.source === 'schedule') return;
    refreshing = refresh();
  });
  window.addEventListener('nova:date-scope', () => { refreshing = refresh(); });
  window.addEventListener('nova:clock-day',()=>{bars();if(currentPage()==='spiritual')window.handleFunctionalPageOpen('spiritual');});
  for (const event of ['click', 'change']) document.addEventListener(event, e => {
    if (e.target.closest('#unifiedCalendar') && window.UnifiedCalendar) ctx.set(UnifiedCalendar.state.anchor, 'calendar');
  });
  const shiftSchedule = window.v115ShiftRange;
  window.v115ShiftRange = function (step) { shiftSchedule(step); ctx.set(v115Iso(V115_ANCHOR), 'schedule'); };
  window.v115JumpToday = function () { V115_ANCHOR = new Date(ctx.today() + 'T12:00:00'); ctx.set(ctx.today(), 'schedule'); loadV115Schedule(true); };
  const clearMeeting = window.clearMeetingForm;
  window.clearMeetingForm = function () { clearMeeting(); document.getElementById('meetingDate').value = proposalDate('meetings'); };
  // The selected date is a proposal, not a forced value: the user can clear/change it.
  const openGeneric = window.openGenericAdd, saveGeneric = window.saveGenericAdd, editTask = window.baseEditTask, closeGeneric = window.closeGenericAdd;
  window.closeGenericAdd = function () { closeGeneric(); document.getElementById('planningGenericDue')?.closest('label').remove(); };
  window.openGenericAdd = function (type, title) {
    openGeneric(type, title);
    document.getElementById('planningGenericDue')?.closest('label').remove();
    if (!['daily', 'general', 'item', 'project', 'finance'].includes(currentAddType)) return;
    const label = document.createElement('label'); label.className = 'planning-generic-date'; label.textContent = 'تاریخ پیشنهادی / موعد (قابل تغییر)';
    const input = document.createElement('input'); input.type = 'date'; input.id = 'planningGenericDue'; input.value = proposalDate();
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
    if (currentAddType === 'finance') { path = '/api/finance/transactions'; body = { type: 'expense', amount: NoavaMoney.parse(document.getElementById('genericAmount').value), description: title, date: selectedDate || proposalDate(), status: 'confirmed', category: 'عمومی' }; }
    genericSaving = true;
    const buttons = [...document.querySelectorAll('#genericModalBg .modal-actions button')];
    const submit = buttons[0], originalLabel = submit?.textContent;
    buttons.forEach(button => button.disabled = true); if (submit) submit.textContent = 'در حال ثبت…';
    try { await apiFetch(path, { method: 'POST', body: JSON.stringify(body) }); document.getElementById('genericModalBg')._noavaDraft?.clear(); closeGenericAdd(); showToast('ذخیره شد', title); if(window.NovaFastUI)NovaFastUI.scheduleVisibleRefresh();else await refreshAll(); }
    catch (error) { showToast('ذخیره نشد', error.message); }
    finally { genericSaving = false; buttons.forEach(button => button.disabled = false); if(submit)submit.textContent = originalLabel; }
  };
  window.DateContextUI = { refresh, bars, prepare, pageBar, proposalDate, modes, get refreshing() { return refreshing; } };
  bars(); prepare(currentPage());
})();
