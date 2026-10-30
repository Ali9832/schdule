(() => {
  'use strict';
  const root = document.getElementById('readingBody');
  let data = null, loading = null, dialog = null, stale = true, revision = 0;
  const seen = new Set();
  const node = (tag, text, cls) => { const n = document.createElement(tag); if (text != null) n.textContent = text; if (cls) n.className = cls; return n; };
  const num = value => Number(value || 0).toLocaleString('fa-IR');
  const minutes = seconds => `${num(Math.floor(seconds / 60))} دقیقه${seconds % 60 ? ` و ${num(seconds % 60)} ثانیه` : ''}`;
  const active = () => !document.getElementById('reading').classList.contains('hidden');
  function button(text, action) {
    const b = node('button', text); b.type = 'button';
    b.onclick = async () => { b.disabled = true; try { await action(); } catch (error) { showToast('انجام نشد', error.message); } finally { b.disabled = false; } };
    return b;
  }
  async function load() {
    if (loading) return loading;
    const generation = revision;
    loading = (async () => {
      try { const result = await apiFetch('/api/reading'); if (generation !== revision) return; data = result; stale = false; if (active()) render(); await remind(); }
      catch (error) { if (generation !== revision) return; stale = true; if (active()) root.replaceChildren(node('p','دریافت اطلاعات کتاب‌خوانی انجام نشد: '+error.message,'reading-error'),button('تلاش دوباره',load)); }
      finally { loading = null; }
    })(); return loading;
  }
  async function mutate(path, body, method = 'POST') {
    revision++;
    data = await apiFetch('/api/reading' + path, { method, body: JSON.stringify(body) }); stale = false;
    document.getElementById('readingReminderToast')?.remove();
    if (active()) render();
  }
  function closeDialog() { if (dialog) { dialog.close(); dialog.remove(); dialog = null; } }
  function formDialog(title, build, save) {
    closeDialog(); dialog = node('dialog',null,'reading-dialog'); const current = dialog;
    const form = node('form'), error = node('p',null,'reading-error'); error.setAttribute('role','alert');
    form.append(node('h2',title)); const values = build(form); const actions = node('div',null,'reading-actions');
    const submit = node('button','ذخیره'); submit.type = 'submit'; actions.append(submit,button('انصراف',closeDialog)); form.append(error,actions);
    form.onsubmit = async event => { event.preventDefault(); if (submit.disabled) return; submit.disabled = true; error.textContent = '';
      try { await save(values); if (dialog === current) closeDialog(); } catch (e) { error.textContent = e.message; } finally { submit.disabled = false; }
    };
    current.addEventListener('close',()=>{ if (dialog === current) dialog = null; current.remove(); });
    current.append(form); document.body.append(current); current.showModal();
  }
  function field(form, name, label, type, value) {
    const wrap = node('label',label), input = node('input'); input.name = name; input.type = type; input.value = value ?? ''; wrap.append(input); form.append(wrap); return input;
  }
  function bookForm(book = {}) {
    formDialog(book.id ? 'ویرایش کتاب' : 'افزودن کتاب', form => {
      const title = field(form,'title','نام کتاب','text',book.title); title.required = true; title.maxLength = 300;
      const author = field(form,'author','نویسنده','text',book.author); author.maxLength = 300;
      const label = node('label','وضعیت'), status = node('select'); status.name = 'status';
      for (const [value,text] of [['reading','در حال خواندن'],['planned','برای بعد'],['finished','تمام‌شده']]) { const o = node('option',text); o.value = value; status.append(o); }
      status.value = book.status || 'reading'; label.append(status); form.append(label);
      const goal = field(form,'daily_minutes','هدف مطالعهٔ روزانه (دقیقه)','number',book.daily_minutes || 20); goal.min = 1; goal.max = 1440; goal.step = 1; goal.required = true;
      const total=field(form,'total_pages','تعداد صفحه‌های کتاب (اختیاری)','number',book.total_pages||'');total.min=1;total.max=100000;total.step=1;
      const current=field(form,'current_page','آخرین صفحهٔ خوانده‌شده','number',book.current_page||0);current.min=0;current.max=100000;current.step=1;current.required=true;
      const enabled = field(form,'reminder_enabled','یادآوری روزانه برای این کتاب','checkbox',''); enabled.checked = !!book.reminder_enabled;
      const time = field(form,'reminder_time','ساعت یادآوری به وقت تهران','time',book.reminder_time || '20:00'); time.required = true;
      form.append(node('p','یادآوری برای کتاب‌های در حال خواندن، تا رسیدن به هدف روزانه ارسال می‌شود. سایت باید در مرورگر باز باشد.','reading-hint'));
      return {title,author,status,goal,enabled,time,total,current};
    }, async v => {
      if(v.enabled.checked&&'Notification' in window&&Notification.permission==='default'){try{await Notification.requestPermission();}catch{}}
      await mutate(book.id ? '/books/'+encodeURIComponent(book.id) : '/books', {title:v.title.value,author:v.author.value,status:v.status.value,daily_minutes:Number(v.goal.value),total_pages:v.total.value===''?null:Number(v.total.value),current_page:Number(v.current.value),reminder_enabled:v.enabled.checked,reminder_time:v.time.value},book.id?'PATCH':'POST');
    });
  }
  const clock=value=>new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Tehran',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(value));
  function sessionForm(book, running=null) {
    const requestId = running?.id||crypto.randomUUID();
    formDialog('ثبت مطالعهٔ «'+book.title+'»', form => {
      form.append(node('p',`آخرین صفحهٔ ثبت‌شده: ${num(book.current_page)}${book.total_pages?' از '+num(book.total_pages):''} · صفحات ثبت‌شده در جلسه‌ها: ${num(book.total_pages_read)} · مجموع زمان: ${minutes(book.total_seconds||0)}`,'reading-summary'));
      const date = field(form,'date','روز مطالعه','date',DateContext.today()); date.required = true; date.max = DateContext.today();
      const pages=node('div',null,'reading-page-fields');form.append(pages);
      const startPage=field(pages,'start_page','از صفحه','number',Math.min(book.total_pages||100000,(book.current_page||0)+1));startPage.min=1;startPage.max=book.total_pages||100000;startPage.step=1;
      const endPage=field(pages,'end_page','تا صفحه (اختیاری)','number','');endPage.min=1;endPage.max=book.total_pages||100000;endPage.step=1;
      const pageCount=node('p','با واردکردن صفحهٔ پایان، تعداد صفحات این جلسه هم ثبت می‌شود.','reading-hint');form.append(pageCount);
      const countPages=()=>{pageCount.textContent=endPage.value&&Number(endPage.value)>=Number(startPage.value)?`این جلسه: ${num(Number(endPage.value)-Number(startPage.value)+1)} صفحه`:'اگر صفحهٔ پایان خالی باشد، فقط زمان ثبت می‌شود.';};startPage.oninput=endPage.oninput=countPages;
      const label=node('label','روش ثبت زمان'),mode=node('select');mode.name='time_mode';for(const [value,text]of [['duration','مدت زمان مطالعه'],['range','از ساعت تا ساعت']]){const option=node('option',text);option.value=value;mode.append(option);}label.append(mode);form.append(label);
      const duration = field(form,'minutes','مدت مطالعه (دقیقه)','number',running?Math.max(1,Math.ceil((Date.now()-Date.parse(running.started_at))/60000)):''); duration.min = 1; duration.max = 1440; duration.step = 1; duration.required = true;
      const range=node('div',null,'reading-session-range');form.append(range);
      const from=field(range,'start_time','از ساعت','time',clock(running?.started_at||Date.now()-20*60000)),to=field(range,'end_time','تا ساعت','time',clock(Date.now()));
      const next=field(range,'end_next_day','پایان در روز بعد است','checkbox','');
      const sync=()=>{const ranged=mode.value==='range';range.hidden=!ranged;duration.closest('label').hidden=ranged;duration.disabled=ranged;duration.required=!ranged;from.required=to.required=ranged;from.disabled=to.disabled=!ranged;};mode.onchange=sync;sync();
      const note = field(form,'note','یادداشت مطالعه (اختیاری)','text',''); note.maxLength = 2000;
      return {date,duration,note,startPage,endPage,mode,from,to,next};
    },v => mutate('/books/'+encodeURIComponent(book.id)+'/sessions',{date:v.date.value,...(v.mode.value==='range'?{start_time:v.from.value,end_time:v.to.value,end_next_day:v.next.checked}:{minutes:Number(v.duration.value)}),...(v.endPage.value!==''?{start_page:Number(v.startPage.value),end_page:Number(v.endPage.value)}:{}),note:v.note.value,request_id:requestId,...(running?{timer_id:running.id}:{})}));
  }
  async function openBookSession(bookId){
    await load();if(stale){showToast('فرم مطالعه باز نشد','اطلاعات کتاب دریافت نشد؛ دوباره تلاش کن.');return;}
    const book=data?.books.find(book=>book.id===bookId);
    if(!book){showToast('کتاب پیدا نشد','از فهرست کتاب‌ها انتخاب کن.');return;}
    document.getElementById('readingReminderToast')?.remove();
    sessionForm(book,data.timer?.book_id===book.id?data.timer:null);
  }
  async function permission() {
    if (!('Notification' in window)) { showToast('اعلان مرورگر پشتیبانی نمی‌شود','یادآوری داخل سایت نمایش داده می‌شود.'); return; }
    const result = await Notification.requestPermission();
    showToast(result === 'granted' ? 'اعلان مرورگر فعال شد' : 'اعلان مرورگر مجاز نیست',result === 'granted' ? 'برای دریافت یادآوری سایت را باز نگه دار.' : 'مجوز اعلان را در تنظیمات مرورگر فعال کن؛ یادآوری داخل سایت باقی است.');
  }
  function render() {
    if (!data) return;
    const heading = node('div',null,'reading-heading'); heading.append(node('h1','کتاب‌خوانی'),button('＋ افزودن کتاب',()=>bookForm()),button('فعال‌کردن اعلان مرورگر',permission));
    const summary = node('p',`مطالعهٔ امروز: ${minutes(data.summary.today_seconds)} · کل مطالعهٔ ثبت‌شده: ${minutes(data.summary.total_seconds)}`,'reading-summary');
    root.replaceChildren(heading,summary,node('p','زمان ثبت‌شده در حسابت ذخیره می‌شود. ساعت یادآوری به وقت تهران است؛ اعلان ویندوز به اجازهٔ اعلان مرورگر و بازبودن سایت نیاز دارد.','reading-hint'));
    if (data.timer) {
      const bar = node('section',null,'reading-timer'); bar.setAttribute('aria-label','زمان‌سنج مطالعه');
      bar.append(node('strong','در حال مطالعه: '+(data.books.find(b=>b.id===data.timer.book_id)?.title || 'کتاب')),node('output','','reading-elapsed'),button('توقف و ثبت زمان',()=>sessionForm(data.books.find(b=>b.id===data.timer.book_id),data.timer)),button('کنارگذاشتن این زمان',async()=>{if(window.confirm('زمان این جلسه کنار گذاشته شود؟'))await mutate('/timer/stop',{timer_id:data.timer.id,discard:true});}));
      root.append(bar);
    }
    const grid = node('div',null,'reading-grid'); root.append(grid);
    if (!data.books.length) grid.append(node('p','هنوز کتابی اضافه نکرده‌ای. اولین کتابت را اضافه کن.'));
    for (const book of data.books) {
      const card = node('article',null,'reading-book'); card.append(node('h2',book.title),node('p',book.author || 'نویسنده ثبت نشده'),node('small',({reading:'در حال خواندن',planned:'برای بعد',finished:'تمام‌شده'})[book.status]));
      card.append(node('p',`امروز: ${minutes(book.today_seconds)} از هدف ${num(book.daily_minutes)} دقیقه`),node('p',`کل مطالعه: ${minutes(book.total_seconds)}`));
      card.append(node('p',`آخرین صفحه: ${num(book.current_page)}${book.total_pages?' از '+num(book.total_pages):''} · صفحات ثبت‌شده در جلسه‌ها: ${num(book.total_pages_read)}`));
      const progress = node('progress'); progress.max = book.daily_minutes * 60; progress.value = book.today_seconds; progress.setAttribute('aria-label','پیشرفت هدف روزانه'); card.append(progress);
      card.append(node('p',book.reminder_enabled ? `یادآوری ${num(book.reminder_time.split(':')[0])}:${book.reminder_time.split(':')[1].replace(/\d/g,d=>'۰۱۲۳۴۵۶۷۸۹'[d])} به وقت تهران${book.status!=='reading'?' · با شروع خواندن فعال می‌شود':''}` : 'یادآوری خاموش','reading-hint'));
      const actions = node('div',null,'reading-actions');
      if (book.status === 'reading') { const start = button('شروع زمان‌سنج',()=>mutate('/books/'+book.id+'/start',{})); start.disabled = !!data.timer; actions.append(start); }
      actions.append(button('ثبت دستی زمان',()=>sessionForm(book,data.timer?.book_id===book.id?data.timer:null)),button('ویرایش / یادآور',()=>bookForm(book))); card.append(actions);
      const groups=new Map();for(const session of (data.sessions||[]).filter(s=>s.book_id===book.id)){const key=session.group_id||session.id,row=groups.get(key);if(!row)groups.set(key,{...session});else{row.seconds+=session.seconds;if(session.started_at&&session.started_at<row.started_at){row.started_at=session.started_at;row.date=session.date;}if(session.ended_at&&session.ended_at>row.ended_at)row.ended_at=session.ended_at;if(session.pages_read)Object.assign(row,{pages_read:session.pages_read,start_page:session.start_page,end_page:session.end_page});}}
      const history = node('details'), rows = [...groups.values()]; history.append(node('summary',`تاریخچهٔ مطالعه (${num(rows.length)})`));
      for (const row of rows.slice(0,30)) history.append(node('p',`${faDateLabel(row.date)} · ${minutes(row.seconds)}${row.started_at?' · '+clock(row.started_at)+' تا '+clock(row.ended_at):''}${row.pages_read?' · صفحات '+num(row.start_page)+' تا '+num(row.end_page)+' ('+num(row.pages_read)+' صفحه)':''}${row.note?' · '+row.note:''}`));
      if (!rows.length) history.append(node('p','جلسه‌ای ثبت نشده است.')); if(rows.length>30)history.append(node('small','۳۰ جلسهٔ اخیر نمایش داده می‌شود؛ مجموع شامل تمام جلسه‌هاست.'));
      card.append(history); grid.append(card);
    }
    tick();
  }
  function tick() {
    const target = root.querySelector('.reading-elapsed'); if (!target || !data?.timer) return;
    const seconds = Math.max(0,Math.floor((Date.now()-Date.parse(data.timer.started_at))/1000)); target.textContent = minutes(seconds);
  }
  async function remind(current=data) {
    if (!current) return;
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).map(p=>[p.type,p.value]));
    const day = `${parts.year}-${parts.month}-${parts.day}`, now = `${parts.hour}:${parts.minute}`;
    if (current.today !== day) { stale = true; return; }
    for (const book of current.books) {
      if (!book.reminder_enabled || book.status!=='reading' || book.today_seconds>=book.daily_minutes*60 || now<book.reminder_time || current.timer?.book_id===book.id) continue;
      const key = `noava.reading.reminder:${book.id}:${day}`;
      const deliver = async () => {
        try { if (localStorage.getItem(key)) return; } catch {}
        if (seen.has(key)) return;
        const body = `«${book.title.slice(0,80)}» · آخرین صفحه: ${num(book.current_page)}${book.total_pages?' از '+num(book.total_pages):''} · ثبت‌شده: ${num(book.total_pages_read)} صفحه · هدف امروز ${num(book.daily_minutes)} دقیقه. برای ثبت مطالعه کلیک کن.`;
        document.getElementById('readingReminderToast')?.remove();const toast=node('aside',null,'reading-reminder-toast');toast.id='readingReminderToast';toast.setAttribute('role','status');toast.append(node('strong','وقت کتاب‌خوانی است'),node('p',body),button('ثبت مطالعهٔ همین کتاب',()=>{toast.remove();return openBookSession(book.id);}),button('بستن',()=>toast.remove()));document.body.append(toast);
        if ('Notification' in window && Notification.permission==='granted') {
          try {
            const registration = await navigator.serviceWorker?.getRegistration();
            if (registration) await registration.showNotification('وقت کتاب‌خوانی است',{body,tag:key,data:{reading:true,book_id:book.id},actions:[{action:'log-reading',title:'ثبت مطالعه'}]});
            else { const notification = new Notification('وقت کتاب‌خوانی است',{body,tag:key}); notification.onclick = ()=>{window.focus();notification.close();openBookSession(book.id);}; }
          } catch (error) { console.warn('Reading notification:',error.message); }
        }
        seen.add(key); try { localStorage.setItem(key,'1'); } catch {}
      };
      if (navigator.locks) await navigator.locks.request(key,deliver); else await deliver();
    }
  }
  const open = window.handleFunctionalPageOpen;
  window.handleFunctionalPageOpen = async function(page) { await open?.(page); if(page==='reading'){root.textContent='در حال دریافت کتاب‌ها…';await load();} };
  window.addEventListener('nova:page-open',closeDialog);
  let reminderLoading=false;
  async function poll(){
    if(active())return load();
    if(reminderLoading)return;reminderLoading=true;
    try{await remind(await apiFetch('/api/reading/reminders'));}catch(error){console.warn('Reading reminders:',error.message);}finally{reminderLoading=false;}
  }
  window.addEventListener('focus',poll);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)poll();});
  navigator.serviceWorker?.addEventListener('message',event=>{if(event.data?.reading){if(event.data.book_id)openBookSession(event.data.book_id);else goPage('reading');}});
  setInterval(()=>{if(active())tick();},1000); setInterval(poll,60000);
  setTimeout(poll,1500);
  const params=new URLSearchParams(location.search);if(params.has('reading')){goPage('reading');if(params.get('book'))openBookSession(params.get('book'));}
})();
