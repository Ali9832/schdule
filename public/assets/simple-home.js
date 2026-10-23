function renderSimpleHome(data){
  const set=(id,value)=>{const element=document.getElementById(id);if(element)element.textContent=value};
  set('homeDate',faDateLabel(data.today));
  const actions=(data.now?.next_actions||[]).slice(0,3);
  const list=document.getElementById('homeTaskList');list.replaceChildren();
  for(const task of actions){
    const row=document.createElement('div');row.className='home-task';
    const dot=document.createElement('span');dot.className='home-task-dot';dot.setAttribute('aria-hidden','true');
    const button=document.createElement('button');button.type='button';button.onclick=()=>openV11Inspector('task',task.id);
    const title=document.createElement('strong');title.textContent=task.title;
    const meta=document.createElement('small');meta.textContent=[task.due_date?faDateLabel(task.due_date):'بدون موعد',task.estimate_minutes?`${toFaNum(task.estimate_minutes)} دقیقه`:''].filter(Boolean).join(' · ');
    button.append(title,meta);const arrow=document.createElement('span');arrow.className='home-task-arrow';arrow.textContent='←';arrow.setAttribute('aria-hidden','true');row.append(dot,button,arrow);list.append(row);
  }
  if(!actions.length){const empty=document.createElement('p');empty.className='home-empty';empty.textContent='کاری برای پیشنهاد نداریم. یک کار ثبت کن یا از فهرست کارها انتخاب کن.';list.append(empty)}
  const total=Number(data.now?.today_total||0),done=Number(data.now?.today_done||0);
  set('homeProgressLabel',total?`${toFaNum(done)} از ${toFaNum(total)} کار این روز انجام شده`:'هنوز کاری برای این روز برنامه‌ریزی نشده');
  document.getElementById('homeProgress').value=total?Math.round(done/total*100):0;
  const next=data.meetings?.next,meeting=document.getElementById('homeNextMeeting');meeting.replaceChildren();
  const event=document.createElement('div');event.className='home-event';const title=document.createElement('strong'),time=document.createElement('span');title.textContent=next?.title||'جلسه‌ای پیش رو نیست';time.textContent=next?`${faDateLabel(String(next.start_at).slice(0,10))} · ${String(next.start_at).slice(11,16)}`:'برای برنامه‌ریزی، تقویم را باز کن.';event.append(title,time);meeting.append(event);
  set('homeHabitProgress',`${toFaNum(data.routines?.today_percent||0)}٪`);
  renderCommandOverview(data);
}
function commandButton(title,subtitle,route,icon){
  const button=document.createElement('button');button.type='button';button.onclick=()=>goPage(route);
  const mark=document.createElement('span');mark.className='command-icon';mark.textContent=icon;mark.setAttribute('aria-hidden','true');
  const content=document.createElement('span'),name=document.createElement('strong'),note=document.createElement('small');name.textContent=title;note.textContent=subtitle;content.append(name,note);
  const arrow=document.createElement('span');arrow.className='command-arrow';arrow.textContent='←';arrow.setAttribute('aria-hidden','true');button.append(mark,content,arrow);return button;
}
function renderCommandOverview(d){
  const fa=toFaNum,overview=document.getElementById('homeOverview');overview.replaceChildren();
  for(const [title,value,route,icon] of [['کار باز امروز',d.now?.today_open||0,'today','✓'],['جلسهٔ امروز',d.meetings?.today_count||0,'meetings','▣'],['پروژهٔ فعال',d.summary?.projects_active||0,'projects','◫'],['کار عقب‌افتاده',d.attention?.overdue_count||0,'workspace','◷']])overview.append(commandButton(fa(value),title,route,icon));
  const projects=document.getElementById('homeProjects');projects.replaceChildren();
  for(const p of (d.projects||[]).slice(0,3)){const button=commandButton(p.name,`${fa(p.progress||0)}٪ پیشرفت · ${p.next_action||'قدم بعدی تعیین نشده'}`,'projects','◫');button.onclick=()=>openV11Inspector('project',p.id);projects.append(button)}
  if(!projects.children.length){const empty=document.createElement('p');empty.className='home-empty';empty.textContent='پروژهٔ فعالی ثبت نشده است.';projects.append(empty)}
  const attention=document.getElementById('homeAttention');attention.replaceChildren();
  const notices=[['کار عقب‌افتاده',d.attention?.overdue_count,'workspace'],['مورد در انتظار پاسخ',d.attention?.waiting_count,'waiting'],['پروژه بدون قدم بعدی',d.attention?.projects_without_next_action,'projects'],['پروژهٔ متوقف‌شده',d.attention?.stale_projects,'projects']];
  for(const [label,count,route] of notices)if(count)attention.append(commandButton(`${fa(count)} ${label}`,'برای بررسی باز کن',route,'!'));
  if(!attention.children.length){const empty=document.createElement('p');empty.className='home-empty';empty.textContent='در حال حاضر موردی برای پیگیری گزارش نشده است.';attention.append(empty)}
  const root=document.getElementById('homeSections');root.replaceChildren();
  const area=(name)=>{const a=(d.areas||[]).find(x=>x.name?.includes(name));return a?`${fa(a.tasks_open||0)} کار باز · ${fa(a.projects_active||0)} پروژه`:'مشاهده و مدیریت اطلاعات این بخش'};
  const sections=[
    ['همهٔ کارها',`${fa(d.summary?.tasks_open||0)} کار باز`,'workspace','✓'],
    ['جلسات',`${fa(d.meetings?.week_count||0)} جلسه در این هفته`,'meetings','▣'],
    ['تقویم و برنامه‌ها','رویدادها، موعدها و برنامهٔ روزانه','schedule','◷'],
    ['هدف‌ها','مسیر پیشرفت و نتیجه‌های مورد انتظار','goals','◎'],
    ['روتین‌ها و عادت‌ها',`${fa(d.routines?.active||0)} عادت فعال · ${fa(d.routines?.today_percent||0)}٪ امروز`,'habits','↻'],
    ['مالی',`مانده: ${fa(d.finance?.balance||0)} · مبالغ ثبت‌شده`,'finance','▤'],
    ['سلامت و انرژی',area('سلامت'),'health','♡'],
    ['روابط و افراد',area('روابط'),'relationships','♧'],
    ['دانش و یادگیری',`${fa(d.summary?.resources_backlog||0)} منبع در انتظار بررسی`,'resources','▥'],
    ['حوزه‌های زندگی',`${fa(d.summary?.areas||0)} حوزه`,'areas','◈'],
    ['بانک آیتم‌ها','جستجو، دسته‌بندی و ویرایش آیتم‌ها','items','▦'],
    ['در انتظار و واگذارشده',`${fa(d.summary?.waiting||0)} مورد در انتظار`,'waiting','⌛'],
    ['عادات معنوی',area('معنوی'),'spiritual','✦'],
    ['مناسبات مذهبی','برنامه‌ها و مناسبت‌های پیش رو','religious','◇'],
    ['تمرکز',d.now?.focus_task?.title||'انتخاب یک کار و شروع تمرکز','focus','◉'],
    ['مرور هفتگی','برنامه‌ریزی و جمع‌بندی هفته','weekly','▧'],
    ['گزارش‌ها',`${fa(d.review?.open_tasks||0)} کار باز · مرور عملکرد`,'reports','▥'],
    ['آرشیو','دسترسی به موارد بایگانی‌شده','archive','▱']
  ];
  sections.forEach(([title,note,route,icon],index)=>{const button=commandButton(title,note,route,icon);button.style.setProperty('--section-tint',['#eaf5ef','#edf3fc','#f2edf9','#fff2e8','#faedf1','#edf6f7'][index%6]);root.append(button)});
  const meeting=document.getElementById('homeNextMeeting');meeting.replaceChildren();
  for(const m of (d.meetings?.upcoming||[]).slice(0,3)){const button=commandButton(m.title,`${faDateLabel(String(m.start_at).slice(0,10))} · ${String(m.start_at).slice(11,16)}`,'meetings','◷');button.onclick=()=>openV11Inspector('meeting',m.id);meeting.append(button)}
  if(!meeting.children.length){const empty=document.createElement('p');empty.className='home-empty';empty.textContent='جلسه‌ای پیش رو نیست. برنامه‌های دیگر را در تقویم ببین.';meeting.append(empty)}
}
async function submitHomeTask(event){
  event.preventDefault();const form=event.currentTarget,input=document.getElementById('homeTaskInput'),title=input.value.trim(),button=form.querySelector('button'),status=document.getElementById('homeCaptureStatus');if(!title||button.disabled)return;
  button.disabled=true;status.textContent='در حال ثبت…';
  try{await apiFetch('/api/tasks',{method:'POST',body:JSON.stringify({title,category:'یادداشت‌های ورودی',status:'todo',priority:'medium',due_date:window.DateContext?.date||todayIso()})});form._noavaDraft?.clear();input.value='';status.textContent='کار برای تاریخ انتخاب‌شده ثبت شد.';v112Invalidate('dashboard');if(window.NovaFastUI)NovaFastUI.scheduleVisibleRefresh();else await v112RefreshDashboard(true)}catch(error){status.textContent='ثبت انجام نشد. '+(error.message||'دوباره تلاش کن.')}finally{button.disabled=false;input.focus()}
}
if(typeof V112_DASH!=='undefined'&&V112_DASH)renderSimpleHome(V112_DASH);
