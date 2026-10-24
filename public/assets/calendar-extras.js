(() => {
 const recurrenceNames={daily:'روزانه',weekly:'هفتگی',monthly:'ماهانهٔ شمسی',yearly:'سالانهٔ شمسی'}
 const urls=new Set()
 const release=()=>{for(const url of urls)URL.revokeObjectURL(url);urls.clear()}
 const node=(tag,text)=>{const element=document.createElement(tag);if(text!==undefined)element.textContent=text;return element}
 const button=(text,action)=>{const element=node('button',text);element.type='button';element.onclick=action;return element}
 const route=item=>`/api/calendar/${item.source}/${encodeURIComponent(item.id)}/attachments`
 function fields(form,grid,inputs,values,field){
  const section=node('section');section.className='uc-schedule-options';section.append(node('h4','تکرار و یادآوری'));
  const repeatGrid=node('div');repeatGrid.className='uc-form-grid';
  repeatGrid.append(field('repeat_frequency','این برنامه تکرار شود؟','select',values.recurrence?.frequency||'',[['','فقط همین یک بار'],['daily','هر روز'],['weekly','هر هفته'],['monthly','هر ماه شمسی'],['yearly','هر سال شمسی']]),field('reminder','یادآوری','select',String(values.reminders?.[0]??''),[['','بدون یادآوری'],['0','در زمان برنامه'],['5','۵ دقیقه قبل'],['15','۱۵ دقیقه قبل'],['30','۳۰ دقیقه قبل'],['60','یک ساعت قبل'],['1440','یک روز قبل'],['10080','یک هفته قبل']]));
  const repeatMore=node('div');repeatMore.className='uc-form-grid uc-repeat-options';
  const both=!!(values.recurrence?.until&&values.recurrence?.count);
  repeatMore.append(field('repeat_interval','فاصلهٔ تکرار','number',values.recurrence?.interval||1),field('repeat_end_mode','تکرار تا چه زمانی ادامه داشته باشد؟','select',both?'both':values.recurrence?.until?'until':values.recurrence?.count?'count':'never',[['never','بدون تاریخ پایان'],['until','تا یک تاریخ مشخص'],['count','به تعداد مشخص'],...(both?[['both','شرط‌های قبلی: تاریخ و تعداد']]:[])]),field('repeat_until','تا این تاریخ برگزار شود','date',values.recurrence?.until||''),field('repeat_count','چند بار در مجموع؟','number',values.recurrence?.count||''));
  inputs.repeat_interval.min=1;inputs.repeat_interval.max=365;inputs.repeat_count.min=1;inputs.repeat_count.max=1000;
  const summary=node('p');summary.className='uc-repeat-summary';summary.setAttribute('role','status');section.append(repeatGrid,repeatMore,summary);form.append(section);
  const advanced=node('details');advanced.className='uc-extra-settings';advanced.open=!!values.due_date;advanced.append(node('summary','مهلت تحویل جداگانه (در صورت نیاز)'));
  advanced.append(node('p','تاریخ برنامه همان روز انجام یا برگزاری است. فقط اگر تحویلِ کار زمان دیگری دارد، مهلت جداگانه تعیین کنید.'));
  const enabledLabel=node('label');enabledLabel.className='uc-check-label';const enabled=node('input');enabled.type='checkbox';enabled.name='has_deadline';enabled.checked=!!values.due_date;enabledLabel.append(enabled,document.createTextNode('این برنامه مهلت تحویل جداگانه دارد'));advanced.append(enabledLabel);
  const deadlineGrid=node('div');deadlineGrid.className='uc-form-grid';deadlineGrid.append(field('due_date','روز تحویل','date',values.due_date||''),field('due_time','تا ساعت','time',values.due_time||'23:59'));advanced.append(deadlineGrid);form.append(advanced);
  const units={daily:'روز',weekly:'هفته',monthly:'ماه',yearly:'سال'};
  const sync=()=>{
   const repeating=!!inputs.repeat_frequency.value,mode=inputs.repeat_end_mode.value;
   repeatMore.hidden=summary.hidden=!repeating;
   inputs.repeat_interval.closest('label').firstChild.textContent='هر چند '+(units[inputs.repeat_frequency.value]||'روز')+'؟';
   inputs.repeat_interval.disabled=inputs.repeat_end_mode.disabled=!repeating;inputs.repeat_interval.required=repeating;
   for(const [key,visible]of [['repeat_until',repeating&&['until','both'].includes(mode)],['repeat_count',repeating&&['count','both'].includes(mode)]]){const input=inputs[key];input.closest('label').hidden=!visible;input.disabled=!visible;input.required=visible;}
   deadlineGrid.hidden=!enabled.checked;inputs.due_date.disabled=inputs.due_time.disabled=!enabled.checked;inputs.due_date.required=enabled.checked;
   if(enabled.checked)advanced.open=true;
   inputs.reminder.options[1].textContent=enabled.checked?'در زمان تحویل':'در زمان برنامه';
   inputs.reminder.closest('label').firstChild.textContent=enabled.checked?'یادآوری پیش از مهلت تحویل':'یادآوری پیش از برنامه';
   inputs.repeat_until.setCustomValidity(repeating&&['until','both'].includes(mode)&&inputs.repeat_until.value&&inputs.date.value&&inputs.repeat_until.value<inputs.date.value?'آخرین نوبت نمی‌تواند قبل از تاریخ اولین برنامه باشد.':'');
   const start=inputs.date.value?faDateLabel(inputs.date.value):'روز انتخاب‌شده',interval=Number(inputs.repeat_interval.value)||1;
   summary.textContent=`از ${start}، هر ${toFaNum(interval)} ${units[inputs.repeat_frequency.value]||'روز'}`+(mode==='until'&&inputs.repeat_until.value?'، تا '+faDateLabel(inputs.repeat_until.value):mode==='count'&&inputs.repeat_count.value?'، در مجموع '+toFaNum(inputs.repeat_count.value)+' بار':mode==='both'?'؛ با شرط تاریخ و تعداد قبلی، هرکدام زودتر برسد.':'؛ بدون پایان مشخص.');
  };
  for(const input of [enabled,inputs.repeat_frequency,inputs.repeat_end_mode,inputs.repeat_interval,inputs.repeat_until,inputs.repeat_count,inputs.date]){input.addEventListener('change',sync);input.addEventListener('input',sync);}sync();
  const label=node('label','ضمیمهٔ عکس یا صوت'),files=node('input');files.type='file';files.multiple=true;files.name='attachments';files.accept='image/png,image/jpeg,image/gif,image/webp,audio/mpeg,audio/wav,audio/x-wav,audio/ogg,audio/webm,audio/mp4,audio/x-m4a';label.append(files)
  const message=node('p','هر فایل حداکثر ۲ مگابایت؛ حداکثر ۵ ضمیمه برای هر آیتم. عکس و صوت از حساب خودتان قابل دسترسی‌اند. فایل ذخیره‌نشده پس از رفرش باید دوباره انتخاب شود.');message.className='uc-form-hint';const selected=node('p');selected.setAttribute('role','status')
  let pending=values.files||[]
  files.onchange=()=>{pending=[...files.files];selected.textContent=pending.map(file=>file.name).join('، ');files.setCustomValidity(pending.length>5?'حداکثر ۵ فایل انتخاب کنید.':pending.some(file=>file.size>2097152)?'حداکثر حجم هر فایل ۲ مگابایت است.':'');files.reportValidity();form.dispatchEvent(new Event('input'))}
  if(pending.length)selected.textContent=pending.map(file=>file.name).join('، ')
  const attachmentsPanel=node('details');attachmentsPanel.className='uc-extra-settings';attachmentsPanel.append(node('summary','ضمیمهٔ عکس یا صوت (اختیاری)'),label,message,selected);form.append(attachmentsPanel)
  const hint=node('p','یادآوری هنگام بازبودن سایت فعال است. تکرار ماهانه و سالانه بر اساس تقویم شمسی محاسبه می‌شود.');hint.className='uc-form-hint';const notifications=node('details');notifications.className='uc-extra-settings';notifications.append(node('summary','تنظیم اعلان مرورگر'),hint,button('فعال‌کردن اعلان مرورگر',async()=>{hint.textContent='Notification' in window?(await Notification.requestPermission()==='granted'?'اعلان مرورگر فعال شد؛ برای دریافت یادآوری سایت باید باز باشد.':'اعلان مرورگر مجاز نشده است؛ یادآوری داخل سایت نمایش داده می‌شود.'):'این مرورگر اعلان را پشتیبانی نمی‌کند؛ یادآوری داخل سایت فعال است.'}));form.append(notifications);
  const value=()=>({due_date:enabled.checked?inputs.due_date.value||null:null,due_time:enabled.checked?inputs.due_time.value||'23:59':'23:59',recurrence:inputs.repeat_frequency.value?{frequency:inputs.repeat_frequency.value,interval:Number(inputs.repeat_interval.value)||1,until:['until','both'].includes(inputs.repeat_end_mode.value)?inputs.repeat_until.value||null:null,count:['count','both'].includes(inputs.repeat_end_mode.value)&&inputs.repeat_count.value?Number(inputs.repeat_count.value):null}:null,reminders:inputs.reminder.value===''?[]:[Number(inputs.reminder.value)],files:pending});value.sync=sync;return value
 }
 async function encode(files){
  if(files.length>5)throw Error('حداکثر ۵ ضمیمه انتخاب کنید.')
  return Promise.all(files.map(file=>new Promise((resolve,reject)=>{
   if(file.size>2097152||!file.size){reject(Error('حجم هر ضمیمه باید بین ۱ بایت و ۲ مگابایت باشد.'));return}
   const reader=new FileReader();reader.onerror=()=>reject(Error('خواندن ضمیمه انجام نشد.'));reader.onload=()=>resolve({name:file.name,type:file.type,data:String(reader.result).split(',')[1]});reader.readAsDataURL(file)
  })))
 }
 async function upload(item,files){
  for(const file of files)await apiFetch(route(item),{method:'POST',body:JSON.stringify(file)})
 }
 function attachments(item){
  const root=node('section');root.className='uc-attachments'
  const load=button('مشاهدهٔ ضمیمه‌ها',async()=>{
   load.disabled=true
   try{
    const result=await apiFetch(route(item));root.replaceChildren()
    if(!result.attachments.length)root.append(node('small','ضمیمه‌ای ثبت نشده است.'))
    for(const attachment of result.attachments){
     const row=node('div');row.className='uc-attachment';row.append(node('span',attachment.name))
     const preview=button('بازکردن',async()=>{
      preview.disabled=true
      try{
       const response=await fetch(`${route(item)}/${encodeURIComponent(attachment.id)}`);if(!response.ok)throw Error('دریافت ضمیمه انجام نشد.')
       const url=URL.createObjectURL(await response.blob());urls.add(url)
       const media=node(attachment.type.startsWith('image/')?'img':'audio');media.src=url;if(media.tagName==='IMG')media.alt=attachment.name;else{media.controls=true;media.preload='metadata'}
       const download=node('a','دانلود');download.href=url;download.download=attachment.name;row.append(media,download)
      }catch(error){row.append(node('small',error.message));preview.disabled=false}
     })
     let confirmed=false
     const remove=button('حذف ضمیمه',async()=>{if(!confirmed){confirmed=true;remove.textContent='تأیید حذف';return}try{await apiFetch(`${route(item)}/${encodeURIComponent(attachment.id)}`,{method:'DELETE'});row.remove()}catch(error){row.append(node('small',error.message))}})
     row.append(preview,remove);root.append(row)
    }
   }catch(error){load.disabled=false;root.append(node('small',error.message))}
  });root.append(load);return root
 }
 function summary(item){return [item.due_date?'موعد: '+faDateLabel(item.due_date)+' '+toFaNum(item.due_time):'',item.recurrence?'تکرار '+recurrenceNames[item.recurrence.frequency]+' · ویرایش روی کل مجموعه اعمال می‌شود':'',item.reminders?.length?'یادآوری فعال':'','اولویت '+({low:'کم',medium:'متوسط',high:'بالا'}[item.priority]||'متوسط')].filter(Boolean).join(' · ')}
 let reminders=[],running=false,timer
 const seen=new Set()
 function tick(){
  const now=Date.now()
  for(const reminder of reminders){
   if(Date.parse(reminder.at)>now||Date.parse(reminder.at)<now-3600000||seen.has(reminder.key))continue
   const storageKey='molibden.reminder:'+reminder.key
   try{if(sessionStorage.getItem(storageKey))continue;sessionStorage.setItem(storageKey,'1')}catch{}
   seen.add(reminder.key);showToast('یادآوری',reminder.title)
   if('Notification' in window&&Notification.permission==='granted'){
    const options={body:reminder.title,tag:reminder.key}
    if(navigator.serviceWorker?.controller)navigator.serviceWorker.ready.then(registration=>registration.showNotification('یادآوری NOAVA',options)).catch(()=>{})
    else try{new Notification('یادآوری NOAVA',options)}catch{}
   }
  }
 }
 async function refresh(){if(running||document.hidden)return;running=true;try{const result=await apiFetch('/api/calendar/reminders');reminders=result.reminders;tick()}catch(error){console.warn('Calendar reminders:',error.message)}finally{running=false}}
 window.addEventListener('nova:data-changed',event=>{if(!event.detail?.path?.startsWith('/api/calendar'))return;clearTimeout(timer);timer=setTimeout(refresh,1200)})
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()})
 setTimeout(refresh,15000);setInterval(refresh,60000);setInterval(tick,10000)
 window.CalendarExtras={fields,encode,upload,attachments,summary,release,refresh}
})();
