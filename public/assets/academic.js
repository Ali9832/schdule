(() => {
  'use strict';
  const root = document.getElementById('academicBody');
  const names = { class:'کلاس',exam:'امتحان',quiz:'کوییز',homework:'تکلیف',project:'پروژهٔ درسی',study:'مطالعه' };
  const node = (tag,text,cls) => { const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n; };
  const button=(text,action)=>{const b=node('button',text);b.type='button';b.onclick=action;return b;};
  let courses=[],entries=[],course='',kind='',request=0,editing=null;
  const field=(form,name,title,type='text')=>{const label=node('label',title),input=node(type==='textarea'?'textarea':'input');if(type!=='textarea')input.type=type;input.name=name;label.append(input);form.append(label);return input;};
  function openNew(type){return UnifiedCalendar.openDay(DateContext.date,true,{kind:type,course_id:course,all_day:type!=='class',...(type==='class'?{recurrence:{frequency:'weekly',interval:1}}:{})});}
  async function load(){
    const generation=++request;root.setAttribute('aria-busy','true');
    try{const anchor=DateContext.date,from=DateContext.shift(anchor,-((new Date(anchor+'T12:00:00Z').getUTCDay()+1)%7)),to=DateContext.shift(from,180);
      const [subjects,calendar]=await Promise.all([apiFetch('/api/modules/academic/items'),apiFetch(`/api/calendar?from=${from}&to=${to}`)]);
      if(generation!==request)return;courses=subjects.items;entries=calendar.entries;render(from);}
    catch(error){if(generation===request)root.replaceChildren(node('p',error.message,'record-edit-error'),button('تلاش دوباره',load));}
    finally{if(generation===request)root.setAttribute('aria-busy','false');}
  }
  function render(from){
    root.replaceChildren();
    const header=node('header',null,'noava-section-heading');header.append(node('h1','حوزهٔ تحصیلی'),node('p','درس‌ها، برنامهٔ هفتگی و موعدهای درسی؛ متصل به کارها، پروژه‌ها و تقویم.'));root.append(header);
    const subjects=node('section',null,'noava-panel');subjects.append(node('h2','درس‌ها'));
    const chips=node('div',null,'noava-actions');chips.append(button('همهٔ درس‌ها',()=>{course='';render(from);}));
    for(const subject of courses){const b=button(subject.title,()=>{course=subject.id;render(from);});b.classList.toggle('active',course===subject.id);chips.append(b,button('✎ '+subject.title,()=>{editing=subject;render(from);}));}
    subjects.append(chips);
    const details=node('details');details.open=!!editing;details.append(node('summary',editing?'ویرایش درس':'＋ افزودن درس'));
    const form=node('form',null,'record-edit-form');const title=field(form,'title','نام درس'),note=field(form,'note','ترم، استاد، محل کلاس یا توضیحات','textarea');title.required=true;title.maxLength=120;note.maxLength=2000;title.value=editing?.title||'';note.value=editing?.note||'';
    const save=node('button',editing?'ذخیرهٔ تغییرات درس':'ثبت درس');save.type='submit';const error=node('p','','record-edit-error');error.setAttribute('role','alert');form.append(save,error);details.append(form);subjects.append(details);root.append(subjects);
    const draft=NoavaDrafts.bind(form,'academic-course:'+(editing?.id||'new'));
    form.onsubmit=async event=>{event.preventDefault();if(save.disabled||!form.reportValidity())return;save.disabled=true;try{await apiFetch('/api/modules/academic/items'+(editing?'/'+encodeURIComponent(editing.id):''),{method:editing?'PATCH':'POST',body:JSON.stringify({title:title.value.trim(),note:note.value})});draft.clear();editing=null;await load();}catch(failure){error.textContent=failure.message;}finally{save.disabled=false;}};
    const actions=node('div',null,'noava-actions');for(const [type,label]of Object.entries(names))actions.append(button('＋ '+label,()=>openNew(type)));root.append(actions);
    const filter=node('label','نوع برنامه '),select=node('select');select.add(new Option('همهٔ برنامه‌های تحصیلی',''));for(const [value,label]of Object.entries(names))select.add(new Option(label,value));select.value=kind;select.onchange=()=>{kind=select.value;render(from);};filter.append(select);root.append(filter);
    const academic=entries.filter(item=>(item.course_id||Object.hasOwn(names,item.kind))&&(!course||item.course_id===course)&&(!kind||item.kind===kind));
    const week=node('section',null,'noava-panel');week.append(node('h2','برنامهٔ این هفته'));const days=node('div',null,'academic-week');
    for(let offset=0;offset<7;offset++){const date=DateContext.shift(from,offset),column=node('section');column.append(button(faDateLabel(date),()=>UnifiedCalendar.openDay(date)));const rows=academic.filter(item=>item.date<=date&&item.end_date>=date).sort((a,b)=>Number(a.done)-Number(b.done)||a.start_time.localeCompare(b.start_time));for(const item of rows)column.append(itemRow(item));if(!rows.length)column.append(node('small','برنامه‌ای ثبت نشده'));days.append(column);}week.append(days);root.append(week);
    const upcoming=node('section',null,'noava-panel');upcoming.append(node('h2','موعدها و برنامه‌های پیش رو (شش ماه)'));const rows=academic.filter(item=>item.date>=DateContext.date&&item.kind!=='class').sort((a,b)=>Number(a.done)-Number(b.done)||a.date.localeCompare(b.date));for(const item of rows)upcoming.append(itemRow(item));if(!rows.length)upcoming.append(node('p','هنوز موعدی ثبت نشده است.'));root.append(upcoming);
  }
  function itemRow(item){
    const row=node('article',null,'academic-item'+(item.done?' is-done':''));const main=node('div');main.append(node('strong',item.title),node('small',`${names[item.kind]||'برنامه'} · ${courses.find(c=>c.id===item.course_id)?.title||'بدون درس'} · ${faDateLabel(item.date)} ${item.all_day?'':toFaNum(item.start_time)}`));row.append(main,button('جزئیات / ویرایش',()=>UnifiedCalendar.openDay(item.date)));if(item.project_id)row.append(button('پروژه',()=>openV11Inspector('project',item.project_id)));else if(item.source==='project')row.append(button('پروژه',()=>openV11Inspector('project',item.id)));return row;
  }
  const openPage=window.handleFunctionalPageOpen;window.handleFunctionalPageOpen=async function(page){await openPage?.(page);if(page==='academic'){document.getElementById('crumb').textContent='حوزهٔ تحصیلی';await load();}};
  let timer;window.addEventListener('nova:data-changed',event=>{if(!document.getElementById('academic').classList.contains('hidden')&&/\/api\/(calendar|modules\/academic|projects|tasks)/.test(event.detail?.path||'')){clearTimeout(timer);timer=setTimeout(load,400);}});
  window.addEventListener('nova:date-changed',()=>{if(!document.getElementById('academic').classList.contains('hidden'))load();});
  window.NoavaAcademic={load,openNew,get courses(){return courses;}};
})();
