(() => {
  let generation=0,question=null,inspectorRequest=0;
  const activePage=()=>document.querySelector('.page:not(.hidden)')?.id;
  const hideInspector=()=>{inspectorRequest++;const shell=document.getElementById('v11Inspector');shell?.classList.remove('open');shell?.setAttribute('aria-hidden','true');if(shell)shell.inert=true;document.getElementById('v11InspectorEditBtn').hidden=false};
  window.closeV11Inspector=hideInspector;
  function closeAll(){
    generation++;question?.(null);hideInspector();
    document.querySelectorAll('.modal-bg,.command-bg').forEach(node=>node.classList.add('hidden'));
    document.querySelectorAll('.v116-composer,.v117-composer,.v118-composer').forEach(node=>{node.classList.remove('open');node.setAttribute('aria-hidden','true')});
    document.querySelectorAll('.v1110-composer,.v1111-composer,.v1112-composer,#v115Composer').forEach(node=>node.classList.add('hidden'));
    document.querySelectorAll('dialog[open]').forEach(node=>{node.close();if(node.matches('.persian-calendar,.app-question'))node.remove()});
    if(typeof BASE_EDIT!=='undefined')BASE_EDIT=null;
  }
  window.AppOverlays={closeAll,get generation(){return generation}};
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!document.querySelector('dialog[open]')){closeAll()}});
  window.AppDialogs={ask(message,initial=''){
    question?.(null);const owner=generation,previousFocus=document.activeElement;
    return new Promise(resolve=>{
      const dialog=document.createElement('dialog');dialog.className='app-question';dialog.setAttribute('aria-label','ویرایش اطلاعات');
      const form=document.createElement('form');form.className='record-edit-form';const title=document.createElement('h2');title.textContent='ویرایش اطلاعات';
      const label=document.createElement('label');label.textContent=message;const input=document.createElement('input');input.type='text';input.value=initial??'';label.append(input);
      const actions=document.createElement('div');actions.className='record-edit-actions';const save=document.createElement('button'),cancel=document.createElement('button');save.type='submit';save.textContent='تأیید';cancel.type='button';cancel.textContent='انصراف';actions.append(save,cancel);form.append(title,label,actions);dialog.append(form);document.body.append(dialog);
      let settled=false;const finish=value=>{if(settled)return;settled=true;question=null;dialog.close();dialog.remove();if(owner===generation&&previousFocus?.isConnected)previousFocus.focus();resolve(value)};question=finish;cancel.onclick=()=>finish(null);dialog.addEventListener('cancel',event=>{event.preventDefault();finish(null)});form.onsubmit=event=>{event.preventDefault();finish(input.value)};dialog.showModal();input.focus();input.select();
    });
  }};
  const names={task:'کار',project:'پروژه',area:'حوزه',resource:'منبع',outcome:'هدف',routine:'روتین',event:'رویداد',meeting:'جلسه'};
  const states=[['active','در جریان'],['incubating','در حال آماده‌سازی'],['someday','شاید در آینده'],['archived','بایگانی‌شده']];
  const field=(key,label,type='text',options=null)=>({key,label,type,options});
  function fieldsFor(type,e){
    const areas=[['','بدون حوزه'],...(V11_DATA?.areas||[]).map(a=>[a.id,a.name])];
    const shared=[field('area_id','حوزه','select',areas)];
    if(type==='project')return [field('name','نام پروژه'),field('lifecycle_status','وضعیت پروژه','select',states),field('description','توضیحات','textarea'),field('outcome','نتیجهٔ مورد انتظار','textarea'),...shared,field('due_date','موعد','date'),field('review_at','مرور بعدی','date')];
    if(type==='task')return [field('title','عنوان کار'),field('status','وضعیت','select',[['todo','باز'],['in_progress','در دست اقدام'],['done','انجام‌شده']]),field('priority','اولویت','select',[['low','کم'],['medium','متوسط'],['high','بالا']]),field('description','توضیحات','textarea'),field('project_id','پروژه','select',[['','بدون پروژه'],...(V11_DATA?.projects||[]).map(p=>[p.id,p.name])]),...shared,field('due_date','موعد','date'),field('estimate_minutes','زمان تخمینی (دقیقه)','number'),field('context','موقعیت انجام کار'),field('waiting_on','در انتظار پاسخ از'),field('resume_note','یادداشت ادامهٔ کار','textarea')];
    if(type==='area')return [field('name','نام حوزه'),field('description','توضیحات','textarea'),field('standard','انتظار از این حوزه','textarea'),field('status','وضعیت','select',[['active','فعال'],['archived','بایگانی‌شده']])];
    if(type==='resource')return [field('title','عنوان منبع'),field('resource_type','نوع','select',[['note','یادداشت'],['article','مقاله'],['book','کتاب'],['course','دوره'],['video','ویدئو'],['podcast','پادکست'],['website','وب‌سایت']]),field('status','وضعیت','select',[['inbox','ورودی'],['backlog','برای بعد'],['in_progress','در حال مطالعه'],['done','تکمیل‌شده'],['archived','بایگانی‌شده']]),...shared,field('url','پیوند','url'),field('note','یادداشت','textarea')];
    if(type==='outcome')return [field('title','عنوان هدف'),...shared,field('status','وضعیت','select',[['active','فعال'],['in_progress','در جریان'],['done','انجام‌شده'],['archived','بایگانی‌شده']]),field('current_value','مقدار فعلی','number'),field('target_value','مقدار هدف','number'),field('unit','واحد'),field('due_date','موعد','date'),field('next_action','قدم بعدی'),field('note','یادداشت','textarea')];
    if(type==='routine')return [field('title','عنوان روتین'),field('target_weekly','هدف هفتگی (۱ تا ۷)','number')];
    return [field('title','عنوان'),field('start_at','شروع','datetime-local'),field('end_at','پایان','datetime-local'),...(type==='meeting'||String(e.notes||'').startsWith('NOVA_')?[]:[field('notes','یادداشت','textarea')])];
  }
  window.openV11Inspector=async function(type,id){
    closeAll();
    const request=++inspectorRequest,owner=generation,shell=document.getElementById('v11Inspector'),body=document.getElementById('v11InspectorBody'),edit=document.getElementById('v11InspectorEditBtn');
    V11_INSPECTOR={type,id};shell.inert=false;shell.classList.add('open');shell.setAttribute('aria-hidden','false');shell.setAttribute('role','region');shell.setAttribute('aria-label','جزئیات مورد');edit.hidden=false;edit.disabled=true;body.innerHTML='<div class="v11-empty">در حال دریافت اطلاعات…</div>';
    try{let data;try{data=await apiFetch(`/api/v11/inspector/${encodeURIComponent(type)}/${encodeURIComponent(id)}`)}catch(error){data=v11LocalInspectorData(type,id);if(!data)throw error}
      if(request!==inspectorRequest||owner!==generation)return;
      const entity=data.entity;document.getElementById('v11InspectorTitle').textContent=v11EntityTitle(type,entity);document.getElementById('v11InspectorType').textContent=(names[type]||'مورد')+' · جزئیات';body.innerHTML=v11InspectorHtml(type,entity,data.linked||[]);body.scrollTop=0;edit.disabled=false;edit.onclick=()=>window.v11EditCurrent(type,entity);
      if(type==='project')window.ProjectWorkspace?.mount(body,entity);
    }catch(error){if(request===inspectorRequest&&owner===generation){body.replaceChildren();const message=document.createElement('p');message.className='record-edit-error';message.textContent=error.message||'دریافت اطلاعات انجام نشد.';body.append(message)}}
  };
  window.v11EditCurrent=function(type,entity){
    const shell=document.getElementById('v11Inspector'),body=document.getElementById('v11InspectorBody'),owner=generation,page=activePage(),request=++inspectorRequest;
    shell.inert=false;shell.classList.add('open');shell.setAttribute('aria-hidden','false');document.getElementById('v11InspectorEditBtn').hidden=true;document.getElementById('v11InspectorType').textContent='ویرایش '+(names[type]||'مورد');
    const form=document.createElement('form');form.className='record-edit-form';form.dataset.entityType=type;const controls=new Map();
    for(const f of fieldsFor(type,entity)){
      const label=document.createElement('label');label.textContent=f.label;const input=document.createElement(f.type==='textarea'?'textarea':f.type==='select'?'select':'input');
      if(f.options){for(const [value,text] of f.options)input.add(new Option(text,value));if(entity[f.key]&&!f.options.some(x=>x[0]===entity[f.key]))input.add(new Option(entity[f.key],entity[f.key]))}else if(input.tagName==='INPUT')input.type=f.type;
      input.name=f.key;input.id='recordEdit-'+f.key;input.value=entity[f.key]??'';if(['title','name'].includes(f.key))input.required=true;if(f.type==='number'){input.step='any';input.min='0';if(f.key==='target_weekly'){input.min='1';input.max='7'}}
      label.append(input);form.append(label);controls.set(f.key,input);
    }
    const error=document.createElement('p');error.className='record-edit-error';error.setAttribute('role','status');error.setAttribute('aria-live','polite');
    const actions=document.createElement('div');actions.className='record-edit-actions';const save=document.createElement('button'),cancel=document.createElement('button');save.type='submit';save.textContent='ذخیره تغییرات';cancel.type='button';cancel.textContent='انصراف';actions.append(save,cancel);form.append(error,actions);body.replaceChildren(form);body.scrollTop=0;window.PersianUI?.scan(form);controls.values().next().value?.focus();
    cancel.onclick=()=>openV11Inspector(type,entity.id);
    form.onsubmit=async event=>{
      event.preventDefault();if(save.disabled||owner!==generation||request!==inspectorRequest)return;if(!form.reportValidity())return;
      const patch={};for(const [key,input] of controls){const value=input.value;patch[key]=input.type==='number'?Number(value||0):key.endsWith('_id')||input.dataset.persianType?value||null:value.trim()}
      if(patch.start_at&&patch.end_at&&patch.end_at<=patch.start_at){error.textContent='پایان باید بعد از شروع باشد.';return}
      const route={project:'v11/projects',task:'v11/tasks',area:'v11/areas',resource:'v11/resources',outcome:'v11.7/outcomes',routine:entity.routine_type==='spiritual'?'v11.11/spiritual-routines':'habits',event:'events',meeting:'events'}[type];if(!route){error.textContent='ویرایش این مورد در دسترس نیست.';return}
      save.disabled=true;error.textContent='در حال ذخیره…';
      try{await apiFetch(`/api/${route}/${encodeURIComponent(type==='meeting'?entity.event_id||entity.id:entity.id)}`,{method:'PATCH',body:JSON.stringify(patch)});
        if(owner!==generation||request!==inspectorRequest)return;
        showToast('ذخیره شد','تغییرات ثبت شد.');
        if(window.NovaFastUI)NovaFastUI.scheduleVisibleRefresh();
        else await window.handleFunctionalPageOpen?.(page);
        if(owner!==generation||request!==inspectorRequest)return;
        await openV11Inspector(type,entity.id);
      }catch(failure){if(owner===generation&&request===inspectorRequest)error.textContent=failure.message||'ذخیره انجام نشد. دوباره تلاش کنید.'}finally{save.disabled=false}
    };
  };
  hideInspector();
  for(const name of ['openGenericAdd','baseEditTask','baseEditModule','openModal','openCommandPalette','v116OpenNew','v116Edit','v117OpenOutcome','v118OpenComposer']){
    const open=window[name];if(typeof open!=='function')continue;
    window[name]=function(...args){closeAll();return open.apply(this,args)};
  }
  document.querySelectorAll('.v116-composer,.v117-composer,.v118-composer').forEach(node=>{
    const sync=()=>node.setAttribute('aria-hidden',String(!node.classList.contains('open')));
    new MutationObserver(sync).observe(node,{attributes:true,attributeFilter:['class']});sync();
  });
})();
