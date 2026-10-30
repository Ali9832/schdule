(() => {
  'use strict';
  const entries = {
    areas: { page: 'projects', id: 'projectAreasTools', path: '/api/v11.7/control', apply(data) { V117_DATA=data; renderV117All(); } },
    resources: { page: 'academic', id: 'academicLearningTools', path: '/api/v11.8/learning', apply(data) { V118_DATA=data; v118FillRefs(); renderV118(); } },
    health: { page: 'habits', id: 'habitHealthTools', path: '/api/v11.9/health-system', apply(data) { V119_DATA=data; renderV119(); } },
    appointments: { page: 'calendar', id: 'calendarAppointmentTools', path: '/api/v11.9/health-system', apply(data) { V119_DATA=data; renderV119(); } },
    religious: { page: 'calendar', id: 'calendarOccasionTools', path: '/api/v11.11/integration', apply(data) { V1111_DATA=data; v1111RenderReligious(); v1111RenderSpiritual(); } }
  };
  const active = () => document.querySelector('.page:not(.hidden)')?.id;
  async function load(entry, force=false) {
    if (entry.loaded && !entry.dirty && !force) return;
    if (entry.pending && !force) return entry.pending;
    entry.version=(entry.version||0)+1;
    if (entry.pending) { entry.again=true; return entry.pending; }
    const version=entry.version, panel=document.getElementById(entry.id), status=panel.querySelector('.integrated-status');
    panel.setAttribute('aria-busy','true');status.textContent='در حال دریافت اطلاعات…';
    entry.pending=(async()=>{
      try {
        const data=await apiFetch(entry.path);
        if (version!==entry.version) return;
        entry.apply(data);entry.loaded=true;entry.dirty=false;status.replaceChildren();
      } catch(error) {
        status.textContent='اطلاعات دریافت نشد. '+(error.message||'دوباره تلاش کنید.');
        const retry=document.createElement('button');retry.type='button';retry.textContent='تلاش دوباره';retry.onclick=()=>load(entry,true);status.append(retry);
      } finally {
        panel.removeAttribute('aria-busy');entry.pending=null;
        if(entry.again){entry.again=false;if(panel.open&&active()===entry.page)load(entry,true);}
      }
    })();
    return entry.pending;
  }
  async function refresh(page, force=false) {
    await Promise.all(Object.values(entries).filter(entry=>entry.page===page&&document.getElementById(entry.id).open).map(entry=>load(entry,force)));
  }
  for(const entry of Object.values(entries)) {
    const panel=document.getElementById(entry.id);
    panel.addEventListener('toggle',()=>{if(panel.open&&active()===entry.page)load(entry);});
  }
  function open(name) {
    const entry=entries[name==='archive'?'resources':name];if(!entry)return;
    originalGoPage(entry.page);
    const panel=document.getElementById(entry.id);panel.open=true;
    load(entry);
    requestAnimationFrame(()=>panel.scrollIntoView({block:'start',behavior:'smooth'}));
  }
  const originalGoPage=window.goPage;
  window.goPage=function(page){if(entries[page]||page==='archive')return open(page);return originalGoPage(page);};
  const originalOpen=window.handleFunctionalPageOpen;
  window.handleFunctionalPageOpen=async function(page){await originalOpen?.(page);await refresh(page);};
  let timer;
  window.addEventListener('nova:data-changed',()=>{
    Object.values(entries).forEach(entry=>{entry.dirty=true;});
    clearTimeout(timer);timer=setTimeout(()=>refresh(active(),true),350);
  });
  window.addEventListener('nova:date-changed',()=>refresh(active(),true));
  window.IntegratedTools={open,refresh};
})();
