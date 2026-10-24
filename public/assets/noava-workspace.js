(() => {
  'use strict';
  const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
  const button=(text,action)=>{const b=node('button',text);b.type='button';b.onclick=action;return b;};
  let account=null;
  async function profile(){
    const root=document.getElementById('noavaProfile');root.textContent='در حال دریافت حساب…';
    try{account=(await apiFetch('/api/auth/me')).user;root.replaceChildren(node('h1','صفحهٔ کاربری'),node('h2',account.display_name||'حساب من'));const dl=node('dl');for(const [label,value]of [['نام نمایشی',account.display_name],['ایمیل',account.email]]){dl.append(node('dt',label),node('dd',value||'ثبت نشده'));}root.append(dl,button('تنظیمات',()=>goPage('settings')));const logout=document.querySelector('#accountSettings button');if(logout)root.append(button('خروج از حساب',()=>logout.click()));document.getElementById('crumb').textContent='صفحهٔ کاربری';syncAccount();}
    catch(error){root.replaceChildren(node('p',error.message,'record-edit-error'),button('تلاش دوباره',profile));}
  }
  function syncAccount(){try{account ||= JSON.parse(localStorage.getItem('nova_user')||'null');}catch{}if(!account)return;const name=account.display_name||'حساب من';document.querySelector('.profile-details strong').textContent=name;for(const avatar of document.querySelectorAll('.profile .avatar,.top-actions .avatar')){avatar.textContent=[...name][0]||'م';avatar.title=name;}}
  const openPage=window.handleFunctionalPageOpen;window.handleFunctionalPageOpen=async function(page){await openPage?.(page);if(page==='profile')await profile();};
  function bindGeneric(){const root=document.getElementById('genericModalBg');if(root.classList.contains('hidden'))return;const key=typeof BASE_EDIT!=='undefined'&&BASE_EDIT?`generic:${BASE_EDIT.kind}:${BASE_EDIT.type||''}:${BASE_EDIT.id}`:`generic:new:${currentAddType}:${DateContext.date}`;NoavaDrafts.bind(root,key);NoavaMoney.enhance(root);}
  for(const name of ['openGenericAdd','baseEditTask','baseEditModule']){const original=window[name];window[name]=function(...args){const result=original.apply(this,args);if(result?.then)return result.then(value=>{bindGeneric();return value;});bindGeneric();return result;};}
  const saveGeneric=window.saveGenericAdd;let savingGeneric=false;
  window.saveGenericAdd=async function(...args){
    if(savingGeneric)return;
    const form=document.getElementById('genericAddForm');if(form&&!form.reportValidity())return;
    savingGeneric=true;const buttons=[...document.querySelectorAll('#genericModalBg .modal-actions button')],disabled=buttons.map(b=>b.disabled);buttons.forEach(b=>b.disabled=true);
    try{return await saveGeneric.apply(this,args);}finally{savingGeneric=false;buttons.forEach((b,i)=>b.disabled=disabled[i]);}
  };
  const composers=[['v116Composer','/api/v11.6/meetings'],['v117Composer','/api/v11.7/outcomes'],['v118Composer','/api/v11.8/resources']];
  for(const [name,id]of [['v116OpenNew','v116Composer'],['v116Edit','v116Composer'],['v117OpenOutcome','v117Composer'],['v118OpenComposer','v118Composer']]){
    const original=window[name];if(typeof original!=='function')continue;
    window[name]=function(...args){const result=original.apply(this,args),root=document.getElementById(id);if(!root)return result;const entity=name==='v116OpenNew'?'new':args[0]||'new';const options=id==='v116Composer'?{extra:()=>({actions:V116_FORM_ACTIONS,decisions:V116_FORM_DECISIONS,waiting:V116_FORM_WAITING}),restoreExtra:value=>{V116_FORM_ACTIONS=value.actions||[];V116_FORM_DECISIONS=value.decisions||[];V116_FORM_WAITING=value.waiting||[];v116RenderBuilders();}}:{};NoavaDrafts.bind(root,`composer:${id}:${entity}`,options);return result;};
  }
  const signature=root=>JSON.stringify([...root.querySelectorAll('input,textarea,select')].filter(n=>n.type!=='file').map(n=>[n.id||n.name,n.value,n.checked]));
  const originalApi=window.apiFetch;
  window.apiFetch=async function(path,options){
    const specialized=composers.filter(([id,prefix])=>document.getElementById(id)?.classList.contains('open')&&path.split('?')[0].startsWith(prefix)&&['POST','PUT','PATCH'].includes(options?.method)).map(([id])=>{const root=document.getElementById(id);return {root,draft:root._noavaDraft,before:signature(root)};});
    const root=document.getElementById('genericModalBg'),active=!root.classList.contains('hidden')&&options?.body&&['POST','PATCH'].includes(options?.method),draft=active?root._noavaDraft:null,before=active?signature(root):null;
    let body;try{body=JSON.parse(options?.body||'null');}catch{}
    const genericTitle=document.getElementById('genericTitleInput').value.trim();
    const matches=active&&body&&(body.title===genericTitle||body.name===genericTitle||body.description===genericTitle)&&/^\/api\/(tasks|projects|habits|finance\/transactions|modules\/[^/]+\/items)(\/|\?|$)/.test(path);
    const result=await originalApi(path,options);if(matches&&before===signature(root))draft?.clear();for(const item of specialized)if(item.before===signature(item.root))item.draft?.clear();return result;
  };
  document.addEventListener('click',event=>{if(event.target.closest('#genericModalBg button[onclick="closeGenericAdd()"]'))document.getElementById('genericModalBg')._noavaDraft?.clear();});
  const capture=document.querySelector('.home-capture');if(capture)NoavaDrafts.bind(capture,'home-capture');
  const renderDaily=window.renderDailyTaskManager;window.renderDailyTaskManager=function(...args){const result=renderDaily.apply(this,args),body=document.getElementById('dailyTaskTableBody');const rows=[...body.querySelectorAll('tr')];rows.forEach(row=>row.classList.toggle('is-done',!!row.querySelector('.task-sheet-check:checked')));rows.filter(row=>row.classList.contains('is-done')).forEach(row=>body.append(row));return result;};
  syncAccount();window.addEventListener('storage',syncAccount);setTimeout(syncAccount,1200);
  // One daily review, with a manual entry point for deferred items.
  let review=null,reviewing=false;
  const reviewSeen=key=>{try{return sessionStorage.getItem(key)==='1';}catch{return false;}};
  const markReviewSeen=key=>{try{sessionStorage.setItem(key,'1');}catch{}};
  async function overdue(manual=false){
    if(review?.open||reviewing)return;reviewing=true;
    try{
      const today=DateContext.today(),user=JSON.parse(localStorage.getItem('nova_user')||'null')?.id||'local-demo',seen='noava.overdue:'+user+':'+today;
      if(!manual&&reviewSeen(seen))return;
      const result=await apiFetch('/api/calendar/overdue');if(!result.entries.length){if(manual)showToast('کارهای عقب‌افتاده','مورد بازی در بازهٔ دو سال اخیر وجود ندارد.');return;}
      if(!manual&&(document.querySelector('dialog[open]')||!document.getElementById('genericModalBg').classList.contains('hidden')||document.querySelector('#v11Inspector.open')||document.activeElement?.matches('input,textarea,select,[contenteditable=true]')))return;
      const dialog=node('dialog',null,'overdue-dialog');review=dialog;dialog.id='overdueReview';dialog.setAttribute('aria-label','مرور کارهای عقب‌افتاده');
      const heading=node('header',null,'overdue-heading'),title=node('h2','این برنامه‌ها از روزهای قبل باقی مانده‌اند');
      const dismiss=()=>{if(busy)return;markReviewSeen(seen);dialog.close();};
      const close=button('×',dismiss);close.className='overdue-close';close.setAttribute('aria-label','بستن مرور عقب‌افتاده‌ها');heading.append(title,close);
      dialog.append(heading,node('p','موارد انجام‌شده را تیک بزنید یا حذف کنید؛ فقط موارد انتخاب‌شده با تأیید شما به امروز منتقل می‌شوند. بازهٔ بررسی: دو سال اخیر.'));
      const list=node('div',null,'overdue-list'),error=node('p','','record-edit-error');list.setAttribute('aria-label','برنامه‌های عقب‌افتاده');list.tabIndex=0;error.setAttribute('role','alert');const selected=new Map();let busy=false;
      const controls=()=>[...dialog.querySelectorAll('button,input')];
      async function action(row,item,type){if(busy)return;if(type==='delete'&&!confirm('این مورد حذف شود؟'))return;busy=true;controls().forEach(n=>n.disabled=true);error.textContent='';try{
        const endpoint=`/api/calendar/${item.source}/${encodeURIComponent(item.id)}`;
        if(type==='done')await apiFetch(endpoint,{method:'PATCH',body:JSON.stringify({done:true,...(item.occurrence_date?{occurrence_date:item.occurrence_date}:{})})});
        else if(item.source==='task'&&!item.occurrence_date)await apiFetch('/api/tasks/'+encodeURIComponent(item.id),{method:'DELETE'});
        else await apiFetch(endpoint+(item.occurrence_date?'?occurrence_date='+item.occurrence_date:''),{method:'DELETE'});
        selected.delete(item.key);row.remove();if(!list.children.length){markReviewSeen(seen);dialog.close();}
      }catch(failure){error.textContent=failure.message;}finally{busy=false;controls().forEach(n=>n.disabled=false);}}
      for(const item of result.entries){const row=node('article',null,'overdue-row'),label=node('label'),choose=node('input');choose.type='checkbox';choose.checked=true;choose.setAttribute('aria-label','انتقال به امروز: '+item.title);selected.set(item.key,item);choose.onchange=()=>choose.checked?selected.set(item.key,item):selected.delete(item.key);const caption=node('span',item.title);caption.append(node('small',faDateLabel(item.date)));label.append(choose,caption);row.append(label,button('✓ انجام شد',()=>action(row,item,'done')),button('حذف',()=>action(row,item,'delete')));list.append(row);}
      const move=button('تأیید و انتقال انتخاب‌شده‌ها به امروز',async()=>{
        if(busy||!selected.size)return;busy=true;const label=move.textContent,items=[...selected.values()].map(item=>({source:item.source,id:item.id,occurrence_date:item.occurrence_date||null}));
        controls().forEach(n=>n.disabled=true);dialog.setAttribute('aria-busy','true');move.textContent=`در حال انتقال گروهی ${toFaNum(items.length)} مورد…`;error.textContent='';
        try{
          const result=await apiFetch('/api/calendar/carry-forward',{method:'POST',body:JSON.stringify({items})});
          selected.clear();markReviewSeen(seen);dialog.close();showToast('برنامه به‌روز شد',`${toFaNum(result.moved_count+result.unchanged_count)} مورد برای ${faDateLabel(result.date)} تنظیم شد.`);NovaFastUI.scheduleVisibleRefresh();
        }catch(failure){error.textContent='انتقال گروهی تأیید نشد؛ برای تلاش دوباره موارد انتخاب‌شده حفظ شدند. '+failure.message;}
        finally{busy=false;dialog.removeAttribute('aria-busy');move.textContent=label;controls().forEach(n=>n.disabled=false);}
      });
      [...list.children].forEach((row,i)=>row.dataset.key=result.entries[i].key);
      const later=button('بعداً بررسی می‌کنم',dismiss),footer=node('footer',null,'overdue-footer');footer.append(move,later);dialog.append(list,error,footer);
      dialog.addEventListener('cancel',event=>{event.preventDefault();dismiss();});dialog.addEventListener('close',()=>{dialog.remove();if(review===dialog)review=null;});
      let outside=false;const onBackdrop=event=>{const r=dialog.getBoundingClientRect();return event.target===dialog&&(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom);};
      dialog.addEventListener('pointerdown',event=>{outside=onBackdrop(event);});dialog.addEventListener('click',event=>{if(outside&&onBackdrop(event))dismiss();outside=false;});
      document.body.append(dialog);dialog.showModal();close.focus({preventScroll:true});
    }catch(error){if(manual)showToast('بررسی انجام نشد',error.message);}
    finally{reviewing=false;}
  }
  const today=document.getElementById('today');const reviewButton=button('مرور برنامه‌های عقب‌افتاده',()=>overdue(true));reviewButton.className='btn';today.prepend(reviewButton);
  setTimeout(()=>overdue(),3000);window.addEventListener('nova:clock-day',()=>overdue());
  window.NoavaWorkspace={profile,overdue};
})();
