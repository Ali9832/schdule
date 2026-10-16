/* UI uses the Persian calendar. API/storage values remain ISO for compatibility. */
(() => {
  const digits=value=>String(value??'').replace(/[۰-۹]/g,x=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(x))).replace(/[٠-٩]/g,x=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(x)));
  const fa=value=>String(value).replace(/\d/g,x=>'۰۱۲۳۴۵۶۷۸۹'[x]);
  const formatter=new Intl.DateTimeFormat('en-US-u-ca-persian',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:'UTC'});
  const parts=date=>Object.fromEntries(formatter.formatToParts(date).filter(x=>['year','month','day'].includes(x.type)).map(x=>[x.type,Number(x.value)]));
  const iso=date=>date.toISOString().slice(0,10);
  function fromPersian(value){
    const match=digits(value).trim().match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/);if(!match)return null;
    const [year,month,day]=match.slice(1).map(Number);if(year<1200||year>1600||month<1||month>12||day<1||day>31)return null;
    const start=new Date(Date.UTC(year+621,2,1));start.setUTCDate(start.getUTCDate()+(month-1)*30);
    for(let offset=-10;offset<65;offset++){const date=new Date(start);date.setUTCDate(date.getUTCDate()+offset);const p=parts(date);if(p.year===year&&p.month===month&&p.day===day)return iso(date)}return null;
  }
  function toPersian(value){const date=new Date(String(value).slice(0,10)+'T12:00:00Z');if(Number.isNaN(+date))return '';const p=parts(date);return fa(`${p.year}/${String(p.month).padStart(2,'0')}/${String(p.day).padStart(2,'0')}`)}
  const timeValue=value=>{const m=digits(value).trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);return m&&+m[1]<24&&+m[2]<60?`${m[1].padStart(2,'0')}:${m[2]}`:null};
  const native=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value');
  function enhance(input){
    if(input.dataset.persianType||!['date','datetime-local','time'].includes(input.type))return;
    const kind=input.type,initial=input.value;input.dataset.persianType=kind;input.type='text';input.dir='rtl';input.lang='fa';input.autocomplete='off';
    input.removeAttribute('min');input.removeAttribute('max');input.removeAttribute('step');
    input.placeholder=kind==='time'?'ساعت:دقیقه (۲۴ ساعته)':kind==='date'?'۱۴۰۵/۰۱/۰۱':'۱۴۰۵/۰۱/۰۱  ۱۴:۳۰';
    input.setAttribute('aria-description',kind==='time'?'ساعت به صورت ۲۴ ساعته':'تاریخ شمسی، سال/ماه/روز'+(kind==='datetime-local'?' و ساعت ۲۴ ساعته':''));
    function parse(){const text=digits(native.get.call(input)).trim();if(!text)return '';if(kind==='time')return timeValue(text)||'';const m=text.match(/^(\d{4}[\/-]\d{1,2}[\/-]\d{1,2})(?:[ T]+(\d{1,2}:\d{2}))?$/);if(!m)return '';const date=fromPersian(m[1]);if(!date)return '';if(kind==='date')return date;const time=timeValue(m[2]||'');return time?date+'T'+time:''}
    Object.defineProperty(input,'value',{configurable:true,get:parse,set(value){const text=digits(value||'');let display='';if(text){if(kind==='time')display=fa(timeValue(text)||text);else if(/^\d{4}-\d{2}-\d{2}/.test(text)&&Number(text.slice(0,4))>1700)display=toPersian(text)+(kind==='datetime-local'?'  '+fa(text.slice(11,16)||'00:00'):'');else display=fa(text)}native.set.call(input,display);input.setCustomValidity('')}});
    input.value=initial;
    if(kind==='time'){input.inputMode='numeric';return}
    const wrapper=document.createElement('span');wrapper.className='persian-date-field';input.before(wrapper);wrapper.append(input);
    const button=document.createElement('button');button.type='button';button.className='persian-calendar-button';button.textContent='▦';button.setAttribute('aria-label','انتخاب تاریخ شمسی');button.onclick=()=>openCalendar(input);wrapper.append(button);
  }
  for(const eventName of ['input','change'])document.addEventListener(eventName,event=>{const input=event.target;if(!(input instanceof HTMLInputElement)||!input.dataset.persianType)return;const raw=native.get.call(input).trim();const valid=!raw||!!input.value;input.setCustomValidity(valid?'':'تاریخ شمسی یا ساعت ۲۴ ساعته معتبر وارد کنید.');if(!valid){event.stopImmediatePropagation();if(eventName==='change')input.reportValidity()}},true);
  let dialog;
  function openCalendar(input){
    if(dialog?.open)return;const current=input.value||new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    const initial=parts(new Date(current.slice(0,10)+'T12:00:00Z'));let year=initial.year,month=initial.month;const selected=current.slice(0,10),datetime=input.dataset.persianType==='datetime-local';
    dialog=document.createElement('dialog');dialog.className='persian-calendar';dialog.dir='rtl';dialog.setAttribute('aria-label','انتخاب تاریخ شمسی');
    const head=document.createElement('div');head.className='persian-calendar-head';const previous=document.createElement('button'),next=document.createElement('button'),title=document.createElement('strong');previous.type=next.type='button';previous.textContent='→';next.textContent='←';previous.setAttribute('aria-label','ماه قبل');next.setAttribute('aria-label','ماه بعد');head.append(previous,title,next);
    const grid=document.createElement('div');grid.className='persian-calendar-grid';
    const controls=document.createElement('div');controls.className='persian-calendar-actions';const cancel=document.createElement('button'),clear=document.createElement('button');cancel.type=clear.type='button';cancel.textContent='بستن';clear.textContent='پاک کردن';controls.append(clear,cancel);
    let hour,minute;if(datetime){const row=document.createElement('div');row.className='persian-calendar-time';const label=document.createElement('span');label.textContent='ساعت (۲۴ ساعته)';hour=document.createElement('select');minute=document.createElement('select');hour.setAttribute('aria-label','ساعت');minute.setAttribute('aria-label','دقیقه');for(let i=0;i<24;i++)hour.add(new Option(fa(String(i).padStart(2,'0')),String(i).padStart(2,'0')));for(let i=0;i<60;i++)minute.add(new Option(fa(String(i).padStart(2,'0')),String(i).padStart(2,'0')));hour.value=current.slice(11,13)||'09';minute.value=current.slice(14,16)||'00';row.append(label,hour,document.createTextNode(':'),minute);dialog.append(row)}
    dialog.prepend(head,grid);dialog.append(controls);document.body.append(dialog);
    const close=()=>{dialog.close();dialog.remove();input.focus()};cancel.onclick=close;dialog.addEventListener('cancel',event=>{event.preventDefault();close()});
    const choose=value=>{input.value=value+(value&&datetime?'T'+hour.value+':'+minute.value:'');input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));close()};clear.onclick=()=>choose('');
    function render(){title.textContent=new Intl.DateTimeFormat('fa-IR-u-ca-persian',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(fromPersian(`${year}/${month}/1`)+'T12:00:00Z'));grid.replaceChildren();for(const name of ['ش','ی','د','س','چ','پ','ج']){const label=document.createElement('span');label.textContent=name;grid.append(label)}const first=fromPersian(`${year}/${month}/1`),date=new Date(first+'T12:00:00Z');for(let i=0;i<(date.getUTCDay()+1)%7;i++)grid.append(document.createElement('span'));for(let day=1;day<=31;day++){const value=fromPersian(`${year}/${month}/${day}`);if(!value)break;const button=document.createElement('button');button.type='button';button.textContent=fa(day);button.setAttribute('aria-label',toPersian(value));if(value===selected)button.setAttribute('aria-current','date');button.onclick=()=>choose(value);grid.append(button)}}
    previous.onclick=()=>{if(--month<1){month=12;year--}render()};next.onclick=()=>{if(++month>12){month=1;year++}render()};render();dialog.showModal();grid.querySelector('[aria-current]')?.focus();
  }
  function formatText(text){return text.replace(/(?<![\d۰-۹])([\d۰-۹]{4}-[\d۰-۹]{2}-[\d۰-۹]{2})(?:T([\d۰-۹]{2}:[\d۰-۹]{2})(?::[\d۰-۹]{2}(?:\.[\d۰-۹]+)?)?(?:Z|[+-][\d۰-۹]{2}:[\d۰-۹]{2})?)?/g,(all,date,time)=>{if(+digits(date).slice(0,4)<1900||+digits(date).slice(0,4)>2099)return all;const formatted=toPersian(digits(date));return formatted?formatted+(time?' · '+fa(time):''):all}).replace(/\b(\d{1,2}):(\d{2})\s*(AM|PM)\b/gi,(_,h,m,p)=>fa(`${String((+h%12)+(p.toUpperCase()==='PM'?12:0)).padStart(2,'0')}:${m}`))}
  function scan(root){if(root.nodeType===3){if(root.parentElement?.closest('script,style,input,textarea,[contenteditable],code,pre'))return;const text=formatText(root.nodeValue);if(text!==root.nodeValue)root.nodeValue=text;return}if(root.nodeType!==1)return;if(root.matches('script,style,input,textarea,[contenteditable],code,pre')){if(root.matches('input'))enhance(root);return}root.querySelectorAll('input[type="date"],input[type="datetime-local"],input[type="time"]').forEach(enhance);const walk=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);const texts=[];while(walk.nextNode())texts.push(walk.currentNode);texts.forEach(scan)}
  scan(document.body);new MutationObserver(records=>{for(const record of records){if(record.type==='characterData')scan(record.target);else record.addedNodes.forEach(scan)}}).observe(document.body,{subtree:true,childList:true,characterData:true});
  document.addEventListener('reset',event=>setTimeout(()=>event.target.querySelectorAll('input[data-persian-type]').forEach(input=>{input.value=input.defaultValue}),0));
  function localParts(date){return parts(new Date(`${v115Iso(date)}T12:00:00Z`))}
  function monthStart(date){const p=localParts(date);return new Date(fromPersian(`${p.year}/${p.month}/1`)+'T12:00:00')}
  function shiftMonth(date,n){const p=localParts(date),index=p.year*12+p.month-1+n;return new Date(fromPersian(`${Math.floor(index/12)}/${index%12+1}/1`)+'T12:00:00')}
  window.PersianUI={toPersian,fromPersian,timeValue,formatText,enhance,scan,localParts,monthStart,shiftMonth};
  window.v115ScheduleTaskPrompt=async function(taskId,title){
    const entered=await AppDialogs.ask(`تاریخ شمسی زمان‌بندی برای «${title}» (سال/ماه/روز):`,toPersian(v115Iso(new Date())));if(!entered)return;
    const date=fromPersian(entered);if(!date)return showToast('تاریخ نامعتبر','تاریخ شمسی معتبر وارد کنید.');
    const clock=await AppDialogs.ask('ساعت شروع ۲۴ ساعته (مثلاً ۱۴:۳۰):','09:00');if(!clock)return;const start=timeValue(clock);if(!start)return showToast('ساعت نامعتبر','ساعت بین ۰۰:۰۰ تا ۲۳:۵۹ وارد کنید.');
    const duration=Number(digits(await AppDialogs.ask('مدت به دقیقه:','45')||''));if(!Number.isFinite(duration)||duration<5)return showToast('مدت نامعتبر','مدت باید حداقل ۵ دقیقه باشد.');
    const end=new Date(new Date(`${date}T${start}:00`).getTime()+duration*60000);
    try{await apiFetch(`/api/v11.5/schedule/task/${encodeURIComponent(taskId)}`,{method:'POST',body:JSON.stringify({start_at:`${date}T${start}:00`,end_at:`${v115Iso(end)}T${String(end.getHours()).padStart(2,'0')}:${String(end.getMinutes()).padStart(2,'0')}:00`})});showToast('کار زمان‌بندی شد',title);await loadV115Schedule(true)}catch(error){showToast('زمان‌بندی انجام نشد',error.message||'دوباره تلاش کنید.')}
  };
})();
