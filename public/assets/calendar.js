(() => {
  const kinds={task:['کار','#377b72'],meeting:['جلسه','#6678b8'],exam:['امتحان','#b95c69'],quiz:['کوییز','#ad637f'],class:['کلاس و درس','#6376c0'],homework:['تکلیف','#a77834'],study:['مطالعه','#537e9a'],project:['پروژه','#8769a9'],personal:['برنامهٔ شخصی','#448a76'],religious:['مناسبت مذهبی','#7b719b'],appointment:['قرار','#469197'],goal:['هدف','#ad7952'],focus:['تمرکز','#7b6cac'],review:['مرور','#7e8860']};
  const viewNames={day:'روز',week:'هفته',month:'ماه',quarter:'فصل',year:'سال'};
  const root=document.getElementById('unifiedCalendar');
  const store='molibden.calendar.preferences.v1';let prefs={view:'month',showDone:true,compact:false,weekend:true,hiddenKinds:[],colors:{}};
  try{const saved=JSON.parse(localStorage.getItem(store)||'{}');prefs={...prefs,...saved};if(!viewNames[prefs.view])prefs.view='month';if(!Array.isArray(prefs.hiddenKinds))prefs.hiddenKinds=[]}catch{}
  const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const date=iso=>new Date(iso+'T12:00:00Z'),iso=d=>d.toISOString().slice(0,10),add=(value,n)=>{const d=date(value);d.setUTCDate(d.getUTCDate()+n);return iso(d)};
  const jalali=value=>{const [year,month,day]=PersianUI.toPersian(value).replace(/[۰-۹]/g,x=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(x)).split('/').map(Number);return {year,month,day}};
  const first=(year,month)=>PersianUI.fromPersian(`${year}/${month}/1`);
  const nextMonth=(year,month,n=1)=>{const index=year*12+month-1+n;return first(Math.floor(index/12),index%12+1)};
  const monthName=value=>new Intl.DateTimeFormat('fa-IR-u-ca-persian',{year:'numeric',month:'long',timeZone:'UTC'}).format(date(value));
  const dayName=value=>new Intl.DateTimeFormat('fa-IR-u-ca-persian',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'UTC'}).format(date(value));
  const num=toFaNum;
  const state={anchor:window.DateContext?.date||today(),view:prefs.view,entries:[],from:'',to:'',request:0,busy:false,dialog:null,selected:null,editing:null,search:'',error:'',message:''};
  const el=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node};
  const button=(text,action,className='')=>{const b=el('button',className,text);b.type='button';b.onclick=action;return b};
  const color=item=>item.color||prefs.colors?.[item.kind]||kinds[item.kind]?.[1]||'#448a76';
  const visible=item=>(prefs.showDone||!item.done)&&!prefs.hiddenKinds.includes(item.kind)&&(!state.search||`${item.title} ${item.description}`.toLowerCase().includes(state.search.toLowerCase()));
  const dayItems=(value,all=false)=>state.entries.filter(item=>item.date<=value&&item.end_date>=value&&(all||visible(item))).sort((a,b)=>Number(a.done)-Number(b.done)||Number(b.all_day)-Number(a.all_day)||a.start_time.localeCompare(b.start_time));
  const savePrefs=()=>{prefs.view=state.view;try{localStorage.setItem(store,JSON.stringify(prefs))}catch{}};
  function range(){
    const p=jalali(state.anchor);let from,to;
    if(state.view==='day')from=to=state.anchor;
    else if(state.view==='week'){from=add(state.anchor,-((date(state.anchor).getUTCDay()+1)%7));to=add(from,6)}
    else{const month=state.view==='year'?1:state.view==='quarter'?Math.floor((p.month-1)/3)*3+1:p.month,months=state.view==='year'?12:state.view==='quarter'?3:1;from=first(p.year,month);to=add(nextMonth(p.year,month,months),-1)}
    return {from,to};
  }
  async function load(){
    const request=++state.request,{from,to}=range();root.setAttribute('aria-busy','true');state.error='';
    try{const result=await apiFetch(`/api/calendar?from=${add(from,-7)}&to=${add(to,7)}`);if(request!==state.request)return;state.entries=result.entries;state.from=result.from;state.to=result.to;render();if(state.dialog?.open)renderDay()}
    catch(error){if(request===state.request){state.error=error.message||'دریافت تقویم انجام نشد.';render()}}
    finally{if(request===state.request)root.setAttribute('aria-busy','false')}
  }
  function shift(n){const p=jalali(state.anchor);state.anchor=state.view==='day'?add(state.anchor,n):state.view==='week'?add(state.anchor,n*7):nextMonth(p.year,p.month,n*(state.view==='year'?12:state.view==='quarter'?3:1));window.DateContext?.set(state.anchor,'calendar');load()}
  function setView(view){state.view=view;savePrefs();load()}
  function dayButton(value,mini=false,muted=false){
    const items=dayItems(value),cell=button('',()=>openDay(value),`uc-day${mini?' mini':''}${muted?' outside':''}${value===today()?' is-today':''}`);
    cell.dataset.date=value;cell.setAttribute('aria-label',`${dayName(value)}، ${num(items.length)} آیتم`);if(value===today())cell.setAttribute('aria-current','date');if(prefs.weekend&&date(value).getUTCDay()===5)cell.classList.add('weekend');
    cell.append(el('span','uc-day-number',num(jalali(value).day)));
    if(mini){if(items.length)cell.append(el('span','uc-mini-count',num(items.length)))}
    else{items.slice(0,prefs.compact?2:3).forEach(item=>{const chip=el('span','uc-event'+(item.done?' done':''));chip.style.setProperty('--item-color',color(item));chip.append(el('span','',`${item.done?'✓ ':''}${item.all_day?'':num(item.start_time)+' '}${item.title}`));cell.append(chip)});if(items.length>(prefs.compact?2:3))cell.append(el('small','uc-more',`${num(items.length-(prefs.compact?2:3))} مورد دیگر`))}
    return cell;
  }
  function monthGrid(year,month,mini=false){
    const start=first(year,month),offset=(date(start).getUTCDay()+1)%7,grid=el('div','uc-month-grid'+(mini?' mini':''));
    for(const name of ['شنبه','یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه','جمعه'])grid.append(el('span','uc-weekday',mini?name.slice(0,1):name));
    const days=Math.ceil((offset+(jalali(add(nextMonth(year,month),-1)).day))/7)*7;
    for(let i=0;i<days;i++){const value=add(start,i-offset);grid.append(dayButton(value,mini,jalali(value).month!==month))}return grid;
  }
  function preferences(){
    const details=el('details','uc-preferences'),summary=el('summary','','شخصی‌سازی تقویم');details.append(summary);
    const options=el('div','uc-preference-options');for(const [key,label]of [['showDone','نمایش انجام‌شده‌ها'],['compact','نمایش فشرده'],['weekend','مشخص‌کردن جمعه‌ها']]){const wrap=el('label'),input=el('input');input.type='checkbox';input.checked=!!prefs[key];input.onchange=()=>{prefs[key]=input.checked;savePrefs();render()};wrap.append(input,document.createTextNode(label));options.append(wrap)}
    details.append(options);const filters=el('div','uc-kind-settings');for(const [kind,[name,defaultColor]]of Object.entries(kinds)){
      const wrap=el('div'),label=el('label'),check=el('input');check.type='checkbox';check.checked=!prefs.hiddenKinds.includes(kind);check.onchange=()=>{prefs.hiddenKinds=prefs.hiddenKinds.filter(x=>x!==kind);if(!check.checked)prefs.hiddenKinds.push(kind);savePrefs();render()};label.append(check,document.createTextNode(name));
      const picker=el('input');picker.type='color';picker.value=prefs.colors?.[kind]||defaultColor;picker.setAttribute('aria-label','رنگ '+name);picker.onchange=()=>{prefs.colors={...prefs.colors,[kind]:picker.value};savePrefs();render()};wrap.append(label,picker);filters.append(wrap)
    }details.append(filters,button('بازگردانی تنظیمات',()=>{prefs={view:'month',showDone:true,compact:false,weekend:true,hiddenKinds:[],colors:{}};state.view='month';savePrefs();load()},'uc-text-button'));return details;
  }
  function render(){
    window.CalendarExtras?.release();
    const focused=document.activeElement?.id,preferencesOpen=root.querySelector('.uc-preferences')?.open;root.replaceChildren();const header=el('header','uc-header'),intro=el('div');intro.append(el('span','uc-eyebrow','برنامه‌های من'),el('h1','','تقویم جامع'),el('p','','کارها، جلسات، درس‌ها و موعدها؛ همه در یک تقویم شمسی.'));header.append(intro,button('＋ برنامهٔ جدید',()=>openDay(state.anchor,true),'uc-primary'));root.append(header);
    const toolbar=el('div','uc-toolbar'),views=el('div','uc-views');views.setAttribute('aria-label','نمای تقویم');for(const [value,label]of Object.entries(viewNames)){const b=button(label,()=>setView(value),state.view===value?'active':'');b.setAttribute('aria-pressed',String(state.view===value));views.append(b)}
    const navigation=el('div','uc-navigation');const prev=button('→',()=>shift(-1)),next=button('←',()=>shift(1));prev.setAttribute('aria-label','بازهٔ قبل');next.setAttribute('aria-label','بازهٔ بعد');navigation.append(prev,button('امروز',()=>{state.anchor=today();load()}),next);toolbar.append(views,navigation);root.append(toolbar);
    const tools=el('div','uc-tools'),jumpLabel=el('label','','رفتن به تاریخ'),jump=el('input');jump.type='date';jump.id='ucJumpDate';jump.value=state.anchor;jump.onchange=()=>{if(jump.value){state.anchor=jump.value;load()}};jumpLabel.append(jump);const search=el('input');search.type='search';search.id='ucSearch';search.placeholder='جستجو در برنامه‌های این بازه…';search.setAttribute('aria-label','جستجو در برنامه‌ها');search.value=state.search;search.oninput=()=>{const start=search.selectionStart;state.search=search.value;render();const replacement=document.getElementById('ucSearch');replacement.focus();if(start!==null)replacement.setSelectionRange?.(start,start)};tools.append(jumpLabel,search);const settings=preferences();settings.open=!!preferencesOpen;root.append(tools,settings);
    if(state.error){const error=el('div','uc-error');error.setAttribute('role','alert');error.append(el('span','',state.error),button('تلاش دوباره',load));root.append(error)}
    const {from,to}=range(),p=jalali(state.anchor),title=el('div','uc-range-title');let label=state.view==='day'?dayName(state.anchor):state.view==='week'?`${faDateLabel(from)} تا ${faDateLabel(to)}`:state.view==='year'?`سال ${num(p.year)}`:state.view==='quarter'?`${['بهار','تابستان','پاییز','زمستان'][Math.floor((p.month-1)/3)]} ${num(p.year)}`:monthName(state.anchor);
    const count=state.entries.filter(item=>item.date<=to&&item.end_date>=from&&visible(item)).length;title.append(el('h2','',label),el('span','',`${num(count)} آیتم در این بازه`));root.append(title);
    const content=el('div','uc-content');if(state.view==='month')content.append(monthGrid(p.year,p.month));
    else if(state.view==='year'||state.view==='quarter'){
      const months=el('div','uc-multi-month'),begin=state.view==='year'?1:Math.floor((p.month-1)/3)*3+1;for(let month=begin;month<begin+(state.view==='year'?12:3);month++){const section=el('section','uc-mini-month');section.append(button(monthName(first(p.year,month)),()=>{state.anchor=first(p.year,month);setView('month')},'uc-month-title'),monthGrid(p.year,month,true));months.append(section)}content.append(months)
    }else if(state.view==='week'){
      const week=el('div','uc-week');for(let i=0;i<7;i++){const value=add(from,i),column=el('section','uc-week-column');column.append(button(dayName(value),()=>openDay(value),'uc-week-title'));const items=dayItems(value);items.forEach(item=>{const b=button('',()=>openDay(value),'uc-week-item'+(item.done?' done':''));b.style.setProperty('--item-color',color(item));b.append(el('small','',item.all_day?'تمام روز':num(item.start_time)+' تا '+num(item.end_time)),el('strong','',item.title));column.append(b)});if(!items.length)column.append(button('＋ ثبت برنامه',()=>openDay(value,true),'uc-empty-day'));week.append(column)}content.append(week)
    }else{
      const items=dayItems(state.anchor),list=el('div','uc-day-agenda');if(!items.length)list.append(el('p','uc-empty','برای این روز برنامه‌ای ثبت نشده است.'));for(const item of items)list.append(agendaItem(item,state.anchor,false));list.append(button('مدیریت برنامهٔ این روز',()=>openDay(state.anchor),'uc-primary'));content.append(list)
    }
    root.append(content,el('p','uc-help','روی هر روز بزنید تا همهٔ آیتم‌ها را ببینید، انجام‌شده کنید یا تغییر دهید.'));window.PersianUI?.scan(root);if(focused==='ucSearch')document.getElementById(focused)?.focus();
  }
  function conflicts(value){const timed=dayItems(value).filter(item=>!item.all_day&&!item.done);let count=0;for(let i=0;i<timed.length;i++)for(let j=i+1;j<timed.length;j++)if(`${timed[i].date}T${timed[i].start_time}`<`${timed[j].end_date}T${timed[j].end_time}`&&`${timed[j].date}T${timed[j].start_time}`<`${timed[i].end_date}T${timed[i].end_time}`)count++;return count}
  async function openDay(value,create=false,seed={}){
    state.initial=create?seed:{};
    state.referencesLoading=!(state.referencesAt&&Date.now()-state.referencesAt<60000);
    const references=!state.referencesLoading?Promise.resolve():Promise.all([apiFetch('/api/projects'),apiFetch('/api/modules/academic/items')]).then(([projects,courses])=>{state.projects=projects;state.courses=courses.items;state.referencesAt=Date.now();state.referencesError='';}).catch(error=>{state.projects||=[];state.courses||=[];state.referencesError=error.message||'دریافت درس‌ها انجام نشد.';}).finally(()=>{state.referencesLoading=false;});
    state.anchor=value;window.DateContext?.set(value,'calendar');
    if(state.dialog?.open){state.selected=value;state.editing=create?'new':null;state.draft=null;state.message='';renderDay();await Promise.all([ensureDay(value),references]);renderDay();return}
    state.dialog?.remove();
    AppOverlays.closeAll();const dialog=el('dialog','uc-day-dialog');dialog.id='calendarDayDialog';dialog.setAttribute('aria-label','برنامهٔ روز');state.dialog=dialog;state.selected=value;state.editing=create||window.NoavaDrafts?.read('calendar:new:'+value)?'new':null;state.draft=null;state.message='';document.body.append(dialog);dialog.addEventListener('close',()=>{if(state.dialog===dialog){state.dialog=null;state.selected=null;state.editing=null;state.draft=null}dialog.remove()});dialog.addEventListener('cancel',event=>{event.preventDefault();dialog.close()});let outside=false;const isOutside=e=>{const r=dialog.getBoundingClientRect();return e.target===dialog&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)};dialog.addEventListener('pointerdown',e=>{outside=isOutside(e)});dialog.addEventListener('click',e=>{if(outside&&isOutside(e))dialog.close();outside=false});renderDay();dialog.showModal();await Promise.all([ensureDay(value),references]);if(state.dialog===dialog&&dialog.open)renderDay();
  }
  async function ensureDay(value){if(value>=state.from&&value<=state.to)return;try{const result=await apiFetch(`/api/calendar?from=${value}&to=${value}`),map=new Map(state.entries.map(item=>[item.key,item]));result.entries.forEach(item=>map.set(item.key,item));state.entries=[...map.values()]}catch(error){state.message=error.message||'دریافت روز انجام نشد.'}}
  async function mutate(action,message){
    if(state.busy)return;state.busy=true;const owner=state.dialog;state.message='';renderDay();
    try{const result=await action();await load();if(owner===state.dialog&&owner?.open){await ensureDay(state.selected);state.editing=null;state.draft=null;state.message=result?.warning||message}}
    catch(error){if(owner===state.dialog)state.message='ذخیره انجام نشد: '+(error.message||'دوباره تلاش کنید.')}
    finally{state.busy=false;render();if(state.dialog?.open)renderDay()}
  }
  async function toggleItem(item,done){
    if(state.busy)return;state.busy=true;const old=item.done;item.done=done;render();if(state.dialog?.open)renderDay();
    try{await apiFetch(`/api/calendar/${item.source}/${encodeURIComponent(item.id)}`,{method:'PATCH',body:JSON.stringify({done,...(item.occurrence_date?{occurrence_date:item.occurrence_date}:{})})});window.NovaFastUI?.scheduleVisibleRefresh();}
    catch(error){item.done=old;state.message='ذخیره انجام نشد: '+error.message;}
    finally{state.busy=false;render();if(state.dialog?.open)renderDay();}
  }
  function agendaItem(item,value,editable=true){
    const row=el('article','uc-agenda-item'+(item.done?' done':''));row.dataset.key=item.key;row.style.setProperty('--item-color',color(item));
    const check=el('input');check.type='checkbox';check.checked=item.done;check.disabled=state.busy;check.setAttribute('aria-label','انجام‌شده: '+item.title);check.onchange=()=>toggleItem(item,check.checked);
    const main=el('div','uc-agenda-text');main.append(el('strong','',item.title),el('small','',`${kinds[item.kind]?.[0]||'برنامه'} · ${item.all_day?'تمام روز':num(item.start_time)+' تا '+num(item.end_time)}${item.end_date!==item.date?' · تا '+faDateLabel(item.end_date):''}`));if(item.description)main.append(el('p','',item.description));
    if(window.CalendarExtras)main.append(el('small','',CalendarExtras.summary(item)),CalendarExtras.attachments(item));
    const actions=el('div','uc-item-actions');const edit=button('✎',()=>{if(!editable){openDay(value).then(()=>{if(!state.dialog?.open)return;state.editing=item;state.draft=null;renderDay()});return}state.editing=item;state.draft=null;state.message='';renderDay()},'uc-edit');edit.setAttribute('aria-label','ویرایش '+item.title);edit.title='ویرایش و جابه‌جایی تاریخ';
    const remove=button('×',()=>{
      if(!editable){openDay(value).then(()=>{const target=state.dialog?.querySelector(`[data-key="${item.key}"] .uc-delete`);target?.click()});return}
      const confirmation=el('div','uc-delete-confirm');confirmation.append(el('p','',item.source==='event'?'این برنامه حذف شود؟':'این موعد از تقویم حذف شود؟ رکورد اصلی در بخش خودش باقی می‌ماند.'));
      if(item.occurrence_date){confirmation.querySelector('p').textContent='فقط این نوبت حذف شود یا کل مجموعه؟';confirmation.append(button('فقط این نوبت',()=>mutate(()=>apiFetch(`/api/calendar/${item.source}/${encodeURIComponent(item.id)}?occurrence_date=${item.occurrence_date}`,{method:'DELETE'}),'این نوبت حذف شد.')))}
      confirmation.append(button(item.recurrence?'حذف کل مجموعه':'حذف از تقویم',()=>mutate(()=>apiFetch(`/api/calendar/${item.source}/${encodeURIComponent(item.id)}`,{method:'DELETE'}),'آیتم از تقویم حذف شد.'),'uc-danger'),button('انصراف',()=>confirmation.remove()));row.querySelector('.uc-delete-confirm')?.remove();row.append(confirmation)
    },'uc-delete');remove.setAttribute('aria-label','حذف از تقویم: '+item.title);remove.title='حذف از تقویم';edit.disabled=remove.disabled=state.busy;actions.append(edit,remove);row.append(check,main,actions);return row;
  }
  function renderDay(){
    window.CalendarExtras?.release();
    const dialog=state.dialog;if(!dialog?.isConnected)return;const value=state.selected;dialog.replaceChildren();const head=el('header','uc-dialog-head'),caption=el('div');caption.append(el('span','uc-eyebrow','برنامهٔ روز'),el('h2','',dayName(value)));const close=button('×',()=>dialog.close(),'uc-close');close.setAttribute('aria-label','بستن برنامهٔ روز');head.append(caption,close);dialog.append(head);
    const nav=el('div','uc-dialog-nav');nav.append(button('→ روز قبل',()=>openDay(add(value,-1))),button('روز بعد ←',()=>openDay(add(value,1))),button('＋ آیتم جدید',()=>{state.editing='new';state.draft=null;state.message='';renderDay()},'uc-primary'));dialog.append(nav);
    if(state.message){const status=el('p','uc-status',state.message);status.setAttribute('role','status');dialog.append(status)}
    const overlap=conflicts(value);if(overlap)dialog.append(el('p','uc-conflict',`${num(overlap)} تداخل زمانی بین برنامه‌های انجام‌نشده وجود دارد.`));
    const list=el('div','uc-dialog-list'),items=dayItems(value,true);if(!items.length)list.append(el('p','uc-empty','برای این روز هنوز آیتمی ثبت نشده است.'));if(items.length!==dayItems(value).length)dialog.append(el('p','uc-form-hint','این پنجره همهٔ آیتم‌های روز را، مستقل از فیلترهای نمای تقویم، نشان می‌دهد.'));items.forEach(item=>list.append(agendaItem(item,value)));dialog.append(list);
    if(state.editing)dialog.append(editor(state.editing==='new'?null:state.editing));
    dialog.querySelectorAll('button,input,select,textarea').forEach(control=>{if(state.busy)control.disabled=true});close.disabled=false;window.PersianUI?.scan(dialog);if(state.editing&&!state.busy)dialog.querySelector('[name=title]')?.focus();
  }
  function editor(item){
    if(item?.recurrence)item={...item,date:item.series_date,end_date:item.series_end_date,due_date:item.series_due_date};
    const form=el('form','uc-editor');form.id='calendarItemForm';form.append(el('h3','',item?'ویرایش و جابه‌جایی آیتم':'برنامهٔ جدید'));const inputs={},values=state.draft||item||state.initial||{};
    function field(name,label,type,value,options=null){const wrap=el('label','',label),input=el(options?'select':type==='textarea'?'textarea':'input');if(options){options.forEach(([key,label])=>input.add(new Option(label,key)));if(value&&!options.some(([key])=>key===value))input.add(new Option('مورد انتخاب‌شده',value));}else if(type!=='textarea')input.type=type;input.name=name;input.id='calendarInput-'+name;input.value=value??'';if(['title','date','end_date','start_time','end_time'].includes(name))input.required=true;if(name==='title')input.maxLength=200;wrap.append(input);inputs[name]=input;return wrap}
    const grid=el('div','uc-form-grid');grid.append(field('title','عنوان','text',values.title||''),field('kind','نوع برنامه','select',values.kind||'task',Object.entries(kinds).filter(([key])=>item?.source!=='event'||!['task','homework','project','goal'].includes(key)).map(([key,[label]])=>[key,label])),field('date','تاریخ برنامه','date',values.date||state.selected),field('priority','اولویت','select',values.priority||'medium',[['low','کم'],['medium','متوسط'],['high','بالا']]));
    const allDay=el('label','uc-check-label'),check=el('input');check.type='checkbox';check.name='all_day';check.checked=values.all_day??true;allDay.append(check,document.createTextNode('بدون ساعت مشخص'));
    const multiLabel=el('label','uc-check-label'),multi=el('input');multi.type='checkbox';multi.name='multiple_days';multi.checked=!!(values.end_date&&values.end_date>(values.date||state.selected));multiLabel.append(multi,document.createTextNode('برنامه چندروزه است'));
    grid.append(allDay,multiLabel,field('start_time','از ساعت','time',values.start_time||'09:00'),field('end_time','تا ساعت','time',values.end_time||'10:00'),field('end_date','آخرین روز این برنامه','date',values.end_date||values.date||state.selected));
    form.append(el('p','uc-form-intro','روز انجام یا برگزاری را مشخص کنید. برای برنامهٔ تکرارشونده، این تاریخ اولین نوبت است.'),grid,field('description','توضیحات (اختیاری)','textarea',values.description||''));
    const extra=CalendarExtras.fields(form,grid,inputs,values,field);
    const links=el('details','uc-extra-settings');links.open=!!(values.course_id||values.project_id);links.append(el('summary','','درس یا پروژهٔ مرتبط (اختیاری)'));const linksGrid=el('div','uc-form-grid');linksGrid.append(field('course_id','درس مرتبط','select',values.course_id||'',[['','بدون درس'],...(state.courses||[]).map(c=>[c.id,c.title])]));
    if(!item||['task','event'].includes(item.source))linksGrid.append(field('project_id','پروژه مرتبط','select',values.project_id||'',[['','بدون پروژه'],...(state.projects||[]).map(p=>[p.id,p.name])]));links.append(linksGrid);form.append(links);
    inputs.course_id.disabled=!!state.referencesLoading;
    const courseStatus=el('p','uc-form-hint',state.referencesLoading?'در حال دریافت فهرست درس‌ها…':state.referencesError?'دریافت درس‌ها انجام نشد.':!state.courses?.length?'هنوز درسی ثبت نشده؛ می‌توانید همین‌جا درس را اضافه کنید.':'درس‌ها از فهرست «تحصیل و یادگیری» خوانده می‌شوند.');links.append(courseStatus);
    if(state.referencesError)links.append(button('دریافت دوبارهٔ درس‌ها',async()=>{try{const result=await apiFetch('/api/modules/academic/items');if(!form.isConnected)return;state.courses=result.items;const current=inputs.course_id.value;inputs.course_id.replaceChildren(new Option('بدون درس',''),...state.courses.map(c=>new Option(c.title,c.id)));inputs.course_id.value=current;state.referencesError='';courseStatus.textContent=state.courses.length?'درس‌ها دریافت شدند.':'هنوز درسی ثبت نشده است.';}catch(error){courseStatus.textContent='دریافت انجام نشد: '+error.message;}},'uc-secondary'));
    const addCourse=el('details','uc-extra-settings');addCourse.append(el('summary','','＋ افزودن درس به فهرست'));
    const courseLabel=el('label','','نام درس'),courseTitle=el('input');courseTitle.type='text';courseTitle.name='new_course_title';courseTitle.maxLength=120;courseTitle.disabled=!!state.referencesLoading;courseLabel.append(courseTitle);const courseError=el('p','uc-form-error');courseError.setAttribute('role','alert');
    const courseSave=button('ثبت و انتخاب درس',async()=>{
      const title=courseTitle.value.trim();if(!title){courseError.textContent='نام درس را وارد کنید.';return;}
      courseSave.disabled=true;courseError.textContent='';
      try{const created=await apiFetch('/api/modules/academic/items',{method:'POST',body:JSON.stringify({title})});if(!form.isConnected)return;state.courses=[...(state.courses||[]).filter(c=>c.id!==created.id),created];inputs.course_id.add(new Option(created.title,created.id));inputs.course_id.value=created.id;inputs.course_id.dispatchEvent(new Event('input',{bubbles:true}));addCourse.open=false;courseTitle.value='';courseStatus.textContent='درس ثبت و انتخاب شد.';state.referencesError='';}
      catch(error){courseError.textContent=error.message||'ثبت درس انجام نشد.';}finally{courseSave.disabled=false;}
    },'uc-primary');courseSave.disabled=!!state.referencesLoading;addCourse.append(courseLabel,courseError,courseSave);links.append(addCourse);
    if(item)form.append(CalendarExtras.attachments(item));
    const hint=el('p','uc-form-hint','با تغییر تاریخ، آیتم به روز انتخاب‌شده منتقل می‌شود.');if(item?.recurrence)hint.textContent='ویرایش این فرم روی کل مجموعهٔ تکرار اعمال می‌شود. برای انجام یا حذف فقط یک نوبت، از دکمه‌های همان نوبت استفاده کنید.';if(item?.source==='event'&&['meeting','religious'].includes(item.kind))hint.textContent+=' اطلاعات تخصصی این مورد در بخش خودش حفظ می‌شود.';form.append(hint);
    const draft=window.NoavaDrafts?.bind(form,'calendar:'+(item?item.source+':'+item.id:'new:'+state.selected));
    const error=el('p','uc-form-error');error.setAttribute('role','alert');const actions=el('div','uc-form-actions'),save=el('button','uc-primary',item?'ذخیره تغییرات':'ثبت برنامه');save.type='submit';actions.append(save,button('انصراف',()=>{draft?.clear();state.editing=null;state.draft=null;renderDay()}));form.append(error,actions);
    const sync=()=>{const timed=!check.checked;for(const key of ['start_time','end_time']){inputs[key].disabled=!timed;inputs[key].required=timed;inputs[key].closest('label').hidden=!timed;}const single=item?item.source!=='event':['task','homework','project','goal'].includes(inputs.kind.value);multiLabel.hidden=single;multi.disabled=single;const spanning=!single&&multi.checked;inputs.end_date.closest('label').hidden=!spanning;inputs.end_date.disabled=!spanning;inputs.end_date.required=spanning;if(!spanning)inputs.end_date.value=inputs.date.value;};check.onchange=multi.onchange=sync;inputs.kind.onchange=sync;let previousDate=inputs.date.value;inputs.date.onchange=()=>{if(inputs.date.value){const duration=(Date.parse(inputs.end_date.value)-Date.parse(previousDate))/86400000;if(multi.checked&&Number.isFinite(duration)&&duration>=0)inputs.end_date.value=add(inputs.date.value,duration);previousDate=inputs.date.value}sync()};sync();
    if(item&&['task','project','outcome'].includes(item.source))inputs.kind.disabled=true;
    extra.sync?.();
    if(inputs.course_id.value||inputs.project_id?.value||['exam','quiz','class','homework','study'].includes(inputs.kind.value))links.open=true;
    form.onsubmit=event=>{
      event.preventDefault();if(state.busy||!form.reportValidity())return;const dateValue=inputs.date.value,endDate=inputs.end_date.value||dateValue,start=inputs.start_time.value||'09:00',end=inputs.end_time.value||'10:00';
      if(endDate<dateValue||(!check.checked&&endDate===dateValue&&end<=start)){error.textContent='پایان باید بعد از شروع باشد.';return}
      const {files,...details}=extra();
      const body={...details,course_id:inputs.course_id.value,...(inputs.project_id?{project_id:inputs.project_id.value||null}:{}),title:inputs.title.value.trim(),kind:inputs.kind.value,date:dateValue,end_date:endDate,all_day:check.checked,start_time:start,end_time:end,priority:inputs.priority.value,description:inputs.description.value};
      if(!body.title){error.textContent='عنوان را وارد کنید.';return}state.draft=body;const moved=item&&body.date!==item.date;
      state.draft={...body,files};
      mutate(async()=>{
        const uploads=await CalendarExtras.encode(files);
        const result=await apiFetch(item?`/api/calendar/${item.source}/${encodeURIComponent(item.id)}`:'/api/calendar',{method:item?'PATCH':'POST',body:JSON.stringify(body)});
        draft?.clear();
        try{await CalendarExtras.upload(item||result,uploads)}catch(error){return {warning:'آیتم ذخیره شد، اما بارگذاری بعضی ضمیمه‌ها انجام نشد: '+error.message+' برای تلاش مجدد، ویرایش آیتم را باز کنید.'}}
      },moved?'آیتم به '+faDateLabel(body.date)+' منتقل شد.':item?'تغییرات ذخیره شد.':'برنامه ثبت شد.');
    };form.addEventListener('input',()=>{state.draft={...extra(),title:inputs.title.value,kind:inputs.kind.value,date:inputs.date.value,end_date:inputs.end_date.value,start_time:inputs.start_time.value,end_time:inputs.end_time.value,priority:inputs.priority.value,all_day:check.checked,description:inputs.description.value,course_id:inputs.course_id.value,project_id:inputs.project_id?.value||null}});return form;
  }
  const openPage=window.handleFunctionalPageOpen;window.handleFunctionalPageOpen=async function(page){await openPage?.(page);if(page==='calendar')await load()};
  let refreshTimer;window.addEventListener('nova:data-changed',event=>{if(/\/api\/(projects|modules\/academic)/.test(event.detail?.path||''))state.referencesAt=0;if(state.busy)return;clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>{if(!document.getElementById('calendar').classList.contains('hidden'))load()},120)});
  window.UnifiedCalendar={load,openDay,setView,shift,state,prefs,range,render};render();
  if(new URLSearchParams(location.search).get('page')==='calendar'){
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>goPage('calendar'),{once:true});else goPage('calendar');
  }
})();
