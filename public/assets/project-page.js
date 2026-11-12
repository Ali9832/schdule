(() => {
  'use strict';
  const page=document.getElementById('project-detail'),body=document.getElementById('projectPageBody'),title=document.getElementById('projectPageTitle'),baseTitle=document.title;
  let currentId=null,revision=0,restoring=false;
  const isCurrent=id=>currentId===id&&!page.classList.contains('hidden');
  function updateTitle(name){title.textContent=name;document.getElementById('crumb').textContent='پروژه‌ها / '+name;document.title=name+' — NOAVA';}
  async function open(id,{history:writeHistory=true}={}){
    const previous=document.querySelector('.page:not(.hidden)')?.id||'projects';
    if(writeHistory&&new URL(location.href).searchParams.get('project')!==id){const url=new URL(location.href);history.replaceState({...history.state,noavaPage:previous},'',location.href);url.searchParams.set('project',id);history.pushState({noavaProject:id},'',url);}
    goPage('project-detail');if(document.body.classList.contains('mobile-menu-open'))window.setMobileMenu?.(false);currentId=id;const request=++revision;window.syncSidebarNavigation?.('projects');title.textContent='در حال دریافت پروژه…';body.replaceChildren();const loading=document.createElement('p');loading.className='project-page-loading';loading.textContent='در حال دریافت اطلاعات پروژه…';body.append(loading);window.scrollTo(0,0);
    try{
      const data=await apiFetch('/api/v11/inspector/project/'+encodeURIComponent(id));if(request!==revision||!isCurrent(id))return;
      updateTitle(data.entity.name);body.replaceChildren();ProjectDetailsUI.render(body,data.entity,data.linked||[]);const controller=ProjectWorkspace.mount(body,data.entity);await controller.ready;
    }catch(error){if(request!==revision||!isCurrent(id))return;title.textContent='دریافت پروژه انجام نشد';body.replaceChildren();const message=document.createElement('p');message.className='record-edit-error';message.textContent=error.message||'دریافت پروژه انجام نشد.';const retry=document.createElement('button');retry.type='button';retry.textContent='تلاش دوباره';retry.onclick=()=>open(id,{history:false});body.append(message,retry);}
  }
  window.addEventListener('nova:page-open',event=>{
    if(event.detail.page==='project-detail')return;
    if(currentId){currentId=null;revision++;document.title=baseTitle;}
    const url=new URL(location.href);if(url.searchParams.has('project')&&!restoring){url.searchParams.delete('project');history.pushState({noavaPage:event.detail.page},'',url);}
  });
  window.addEventListener('popstate',()=>{const id=new URL(location.href).searchParams.get('project');if(id)void open(id,{history:false});else{restoring=true;try{goPage(document.getElementById(history.state?.noavaPage)?.classList.contains('page')?history.state.noavaPage:'projects');}finally{restoring=false;}}});
  window.addEventListener('nova:ui-ready',()=>{const id=new URL(location.href).searchParams.get('project');if(id)void open(id,{history:false});});
  window.ProjectPage={open,isCurrent,updateTitle,back(){goPage('projects');window.scrollTo(0,0);},get currentId(){return currentId;},body};
})();
