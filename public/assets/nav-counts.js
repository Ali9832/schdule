(() => {
 const labels={focusNavBadge:'جلسه تمرکز فعال',v11TaskBadge:'کار باز',waitingNavBadge:'کار در انتظار',meetingNavBadge:'جلسه در هفته جاری',v115ScheduleBadge:'رویداد و کار زمان‌بندی‌شده در هفت روز آینده',habitNavBadge:'روتین فعال',v11AreaBadge:'حوزه',v11ResourceBadge:'منبع در جریان یادگیری',v119EnergyBadge:'آخرین انرژی ثبت‌شده از ۱۰',v1110DueBadge:'پیگیری و تعهد عقب‌افتاده'};
 let running=false,again=false,timer,activePage='dashboard';
 const fa=value=>String(value).replace(/\d/g,d=>'۰۱۲۳۴۵۶۷۸۹'[d]);
 function set(id,value){const el=document.getElementById(id);if(!el)return;el.textContent=value==null?'—':fa(value);el.title=labels[id];el.setAttribute('aria-label',`${labels[id]}: ${el.textContent}`)}
 async function refresh(){
  if(running){again=true;return}running=true;
  const jobs=[
   ['/api/v11.2/dashboard',d=>{set('focusNavBadge',d.execution?.current_focus?1:0);set('v11TaskBadge',d.summary?.tasks_open??0);set('waitingNavBadge',d.attention?.waiting_count??0);set('meetingNavBadge',d.meetings?.week_count??0);set('habitNavBadge',d.routines?.active??0);set('v11AreaBadge',d.summary?.areas??0)}],
   ['/api/v11.5/schedule',d=>set('v115ScheduleBadge',(d.entries||[]).length)],
   ['/api/v11.8/learning',d=>{const s=d.summary||{};set('v11ResourceBadge',['inbox','backlog','active','processing'].reduce((n,k)=>n+(s[k]||0),0))}],
   ['/api/v11.9/health-system',d=>set('v119EnergyBadge',(d.metrics||[]).find(m=>m.slug==='energy')?.latest_value??null)],
   ['/api/v11.10/relationships',d=>set('v1110DueBadge',(d.summary?.followups_due||0)+(d.summary?.commitments_overdue||0))]
  ];
  const pages={'/api/v11.5/schedule':['schedule','calendar'],'/api/v11.8/learning':['resources'],'/api/v11.9/health-system':['health'],'/api/v11.10/relationships':['relationships']};
  await Promise.allSettled(jobs.filter(([path])=>!pages[path]||pages[path].includes(activePage)).map(async([path,render])=>{try{render(path==='/api/v11.2/dashboard'?await v112Get('dashboard',path,{ttl:12000}):await window.apiFetch(path))}catch(error){console.warn('شمارنده منو:',path,error)}}));
  running=false;if(again){again=false;schedule()}
 }
 function schedule(){clearTimeout(timer);timer=setTimeout(refresh,180)}
 window.addEventListener('nova:data-changed',()=>{clearTimeout(timer);timer=setTimeout(refresh,750)});
 window.addEventListener('nova:page-open',event=>{activePage=event.detail.page;schedule()});
 window.addEventListener('focus',schedule);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule()});
 setInterval(()=>{if(!document.hidden)refresh()},30000);
 window.NovaNavCounts={refresh};refresh();
})();
