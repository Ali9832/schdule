(() => {
  'use strict';
  const controllers = new Map(), drafts = new Map();
  const node = (tag, text, className) => { const n = document.createElement(tag); if (text != null) n.textContent = text; if (className) n.className = className; return n; };
  const button = (label, action) => { const b = node('button', label); b.type = 'button'; b.onclick = action; return b; };
  const day = () => window.DateContext?.today() || todayIso();
  const field = (form, name, label, type = 'text') => {
    const wrap = node('label', label), input = node(type === 'textarea' ? 'textarea' : 'input');
    if (input.tagName === 'INPUT') input.type = type;
    input.name = name; wrap.append(input); form.append(wrap); return input;
  };
  const stamp = value => new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Tehran' }).format(new Date(value));
  function reportCard(report, edit, showProject = false) {
    const row = node('article', null, 'pw-report-row'); row.dataset.reportId = report.id;
    const heading = node('div', null, 'pw-row-heading');
    heading.append(node('strong', (showProject ? report.project_name + ' — ' : '') + faDateLabel(report.report_date)));
    const editButton = button('✎ ویرایش', () => edit(report)); editButton.setAttribute('aria-label', 'ویرایش گزارش'); heading.append(editButton);
    const text = node('p', report.text, 'pw-report-text');
    row.append(heading, text, node('small', `ثبت: ${stamp(report.created_at)}${report.version > 1 ? ' • ویرایش‌شده' : ''}`));
    return row;
  }
  function mount(body, project) {
    const root = node('div', null, 'project-workspace'); root.dataset.projectId = project.id;
    body.children[0]?.after(root); if (!root.isConnected) body.append(root);
    const current = () => root.isConnected && document.getElementById('v11Inspector').classList.contains('open') && V11_INSPECTOR?.type === 'project' && V11_INSPECTOR.id === project.id && controllers.get(project.id) === controller;
    const base = `/api/projects/${encodeURIComponent(project.id)}`;
    let data = { meetings: [], reports: [] }, editing = null, savingReport = false, savingMeeting = false;
    const meetingBox = node('section', null, 'pw-box'), reportBox = node('section', null, 'pw-box');
    const meetingHeading = node('div', null, 'pw-row-heading'); meetingHeading.append(node('h3', 'جلسات پروژه'));
    const meetingForm = node('form', null, 'record-edit-form pw-meeting-form'); meetingForm.hidden = true;
    meetingHeading.append(button('＋ جلسه', () => { meetingForm.hidden = !meetingForm.hidden; if (!meetingForm.hidden) meetingTitle.focus(); }));
    const meetingTitle = field(meetingForm, 'title', 'عنوان جلسه'); meetingTitle.required = true; meetingTitle.maxLength = 300;
    const meetingDate = field(meetingForm, 'date', 'تاریخ', 'date'); meetingDate.required = true; meetingDate.value = day();
    const meetingTime = field(meetingForm, 'time', 'ساعت شروع', 'time'); meetingTime.required = true; meetingTime.value = '09:00';
    const duration = field(meetingForm, 'duration', 'مدت (دقیقه)', 'number'); duration.value = '45'; duration.min = '5'; duration.max = '1440';
    const statusLabel = node('label', 'وضعیت'), status = node('select'); status.name = 'status'; status.add(new Option('باید برگزار شود', 'scheduled')); status.add(new Option('برگزار شده', 'held')); statusLabel.append(status); meetingForm.append(statusLabel);
    const summary = field(meetingForm, 'summary', 'موضوع / خلاصه جلسه', 'textarea'); summary.maxLength = 2000;
    const meetingError = node('p', '', 'record-edit-error'); meetingError.setAttribute('role', 'alert');
    const meetingSave = node('button', 'ثبت جلسه'); meetingSave.type = 'submit';
    const meetingActions=node('div',null,'pw-form-actions');meetingActions.append(meetingSave,button('لغو',()=>{if(savingMeeting)return;meetingDraft?.clear();meetingForm.hidden=true;meetingTitle.value='';summary.value='';meetingError.textContent='';}));meetingForm.append(meetingError,meetingActions);
    const meetingList = node('div', 'در حال دریافت…', 'pw-meeting-list');
    meetingBox.append(meetingHeading, meetingForm, meetingList);
    reportBox.append(node('h3', 'گزارش و آخرین توضیحات پروژه'));
    const reportForm = node('form', null, 'record-edit-form pw-report-form');
    const reportText = field(reportForm, 'text', 'توضیحات جدید', 'textarea'); reportText.required = true; reportText.maxLength = 8000;
    const reportDate = field(reportForm, 'report_date', 'تاریخ گزارش', 'date'); reportDate.required = true; reportDate.value = day();
    const reportError = node('p', '', 'record-edit-error'); reportError.setAttribute('role', 'alert');
    const actions = node('div', null, 'pw-form-actions'), save = node('button', 'ثبت گزارش'); save.type = 'submit'; save.disabled = true;
    const cancel = button('انصراف از ویرایش', () => {reportDraft?.clear();drafts.delete(draftKey());resetReport();}); cancel.hidden = true; actions.append(save, cancel);
    reportForm.append(reportError, actions); const reportList = node('div', 'در حال دریافت…', 'pw-report-list');
    reportBox.append(reportForm, node('h4', 'گزارش‌های ثبت‌شده (۱۰۰ گزارش اخیر)'), reportList); root.append(meetingBox, reportBox);
    let reportDraft;
    function draftKey() { return `${project.id}:${editing?.id || 'new'}`; }
    function remember() { drafts.set(draftKey(), { text: reportText.value, date: reportDate.value }); }
    reportText.oninput = remember; reportDate.onchange = remember;
    function resetReport() {
      editing = null; const draft = drafts.get(draftKey()); reportText.value = draft?.text || ''; reportDate.value = draft?.date || day();
      save.textContent = 'ثبت گزارش'; cancel.hidden = true; reportError.textContent = '';
      reportDraft=window.NoavaDrafts?.bind(reportForm,'project-report:'+draftKey());
    }
    function editReport(report) {
      if (savingReport || !current()) return;
      remember(); editing = data.reports.find(row => row.id === report.id) || report;
      const draft = drafts.get(draftKey()); reportText.value = draft?.text ?? editing.text; reportDate.value = draft?.date || editing.report_date;
      save.textContent = 'ثبت تغییرات گزارش'; cancel.hidden = false; reportError.textContent = '';
      reportDraft=window.NoavaDrafts?.bind(reportForm,'project-report:'+draftKey());
      reportForm.scrollIntoView({ block: 'nearest' }); reportText.focus();
    }
    function renderReports() {
      reportList.replaceChildren();
      for (const report of data.reports) reportList.append(reportCard(report, editReport));
      if (!data.reports.length) reportList.append(node('p', 'هنوز گزارشی برای این پروژه ثبت نشده است.', 'pw-empty'));
    }
    function renderMeetings() {
      meetingList.replaceChildren();
      for (const [held, heading] of [[false, 'پیش‌رو و نیازمند بررسی'], [true, 'برگزارشده']]) {
        const group = node('div', null, 'pw-meeting-group'); group.append(node('h4', heading));
        const rows = data.meetings.filter(row => (row.status === 'held') === held).sort((a,b)=>held?b.start_at.localeCompare(a.start_at):a.start_at.localeCompare(b.start_at));
        for (const meeting of rows) {
          const row = node('article', null, 'pw-meeting-row'); row.dataset.meetingId = meeting.id;
          row.append(node('strong', meeting.title), node('small', stamp(meeting.start_at)), node('small', meeting.status === 'held' ? 'برگزار شده' : meeting.status === 'past' ? 'موعد گذشته؛ برگزاری تأیید نشده' : 'باید برگزار شود'));
          if (meeting.summary) row.append(node('p', meeting.summary));
          const rowActions = node('div', null, 'pw-form-actions');
          const toggle = button(held ? 'بازگشت به برنامه‌ریزی' : '✓ برگزار شد', async () => {
            toggle.disabled = true;
            try { const next = await apiFetch(`${base}/meetings/${encodeURIComponent(meeting.id)}`, { method: 'PATCH', body: JSON.stringify({ status: held ? 'scheduled' : 'held' }) }); data.meetings = data.meetings.map(row => row.id === next.id ? next : row); if(current())renderMeetings(); }
            catch(error) { if(current())meetingError.textContent = error.message; } finally { toggle.disabled = false; }
          });
          rowActions.append(toggle, button('جزئیات / ویرایش جلسه', async () => { goPage('meetings'); await loadV116(true); v116Edit(meeting.id); }));
          row.append(rowActions); group.append(row);
        }
        if (!rows.length) group.append(node('p', 'موردی ثبت نشده است.', 'pw-empty'));
        meetingList.append(group);
      }
    }
    reportForm.onsubmit = async event => {
      event.preventDefault(); if(savingReport || !reportForm.reportValidity())return;
      savingReport = true; save.disabled = cancel.disabled = reportText.disabled = reportDate.disabled = true; reportError.textContent = '';
      const edited = editing, key = draftKey(), payload = { text: reportText.value, report_date: reportDate.value, ...(edited ? { version: edited.version } : {}) };
      try {
        const report = await apiFetch(`${base}/reports${edited ? '/' + encodeURIComponent(edited.id) : ''}`, { method: edited ? 'PATCH' : 'POST', body: JSON.stringify(payload) });
        data.reports = [report, ...data.reports.filter(row => row.id !== report.id)].sort((a,b)=>b.created_at.localeCompare(a.created_at));
        if(drafts.get(key)?.text===payload.text&&drafts.get(key)?.date===payload.report_date)drafts.delete(key);
        window.NoavaDrafts?.clear('project-report:'+key);
        if(current()){resetReport();renderReports();showToast('گزارش ذخیره شد', edited ? 'تغییرات گزارش ثبت شد.' : project.name);}
      } catch(error){if(current())reportError.textContent=error.message || 'گزارش ذخیره نشد.';}
      finally{savingReport=false;save.disabled=cancel.disabled=reportText.disabled=reportDate.disabled=false;}
    };
    meetingForm.onsubmit = async event => {
      event.preventDefault();if(savingMeeting || !meetingForm.reportValidity())return;
      savingMeeting=true;meetingSave.disabled=true;meetingError.textContent='';
      try {
        const meeting=await apiFetch(`${base}/meetings`,{method:'POST',body:JSON.stringify({title:meetingTitle.value,date:meetingDate.value,time:meetingTime.value,duration:Number(duration.value),status:status.value,summary:summary.value})});
        meetingDraft?.clear();
        data.meetings.push(meeting);if(current()){renderMeetings();meetingForm.hidden=true;meetingTitle.value='';summary.value='';showToast('جلسه ثبت شد','در تقویم و بخش جلسات هم قابل مشاهده است.');}
      }catch(error){if(current())meetingError.textContent=error.message;}finally{savingMeeting=false;meetingSave.disabled=false;}
    };
    async function load() {
      try { const next=await apiFetch(`${base}/workspace`);if(!current())return;data=next;renderMeetings();renderReports();save.disabled=false; }
      catch(error){if(current()){meetingList.replaceChildren(node('p',error.message,'record-edit-error'),button('تلاش دوباره',load));reportList.textContent='دریافت گزارش‌ها انجام نشد.';}}
    }
    const controller={editReport,ready:null};controllers.set(project.id,controller);resetReport();PersianUI.scan(root);const meetingDraft=window.NoavaDrafts?.bind(meetingForm,'project-meeting:'+project.id);controller.ready=load();return controller;
  }
  let reportRequest=0;
  async function loadOverview() {
    const page=document.getElementById('reports');let root=document.getElementById('projectReportsOverview');
    if(!root){root=node('section',null,'pw-box');root.id='projectReportsOverview';page.append(root);}
    const request=++reportRequest;
    try {
      const result=await apiFetch('/api/project-reports');if(request!==reportRequest)return;
      root.replaceChildren(node('h3','گزارش‌های پروژه‌ها (۱۰۰ گزارش اخیر)'));
      for(const report of result.reports)root.append(reportCard(report,async row=>{await openV11Inspector('project',row.project_id);const controller=controllers.get(row.project_id);await controller?.ready;controller?.editReport(row);},true));
      if(!result.reports.length)root.append(node('p','از جزئیات هر پروژه می‌توانید گزارش جدید ثبت کنید.','pw-empty'));
    }catch(error){if(request===reportRequest)root.replaceChildren(node('p',error.message,'record-edit-error'),button('تلاش دوباره',loadOverview));}
  }
  const openPage=window.handleFunctionalPageOpen;
  window.handleFunctionalPageOpen=async function(page){await openPage?.(page);if(page==='reports')await loadOverview();};
  let overviewTimer;window.addEventListener('nova:data-changed',event=>{if(/\/reports(?:\/|$)/.test(event.detail.path)&&!document.getElementById('reports').classList.contains('hidden')){clearTimeout(overviewTimer);overviewTimer=setTimeout(loadOverview,250);}});
  window.ProjectWorkspace={mount,loadOverview};
})();
