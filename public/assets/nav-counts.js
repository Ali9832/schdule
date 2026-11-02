(() => {
  const group=document.querySelector('#mainSidebar [data-nav-group="tasks"]');
  const labels={v11TaskBadge:'کار باز',waitingNavBadge:'کار در انتظار',projectNavBadge:'پروژهٔ فعال',meetingNavBadge:'جلسه در هفتهٔ جاری',habitNavBadge:'روتین فعال',spiritualNavBadge:'روتین معنوی فعال'};
  const taskBadge=document.getElementById('v11TaskBadge');
  const taskShortcuts=[...document.querySelectorAll('[data-nav-count="v11TaskBadge"]')];
  function syncTaskShortcuts(){for(const badge of taskShortcuts){badge.textContent=taskBadge.textContent;for(const name of ['title','aria-label']){const value=taskBadge.getAttribute(name);if(value===null)badge.removeAttribute(name);else badge.setAttribute(name,value);}}}
  if(taskBadge&&taskShortcuts.length){new MutationObserver(syncTaskShortcuts).observe(taskBadge,{childList:true,characterData:true,subtree:true,attributes:true,attributeFilter:['title','aria-label']});syncTaskShortcuts();}
  let running,again=false,timer;
  function set(id,value){const badge=group?.querySelector('#'+id);if(!badge)return;badge.textContent=toFaNum(value??0);badge.title=labels[id];badge.setAttribute('aria-label',labels[id]+': '+badge.textContent);}
  async function refresh(){
    if(running){again=true;return running;}
    running=Promise.allSettled([
      v112Get('dashboard','/api/v11.2/dashboard',{ttl:12000}).then(data=>{
        set('v11TaskBadge',data.summary?.tasks_open);set('waitingNavBadge',data.attention?.waiting_count);
        set('projectNavBadge',data.summary?.projects_active);set('meetingNavBadge',data.meetings?.week_count);set('habitNavBadge',data.routines?.active);
      }),
      v112Get('spiritual-nav','/api/v11.11/integration',{ttl:60000}).then(data=>set('spiritualNavBadge',data.spiritual?.summary?.active))
    ]).finally(()=>{running=null;if(again){again=false;schedule();}});
    return running;
  }
  function schedule(){clearTimeout(timer);timer=setTimeout(refresh,250);}
  group?.addEventListener('toggle',()=>{if(group.open)schedule();});
  window.addEventListener('nova:data-changed',schedule);
  window.addEventListener('nova:page-open',schedule);
  window.addEventListener('focus',schedule);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule();});
  window.NovaNavCounts={refresh};refresh();
})();
