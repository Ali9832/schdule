(() => {
  'use strict';
  const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
  const button=(text,action)=>{const b=node('button',text);b.type='button';b.onclick=action;return b;};
  const request=window.apiFetch,bindings=new WeakMap(),pendingCreates=new Set();let sequence=0;
  const status={todo:'انجام‌نشده',in_progress:'در حال انجام',doing:'در حال انجام',done:'انجام‌شده',cancelled:'لغوشده'};
  const metadata=t=>[status[t.status]||t.status,t.due_date?faDateLabel(t.due_date):'بدون موعد',t.project_name].filter(Boolean).join(' · ');
  const taskInput=input=>input.id==='genericTitleInput'?(!BASE_EDIT&&['daily','general','item'].includes(currentAddType)):input.id==='calendarInput-title'?['task','homework'].includes(document.getElementById('calendarInput-kind')?.value)&&!document.getElementById('calendarItemForm')?.dataset.existingKey:['qaTitle','homeCaptureTitle','v11TaskTitle'].includes(input.id);
  function dialog(title){const d=node('dialog',null,'task-match-dialog');d.setAttribute('aria-label',title);d.append(node('h2',title));document.body.append(d);d.addEventListener('close',()=>d.remove(),{once:true});return d;}
  async function openExisting(id){
    try{
      const task=await request('/api/tasks/'+encodeURIComponent(id));
      const d=dialog('کار قبلاً ثبت‌شده');d.dataset.taskId=id;
      d.append(node('h3',task.title),node('p',metadata(task)),node('p',task.description||'بدون توضیح'));
      const actions=node('div',null,'task-match-actions');
      actions.append(button('ویرایش همین کار',()=>{d.close();window.AppOverlays?.closeAll();if(!BASE_TASKS.some(t=>t.id===id))BASE_TASKS.push(task);else Object.assign(BASE_TASKS.find(t=>t.id===id),task);baseEditTask(id);}),button('بازگشت',()=>d.close()));d.append(actions);d.showModal();
    }catch(error){showToast('کار باز نشد',error.message);}
  }
  function bind(input){
    if(bindings.has(input))return bindings.get(input);
    const box=node('div',null,'task-suggestions');box.id='taskSuggestions-'+(++sequence);box.hidden=true;box.setAttribute('role','listbox');box.setAttribute('aria-label','کارهای مشابه');input.after(box);input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');input.setAttribute('aria-controls',box.id);input.setAttribute('aria-expanded','false');input.autocomplete='off';
    let revision=0,timer,controller,items=[],index=-1,composing=false;
    const hide=()=>{box.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');index=-1;items=[];};
    const show=()=>{box.hidden=false;input.setAttribute('aria-expanded','true');};
    const clear=()=>{revision++;clearTimeout(timer);controller?.abort();hide();};
    async function search(){
      const q=input.value.trim(),turn=++revision;controller?.abort();if(!taskInput(input)||q.length<2){hide();return;}
      controller=new AbortController();box.replaceChildren(node('small','در حال بررسی کارهای مشابه…'));show();
      try{
        const result=await request('/api/tasks/suggestions?q='+encodeURIComponent(q),{signal:controller.signal});
        if(turn!==revision||!input.isConnected||input.value.trim()!==q||!taskInput(input))return;
        items=result.items;index=-1;box.replaceChildren();
        const hint=node('small',items.length?'قبلاً این کارها را ثبت کرده‌ای؛ برای دیدن، یکی را انتخاب کن:':'کار مشابهی پیدا نشد.');hint.setAttribute('role','status');box.append(hint);
        for(const [i,item] of items.entries()){const b=button('',()=>openExisting(item.id));b.className='task-suggestion';b.id=box.id+'-'+i;b.setAttribute('role','option');b.setAttribute('aria-selected','false');b.dataset.taskId=item.id;b.append(node('strong',item.title),node('small',(item.match==='exact'?'عنوان یکسان · ':'')+metadata(item)));box.append(b);}
      }catch(error){if(turn!==revision||error.name==='AbortError')return;box.replaceChildren(node('small','بررسی مشابه‌ها انجام نشد.'),button('تلاش دوباره',search));}
    }
    const schedule=()=>{clear();if(!composing&&taskInput(input)&&input.value.trim().length>=2)timer=setTimeout(search,250);};
    input.addEventListener('input',schedule);input.addEventListener('focus',schedule);input.addEventListener('compositionstart',()=>{composing=true;clear();});input.addEventListener('compositionend',()=>{composing=false;schedule();});
    input.addEventListener('keydown',event=>{
      if(event.isComposing)return;if(event.key==='Escape'){event.preventDefault();event.stopPropagation();clear();return;}
      if(box.hidden||!items.length)return;
      if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();index=index<0?(event.key==='ArrowDown'?0:items.length-1):(index+(event.key==='ArrowDown'?1:-1)+items.length)%items.length;const buttons=box.querySelectorAll('.task-suggestion');buttons.forEach((b,i)=>{b.classList.toggle('selected',i===index);b.setAttribute('aria-selected',String(i===index));});input.setAttribute('aria-activedescendant',buttons[index].id);buttons[index]?.scrollIntoView({block:'nearest'});}
      if(event.key==='Enter'&&index>=0){event.preventDefault();event.stopImmediatePropagation();openExisting(items[index].id);}
    },true);
    input.closest('form')?.addEventListener('change',event=>{if(event.target.id==='calendarInput-kind')clear();});
    const binding={hide,clear,schedule};bindings.set(input,binding);return binding;
  }
  function confirmDuplicate(items){
    return new Promise(resolve=>{
      const d=dialog('این کار قبلاً ثبت شده؟');d.id='taskDuplicateConfirm';let accepted=false;
      d.append(node('p','کارهای زیر عنوان یکسان یا بسیار مشابهی دارند. می‌توانی کار قبلی را باز کنی یا یک کار جداگانه بسازی.'));
      for(const item of items){const b=button('',()=>{d.close();openExisting(item.id);});b.className='task-suggestion';b.append(node('strong',item.title),node('small',metadata(item)));d.append(b);}
      const actions=node('div',null,'task-match-actions');const back=button('برگشت به فرم',()=>d.close()),create=button('ساخت کار جداگانه',()=>{accepted=true;d.close();});create.dataset.action='create-anyway';actions.append(back,create);d.append(actions);
      d.addEventListener('close',()=>resolve(accepted),{once:true});d.showModal();back.focus();
    });
  }
  window.apiFetch=async function(path,options={}){
    const method=(options.method||'GET').toUpperCase();let body;try{body=JSON.parse(options.body||'null');}catch{}
    const createsTask=method==='POST'&&(path.split('?')[0]==='/api/tasks'||path.split('?')[0]==='/api/calendar'&&['task','homework'].includes(body?.kind)||/^\/api\/v11\.10\/(people\/[^/]+\/follow-up-task|commitments\/[^/]+\/create-task)$/.test(path.split('?')[0]));
    if(!createsTask||!body?.title)return request(path,options);
    const key=path+'\n'+body.title;if(pendingCreates.has(key))throw Error('بررسی کار قبلی هنوز تمام نشده است.');pendingCreates.add(key);
    const activeTitle=[...document.querySelectorAll('#genericTitleInput,#calendarInput-title,#qaTitle')].find(input=>taskInput(input)&&input.getClientRects().length&&input.value.trim()===body.title.trim());
    try{
      const {items}=await request('/api/tasks/suggestions?mode=check&q='+encodeURIComponent(body.title));
      if(items.length&&!await confirmDuplicate(items))throw Error('ثبت کار جدید لغو شد؛ می‌توانی از کار قبلی استفاده کنی.');
      if(activeTitle&&(!activeTitle.isConnected||!activeTitle.getClientRects().length||activeTitle.value.trim()!==body.title.trim()))throw Error('عنوان یا فرم تغییر کرده است؛ دوباره ذخیره را بزن.');
      return await request(path,options);
    }finally{pendingCreates.delete(key);}
  };
  document.addEventListener('focusin',event=>{if(event.target instanceof HTMLInputElement&&taskInput(event.target)&&!bindings.has(event.target))bind(event.target).schedule();});
  document.addEventListener('input',event=>{if(event.target instanceof HTMLInputElement&&taskInput(event.target)&&!bindings.has(event.target))bind(event.target).schedule();});
  document.addEventListener('pointerdown',event=>{for(const box of document.querySelectorAll('.task-suggestions:not([hidden])')){const input=document.querySelector('[aria-controls="'+box.id+'"]');if(!box.contains(event.target)&&input!==event.target)bindings.get(input)?.clear();}});
  window.addEventListener('nova:page-open',()=>{for(const input of document.querySelectorAll('input[aria-controls^="taskSuggestions-"]'))bindings.get(input)?.clear();});
  window.NoavaTaskSuggestions={openExisting};
})();
