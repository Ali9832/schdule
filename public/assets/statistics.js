(() => {
  'use strict';
  const root=document.getElementById('statisticsBody'), types={tasks:'کارها',projects:'پروژه‌ها',routines:'روتین‌ها',reading:'کتاب‌خوانی',resources:'منابع یادگیری',goals:'هدف‌ها',meetings:'جلسات'};
  let report=null,generation=0,initialized=false,shown=80,timer,filterMode='all';
  const chosen=new Set(),selected=new Set();
  const n=(tag,text,cls)=>{const el=document.createElement(tag);if(text!=null)el.textContent=text;if(cls)el.className=cls;return el;};
  const num=v=>Number(v||0).toLocaleString('fa-IR',{maximumFractionDigits:1});
  const labelDate=d=>new Intl.DateTimeFormat('fa-IR',{timeZone:'Asia/Tehran',month:'short',day:'numeric'}).format(new Date(d+'T12:00:00Z'));
  const shift=(day,amount)=>new Date(Date.parse(day+'T12:00:00Z')+amount*86400000).toISOString().slice(0,10);
  const active=()=>!document.getElementById('statistics').classList.contains('hidden');
  const button=(text,action)=>{const b=n('button',text);b.type='button';b.onclick=action;return b;};
  let from,to,range,status,output,options,list,search,mode;
  function init(){
    if(initialized)return;initialized=true;
    const head=n('div',null,'stats-heading');head.append(n('h1','آمار و روند'),button('به‌روزرسانی',load));
    root.append(head,n('p','وضعیت کلی را ببین؛ یک یا چند بخش یا رکورد مشخص را انتخاب کن تا نمودارهای همان‌ها نمایش داده شوند.','stats-muted'));
    const filters=n('form',null,'stats-filters');filters.setAttribute('aria-label','فیلترهای آمار');
    const field=(text,type)=>{const wrap=n('label',text),input=n('input');input.type=type;wrap.append(input);filters.append(wrap);return input;};
    const wrap=n('label','بازهٔ بررسی');range=n('select');range.setAttribute('aria-label','بازهٔ بررسی');
    for(const [value,text]of [['7','۷ روز اخیر'],['30','۳۰ روز اخیر'],['90','۹۰ روز اخیر'],['custom','بازهٔ دلخواه']]){const o=n('option',text);o.value=value;range.append(o);}range.value='30';wrap.append(range);filters.append(wrap);
    from=field('از روز','date');to=field('تا روز','date');from.required=to.required=true;to.max=DateContext.today();to.value=DateContext.today();from.value=shift(to.value,-29);
    const submit=n('button','اعمال بازه');submit.type='submit';filters.append(submit);filters.onsubmit=e=>{e.preventDefault();load();};
    range.onchange=()=>{if(range.value!=='custom'){to.value=DateContext.today();from.value=shift(to.value,1-Number(range.value));load();}};
    from.onchange=to.onchange=()=>{range.value='custom';};root.append(filters);
    const fieldset=n('fieldset',null,'stats-types');fieldset.append(n('legend','بخش‌های نمودار'));
    for(const [key,title]of Object.entries(types)){
      const label=n('label'),input=n('input');input.type='checkbox';input.value=key;
      input.onchange=()=>{if(input.checked)chosen.add(key);else chosen.delete(key);for(const id of selected)if(!chosen.has(id.split(':')[0]))selected.delete(id);shown=80;renderList();load();};
      label.append(input,n('span',title),n('small','—'));label.dataset.type=key;fieldset.append(label);
    }
    root.append(fieldset);
    options=n('details',null,'stats-item-picker');options.append(n('summary','انتخاب موارد مشخص برای مقایسه'));
    const choice=n('label','محدودهٔ انتخاب');mode=n('select');mode.setAttribute('aria-label','محدودهٔ انتخاب');
    for(const [value,text]of [['all','همهٔ رکوردهای بخش‌های انتخابی'],['selected','فقط مواردی که انتخاب می‌کنم']]){const o=n('option',text);o.value=value;mode.append(o);}choice.append(mode);options.append(choice);
    mode.onchange=()=>{filterMode=mode.value;renderList();load();};search=n('input');search.type='search';search.placeholder='نام کار، پروژه، کتاب یا روتین…';search.setAttribute('aria-label','جستجوی مورد برای نمودار');search.oninput=()=>{shown=80;renderList();};
    options.append(search,button('پاک‌کردن انتخاب موارد',()=>{selected.clear();renderList();load();}));list=n('div',null,'stats-record-options');options.append(list);root.append(options);
    status=n('p',null,'stats-status');status.setAttribute('role','status');output=n('div',null,'stats-output');root.append(status,output);
  }
  function renderList(){
    if(!list)return;list.replaceChildren();
    search.disabled=filterMode!=='selected';
    if(filterMode!=='selected'){list.append(n('p','نمودارها همهٔ رکوردهای بخش‌های تیک‌خورده را پوشش می‌دهند.','stats-muted'));return;}
    if(!chosen.size){list.append(n('p','ابتدا دست‌کم یک بخش را انتخاب کن.'));return;}
    const q=search.value.trim().toLocaleLowerCase(),rows=(report?.catalog||[]).filter(r=>chosen.has(r.type)&&r.title.toLocaleLowerCase().includes(q));
    list.append(n('p',`${num(selected.size)} مورد انتخاب شده · ${num(rows.length)} نتیجه`));
    for(const row of rows.slice(0,shown)){
      const label=n('label'),check=n('input');check.type='checkbox';check.value=row.key;check.checked=selected.has(row.key);
      check.onchange=()=>{if(check.checked){if(selected.size>=100){check.checked=false;showToast('حداکثر ۱۰۰ مورد','برای تعداد بیشتر، همهٔ رکوردهای یک بخش را انتخاب کن.');return;}selected.add(row.key);}else selected.delete(row.key);clearTimeout(timer);timer=setTimeout(load,200);};
      label.append(check,n('span',row.title),n('small',types[row.type]));list.append(label);
    }
    if(!rows.length)list.append(n('p','موردی پیدا نشد.'));
    if(rows.length>shown)list.append(button('نمایش موارد بیشتر',()=>{shown+=80;renderList();}));
  }
  async function load(){
    init();const request=++generation;
    if(chosen.size&&filterMode==='selected'&&!selected.size){output.setAttribute('aria-busy','false');output.replaceChildren(n('p','یک یا چند رکورد را از «انتخاب موارد مشخص» تیک بزن.','stats-empty'));status.textContent='';return;}
    const keys=chosen.size?[...chosen]:Object.keys(types);
    const query=new URLSearchParams({from:from.value,to:to.value,types:keys.join(',')});if(chosen.size&&filterMode==='selected')query.set('ids',[...selected].join(','));
    status.textContent='در حال دریافت آمار…';output.setAttribute('aria-busy','true');output.replaceChildren();
    try{
      const result=await apiFetch('/api/statistics?'+query);
      if(request!==generation)return;report=result;
      for(const label of root.querySelectorAll('.stats-types label'))label.querySelector('small').textContent=num(report.catalog.filter(r=>r.type===label.dataset.type).length);
      status.textContent=`${faDateLabel(report.from)} تا ${faDateLabel(report.to)} · ${num(report.days)} روز`;
      renderList();render();
    }catch(e){if(request===generation){status.textContent='دریافت آمار انجام نشد.';output.replaceChildren(n('p',e.message,'stats-error'),button('تلاش دوباره',load));}}
    finally{if(request===generation)output.setAttribute('aria-busy','false');}
  }
  function metric(container,title,value,hint){const card=n('article',null,'stats-metric');card.append(n('span',title),n('strong',value));if(hint)card.append(n('small',hint));container.append(card);}
  function buckets(rows){const size=Math.max(1,Math.ceil(rows.length/30)),result=[];for(let i=0;i<rows.length;i+=size){const batch=rows.slice(i,i+size),sum={date:batch[0].date,end:batch.at(-1).date};for(const key of ['created','completed','routine_checks','reading_minutes','meeting_count'])sum[key]=batch.reduce((v,r)=>v+Number(r[key]||0),0);result.push(sum);}return result;}
  const svgNode=(tag,attrs={},text)=>{const el=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [key,value]of Object.entries(attrs))el.setAttribute(key,value);if(text!=null)el.textContent=text;return el;};
  function chart(title,rows,series,unit,hint){
    const card=n('section',null,'stats-chart');card.append(n('h2',title));if(hint)card.append(n('p',hint,'stats-muted'));
    if(!rows.length){card.append(n('p','داده‌ای برای این انتخاب وجود ندارد.','stats-empty'));return card;}
    const legend=n('div',null,'stats-legend');for(const s of series){const label=n('span',s.title);label.style.setProperty('--series-color',s.color);legend.append(label);}card.append(legend);
    const svg=svgNode('svg',{viewBox:'0 0 760 280',role:'img','aria-label':title+'؛ واحد '+unit});svg.append(svgNode('title',{},title+'؛ جدول اعداد زیر نمودار در دسترس است.'));
    const max=Math.max(1,...rows.flatMap(r=>series.map(s=>Number(r[s.key]||0)))),ceil=max>5?Math.ceil(max/5)*5:max,x=i=>55+(rows.length===1?325:i/(rows.length-1)*650),y=value=>225-value/ceil*180;
    for(let i=0;i<=4;i++){const value=ceil*i/4,yy=y(value);svg.append(svgNode('line',{x1:55,y1:yy,x2:720,y2:yy,class:'stats-gridline'}),svgNode('text',{x:45,y:yy+4,'text-anchor':'end',class:'stats-axis'},num(value)));}
    for(const s of series){
      svg.append(svgNode('path',{d:rows.map((r,i)=>(i?'L':'M')+x(i)+','+y(r[s.key]||0)).join(' '),fill:'none',stroke:s.color,'stroke-width':3}));
      rows.forEach((r,i)=>{const point=svgNode('circle',{cx:x(i),cy:y(r[s.key]||0),r:4,fill:s.color});point.append(svgNode('title',{},`${labelDate(r.date)}${r.end&&r.end!==r.date?' تا '+labelDate(r.end):''} · ${s.title}: ${num(r[s.key])} ${unit}`));svg.append(point);});
    }
    rows.forEach((r,i)=>{if(i%Math.max(1,Math.ceil(rows.length/5))===0||i===rows.length-1)svg.append(svgNode('text',{x:x(i),y:252,'text-anchor':'middle',class:'stats-axis'},labelDate(r.date)));});card.append(svg);
    if(!rows.some(r=>series.some(s=>r[s.key]>0)))card.append(n('p','در این بازه برای این نمودار مقداری ثبت نشده است.','stats-muted'));
    const details=n('details');details.append(n('summary','دیدن جدول اعداد'));const table=n('table'),thead=n('thead'),tr=n('tr');tr.append(n('th','روز / بازه'));for(const s of series)tr.append(n('th',s.title+' ('+unit+')'));thead.append(tr);table.append(thead);const body=n('tbody');for(const row of rows){const tr=n('tr');tr.append(n('th',labelDate(row.date)+(row.end&&row.end!==row.date?' تا '+labelDate(row.end):'')));for(const s of series)tr.append(n('td',num(row[s.key])));body.append(tr);}table.append(body);details.append(table);card.append(details);return card;
  }
  function bars(title,rows,hint){
    const card=n('section',null,'stats-chart');card.append(n('h2',title));if(hint)card.append(n('p',hint,'stats-muted'));
    const max=Math.max(1,...rows.map(r=>r.value));for(const row of rows){const item=n('div',null,'stats-bar-row');const label=n('div',null,'stats-bar-label');label.append(n('span',row.title),n('strong',num(row.value)+(row.unit?' '+row.unit:'')));const track=n('div',null,'stats-bar-track'),fill=n('i');fill.style.width=row.value/max*100+'%';fill.style.background=row.color||'#148c80';track.append(fill);item.append(label,track);card.append(item);}if(!rows.length)card.append(n('p','موردی انتخاب نشده است.'));return card;
  }
  function render(){
    const s=report.summary;output.replaceChildren();const metrics=n('div',null,'stats-metrics');output.append(metrics);
    metric(metrics,chosen.size?'رکوردهای انتخابی موجود':'رکوردهای موجود در ۷ بخش',num(s.total),'بانک پایه در این عدد نیست');metric(metrics,'ایجادشده در بازه',num(s.created),'از میان رکوردهای موجود');
    if(!chosen.size){output.append(n('p','برای نمایش نمودار، بخش موردنظر را در بالا انتخاب کن. می‌توانی چند بخش یا چند رکورد مشخص را با هم بررسی کنی.','stats-empty'));return;}
    const timed=chosen.has('tasks')||chosen.has('projects');
    if(timed){metric(metrics,'تکمیل با تاریخ پایان معتبر',num(s.completed),'کارها و پروژه‌ها در بازه');metric(metrics,'عقب‌افتادهٔ فعلی',num(s.overdue),'موعد گذشته و هنوز باز');metric(metrics,'سرعت تکمیل در هفته',num(s.completed_per_week),`بازهٔ قبلی: ${num(s.previous_per_week)} در هفته`);}
    if(chosen.has('routines'))metric(metrics,'ثبت انجام روتین',num(s.routine_checks),'در بازهٔ انتخابی');if(chosen.has('reading'))metric(metrics,'زمان مطالعه',num(s.reading_minutes)+' دقیقه','فقط جلسه‌های ذخیره‌شده');
    if(s.unknown_completed||s.unknown_created)output.append(n('p',`${num(s.unknown_completed)} پایان بدون تاریخ دقیق و ${num(s.unknown_created)} رکورد بدون تاریخ ایجاد معتبر داریم؛ در روند مربوط محاسبه نمی‌شوند.`,'stats-notice'));
    const grid=n('div',null,'stats-chart-grid');output.append(grid);const daily=buckets(report.daily);
    const trend=[{key:'created',title:'ایجادشده در بخش‌های انتخابی',color:'#4885d3'}];if(timed)trend.push({key:'completed',title:'تکمیل کار و پروژه با تاریخ معتبر',color:'#148c80'});
    grid.append(chart('روند ایجاد و تکمیل',daily,trend,'رکورد','هر نقطه جمع روزهای نوشته‌شده است؛ ایجاد و تکمیل ممکن است مربوط به رکوردهای متفاوت باشند.'));
    grid.append(bars('تعداد رکوردها به تفکیک بخش',report.by_type.map(r=>({title:r.title,value:r.total})), 'تعداد فعلی برای همین انتخاب؛ تعداد ایجادشدهٔ بازه جداگانه در بالا آمده است.'));
    if(timed){
      const states={done:'انجام‌شده',overdue:'عقب‌افتاده',open:'باز / در جریان',paused:'متوقف / بایگانی‌شده'};grid.append(bars('وضعیت فعلی کارها و پروژه‌ها',Object.entries(states).map(([key,title])=>({title,value:report.states[key],color:key==='overdue'?'#c6616b':'#148c80'}))));
      const scheduleLabels={on_time:'پایان به‌موقع',late:'پایان با تأخیر',overdue:'موعد گذشته و باز',upcoming:'موعد امروز یا بعد',paused:'متوقف / بایگانی‌شده',unknown:'انجام‌شده با زمان پایان نامشخص'};
      grid.append(bars('عملکرد نسبت به موعد',Object.entries(scheduleLabels).map(([key,title])=>({title,value:report.schedule[key],color:['late','overdue'].includes(key)?'#c6616b':'#4885d3'})),'فقط کارها و پروژه‌هایی که موعدشان در بازه است. برای پایان‌های جدید، موعدِ لحظهٔ پایان حفظ می‌شود.'));
      const delta=s.completed-s.previous_completed;output.append(n('p',`تکمیل در این بازه: ${num(s.completed)}؛ بازهٔ قبلی با همین طول: ${num(s.previous_completed)}. ${delta>0?'افزایش '+num(delta):delta<0?'کاهش '+num(-delta):'بدون تغییر'} رکورد دارای زمان پایان معتبر.`,'stats-comparison'));
    }
    if(chosen.has('routines')){grid.append(chart('روند انجام روتین‌ها',daily,[{key:'routine_checks',title:'دفعات ثبت انجام',color:'#9870b7'}],'بار','ثبت‌های واقعی؛ نداشتن ثبت در یک روز لزوماً نقض هدف هفتگی نیست.'));grid.append(bars('انجام هر روتین در بازه',report.routines.map(r=>({title:r.title+` · هدف فعلی ${num(r.target_weekly)} بار در هفته`,value:r.checks,unit:'بار',color:'#9870b7'})),'هدف فعلی، سابقهٔ هدف در روزهای گذشته محسوب نمی‌شود.'));}
    if(chosen.has('reading')){grid.append(chart('روند زمان مطالعه',daily,[{key:'reading_minutes',title:'مطالعهٔ ثبت‌شده',color:'#d18b35'}],'دقیقه'));grid.append(bars('زمان مطالعهٔ هر کتاب',report.reading.map(r=>({title:r.title+` · هدف فعلی روزانه ${num(r.daily_minutes)} دقیقه`,value:r.minutes,unit:'دقیقه',color:'#d18b35'})),'زمان فعالِ ذخیره‌نشدهٔ زمان‌سنج در این جمع نیست.'));}
    if(chosen.has('meetings'))grid.append(chart('جلسات زمان‌بندی‌شده',daily,[{key:'meeting_count',title:'جلسه در این روز / بازه',color:'#6a83ab'}],'جلسه','وجود جلسه در تقویم، تأیید برگزارشدن آن نیست.'));
    const notes=n('details',null,'stats-notes');notes.append(n('summary','معنای آمار و محدودیت تاریخچه'));for(const note of report.notes)notes.append(n('p',note));output.append(notes);
  }
  const open=window.handleFunctionalPageOpen;window.handleFunctionalPageOpen=async function(page){await open?.(page);if(page==='statistics')await load();};
  window.addEventListener('nova:data-changed',()=>{if(active()){clearTimeout(timer);timer=setTimeout(load,350);}});
  window.addEventListener('focus',()=>{if(active())load();});
})();
