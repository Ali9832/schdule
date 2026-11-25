(() => {
  'use strict';
  function mountRoutineView(pageId,categoryFilter=null){
  const id=base=>pageId==='habits'?base:base+'-'+pageId,preference='noava.habit-view'+(categoryFilter?':'+categoryFilter:'');
  const page=document.getElementById(pageId),P=HabitPeriods,modes={day:'روزانه',week:'هفتگی',month:'ماهانه',quarter:'فصلی',year:'سالانه'};
  let mode='month',anchor=DateContext.date,habits=[],request=0,busy=false,timer;
  try{const stored=localStorage.getItem(preference);if(modes[stored])mode=stored;}catch{}
  const n=(tag,text,cls)=>{const el=document.createElement(tag);if(text!=null)el.textContent=text;if(cls)el.className=cls;return el;};
  const number=v=>Number(v).toLocaleString('fa-IR'),date=d=>faDateLabel(d);
  const button=(label,action,cls)=>{const b=n('button',label,cls);b.type='button';b.onclick=action;return b;};
  const active=()=>!page.classList.contains('hidden');
  const shell=n('section',null,'habit-views');shell.id=id('habitViews');shell.setAttribute('aria-label','نماهای روتین‌ها');
  const tabs=n('div',null,'hp-tabs');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','نمای روتین‌ها');
  const tabButtons=[];
  for(const [key,title]of Object.entries(modes)){const b=button(title,()=>choose(key,anchor));b.id=id('habit-tab-'+key);b.setAttribute('role','tab');b.setAttribute('aria-controls',id('habitViewPanel'));b.dataset.habitView=key;b.onkeydown=e=>{const i=tabButtons.indexOf(b),step=e.key==='ArrowLeft'?1:e.key==='ArrowRight'?-1:0;if(step||['Home','End'].includes(e.key)){e.preventDefault();const next=tabButtons[e.key==='Home'?0:e.key==='End'?tabButtons.length-1:(i+step+tabButtons.length)%tabButtons.length];next.click();next.focus();}};tabButtons.push(b);tabs.append(b);}
  const nav=n('div',null,'hp-navigation'),previous=button('دورهٔ قبل',()=>choose(mode,P.move(mode,anchor,-1))),next=button('دورهٔ بعد',()=>choose(mode,P.move(mode,anchor,1))),today=button('امروز',()=>choose(mode,DateContext.today())),label=n('label','تاریخ مبنا'),input=n('input');input.type='date';input.value=anchor;input.setAttribute('aria-label','تاریخ مبنای نمای روتین');label.append(input);input.onchange=()=>{if(DateContext.valid(input.value))choose(mode,input.value);};
  const refresh=button('به‌روزرسانی',()=>load()),heading=n('h2'),status=n('p',null,'hp-status');status.setAttribute('role','status');
  nav.append(previous,today,next,label,refresh);const panel=n('div');panel.id=id('habitViewPanel');panel.setAttribute('role','tabpanel');panel.tabIndex=0;
  shell.append(tabs,nav,heading,status,panel);page.querySelector('.hero').after(shell);
  page.querySelector('.hero p').textContent=categoryFilter?'ثبت و مرور روتین‌های '+RoutineCategories.label(categoryFilter)+' در نماهای روزانه تا سالانه.':'ثبت انجام روتین‌ها و مرور روند روزانه، هفتگی، ماهانه، فصلی و سالانه.';
  for(const selector of ['.habit-period-grid','#habitLoadNotice','.habit-combined-card']){const old=page.querySelector(selector);if(old){old.hidden=true;old.classList.add('hp-legacy');}}
  PersianUI.scan(label);
  function choose(key,value){if(busy)return;mode=key;anchor=value;try{localStorage.setItem(preference,mode);}catch{}render();if(!habits.length)load();}
  async function load(){
    const seq=++request;status.textContent='در حال دریافت روتین‌ها…';refresh.disabled=true;
    try{const rows=await apiFetch('/api/habits');if(seq!==request)return;habits=rows;status.textContent='';render();}
    catch(error){if(seq===request){status.textContent='دریافت روتین‌ها انجام نشد: '+error.message;if(!panel.children.length)panel.append(button('تلاش دوباره',load));}}
    finally{if(seq===request)refresh.disabled=false;}
  }
  async function toggle(habit,day,check){
    if(busy)return;busy=true;const old=Boolean(habit.logs?.[day]);render();status.textContent='در حال ثبت…';
    try{
      // ISO dates avoid ambiguity at Persian month/year boundaries; do not resend all logs.
      const saved=await apiFetch('/api/habits/'+encodeURIComponent(habit.id)+'/toggle',{method:'POST',body:JSON.stringify({date:day})});
      const index=habits.findIndex(h=>h.id===habit.id);if(index>=0)habits[index]={...habits[index],...saved};status.textContent='ثبت شد.';
    }catch(error){check.checked=old;status.textContent='ثبت انجام نشد: '+error.message;}
    finally{busy=false;render();}
  }
  function render(){
    input.value=anchor;const range=P.period(mode,anchor),realToday=DateContext.today(),data=P.summary(habits.filter(h=>!categoryFilter||(h.routine_type||'general')===categoryFilter),range,realToday);
    heading.textContent='نمای '+modes[mode]+' · '+(range.from===range.to?date(range.from):date(range.from)+' تا '+date(range.to));
    for(const b of tabButtons){const selected=b.dataset.habitView===mode;b.setAttribute('aria-selected',String(selected));b.tabIndex=selected?0:-1;b.disabled=busy;}
    panel.setAttribute('aria-labelledby',id('habit-tab-'+mode));panel.setAttribute('aria-busy',String(busy));for(const control of [previous,next,today,input])control.disabled=busy;
    panel.replaceChildren();const metrics=n('div',null,'hp-metrics');for(const [title,value]of [['روتین فعال',data.rows.length],['دفعات ثبت انجام',data.total],['روز دارای ثبت',data.active_days]]){const card=n('div');card.append(n('span',title),n('strong',number(value)));metrics.append(card);}panel.append(metrics);
    panel.append(n('p',range.aggregate?'هر ستون جمع ثبت‌های یک ماه است؛ برای دیدن و تغییر روزهای آن، روی ماه بزنید.':'ستون امروز سبز است. خانه‌های روزهای آینده غیرفعال‌اند.','hp-hint'));
    if(!data.rows.length){panel.append(n('p','روتین فعالی وجود ندارد؛ از دکمهٔ «افزودن عادت» استفاده کنید.','hp-empty'));return;}
    const scroll=n('div',null,'hp-scroll');scroll.tabIndex=0;scroll.setAttribute('role','region');scroll.setAttribute('aria-label','جدول روتین‌ها؛ برای دیدن ستون‌های بیشتر پیمایش کنید');
    const table=n('table',null,'hp-matrix');table.id=id('habitPeriodTable');table.dataset.view=mode;const caption=n('caption','روتین‌ها در نمای '+modes[mode]);caption.className='sr-only';table.append(caption);
    const seasons=['بهار','تابستان','پاییز','زمستان'],groups=[];
    range.buckets.forEach((bucket,i)=>{
      const part=P.parts(bucket.from),key=mode==='month'||mode==='week'?P.period('week',bucket.from).from:mode==='year'?Math.floor((part.month-1)/3):mode==='quarter'?'quarter':bucket.from;
      if(groups.at(-1)?.key===key){groups.at(-1).end=i;return;}
      const title=mode==='month'?'هفتهٔ '+number(groups.length+1):mode==='week'?'هفتهٔ '+date(range.from)+' تا '+date(range.to):mode==='quarter'||mode==='year'?seasons[Math.floor((part.month-1)/3)]+' '+number(part.year):date(bucket.from);
      groups.push({key,start:i,end:i,title});
    });
    const boundaries=(cell,i)=>{if(groups.some(g=>g.start===i))cell.classList.add('hp-period-start');if(groups.some(g=>g.end===i))cell.classList.add('hp-period-end');if(range.aggregate)cell.classList.add('hp-month-cell');};
    const thead=n('thead'),groupRow=n('tr',null,'hp-group-row'),tr=n('tr',null,'hp-day-row');const name=n('th','روتین');name.scope='col';name.rowSpan=2;name.className='hp-name';groupRow.append(name);
    for(const group of groups){const cell=n('th',group.title,'hp-period-heading');cell.scope='colgroup';cell.colSpan=group.end-group.start+1;cell.title=date(range.buckets[group.start].from)+' تا '+date(range.buckets[group.end].to);groupRow.append(cell);}
    range.buckets.forEach((bucket,i)=>{
      const th=n('th');th.scope='col';boundaries(th,i);if(bucket.from<=realToday&&bucket.to>=realToday){th.classList.add('hp-today');th.setAttribute('aria-current','date');}
      if(range.aggregate){const title=new Intl.DateTimeFormat('fa-IR',{timeZone:'UTC',month:'long'}).format(new Date(bucket.from+'T12:00:00Z'));th.append(button(title,()=>choose('month',bucket.from),'hp-month-link'));}
      else{th.append(n('span',number(P.parts(bucket.from).day)),n('small',new Intl.DateTimeFormat('fa-IR',{timeZone:'UTC',weekday:'short'}).format(new Date(bucket.from+'T12:00:00Z'))));th.title=date(bucket.from);}
      const count=data.rows.reduce((sum,r)=>sum+r.counts[range.buckets.indexOf(bucket)],0),bar=n('i',null,'hp-column-bar');bar.style.height=(Math.min(1,count/Math.max(1,data.rows.length*(bucket.dates.filter(d=>d<=realToday).length||1)))*45)+'px';bar.title=number(count)+' ثبت';th.append(bar);tr.append(th);
    });
    for(const title of ['جمع ثبت','ویرایش']){const th=n('th',title);th.scope='col';th.rowSpan=2;groupRow.append(th);}thead.append(groupRow,tr);table.append(thead);const body=n('tbody');
    for(const habit of data.rows){
      const row=n('tr'),name=n('th',habit.title,'hp-name');name.scope='row';row.append(name);
      range.buckets.forEach((bucket,i)=>{
        const td=n('td');boundaries(td,i);if(bucket.from<=realToday&&bucket.to>=realToday)td.classList.add('hp-today');
        if(range.aggregate){const count=habit.counts[i];td.append(button(number(count)+' ثبت',()=>choose('month',bucket.from),'hp-month-count'));}
        else{const check=n('input');check.type='checkbox';check.checked=Boolean(habit.logs?.[bucket.from]);check.disabled=busy||bucket.from>realToday;check.setAttribute('aria-label',habit.title+'، '+date(bucket.from));check.onchange=()=>toggle(habit,bucket.from,check);td.append(check);}
        row.append(td);
      });
      row.append(n('td',number(habit.counts.reduce((a,b)=>a+b,0))));const edit=n('td');const b=button('✎',()=>baseEditModule('habit',habit.id,habit.title),'habit-edit-mini');b.dataset.habitId=habit.id;b.setAttribute('aria-label','ویرایش '+habit.title);b.disabled=busy;edit.append(b);row.append(edit);body.append(row);
    }
    table.append(body);scroll.append(table);panel.append(scroll,n('p','اعداد بر اساس ثبت‌های واقعی روتین‌های فعال‌اند؛ روز بدون تیک به‌تنهایی به معنی نقض هدف هفتگی نیست. تغییر هدف، توقف یا حذف روتین تاریخچهٔ کامل ندارد.','hp-hint'));
  }
  // Existing refresh and page-open lifecycles keep calling these public entry points.
  if(pageId==='habits'){window.loadHabitMatrix=load;window.loadHabitMonthFromApi=load;}
  window.addEventListener('nova:data-changed',()=>{if(active()){clearTimeout(timer);timer=setTimeout(load,300);}});
  window.addEventListener('nova:clock-day',()=>{if(active())render();});
  render();if(active())load();
  return {load,get mode(){return mode;},get anchor(){return anchor;}};
  }
  const views={habits:mountRoutineView('habits'),reading:mountRoutineView('reading','reading'),sports:mountRoutineView('sports','exercise')};
  window.HabitViews=views.habits;window.HabitCategoryViews=views;
  const open=window.handleFunctionalPageOpen;window.handleFunctionalPageOpen=async function(page){await open?.(page);if(page!=='habits'&&views[page])await views[page].load();};
})();
