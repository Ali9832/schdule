(() => {
 const recurrenceNames={daily:'روزانه',weekly:'هفتگی',monthly:'ماهانهٔ شمسی',yearly:'سالانهٔ شمسی'}
 const urls=new Set()
 const release=()=>{for(const url of urls)URL.revokeObjectURL(url);urls.clear()}
 const node=(tag,text)=>{const element=document.createElement(tag);if(text!==undefined)element.textContent=text;return element}
 const button=(text,action)=>{const element=node('button',text);element.type='button';element.onclick=action;return element}
 const route=item=>`/api/calendar/${item.source}/${encodeURIComponent(item.id)}/attachments`
 function fields(form,grid,inputs,values,field){
  grid.append(field('due_date','موعد نهایی (اختیاری)','date',values.due_date||''),field('due_time','ساعت موعد','time',values.due_time||'23:59'),field('repeat_frequency','تکرار','select',values.recurrence?.frequency||'', [['','بدون تکرار'],...Object.entries(recurrenceNames)]),field('repeat_interval','هر چند روز / هفته / ماه / سال','number',values.recurrence?.interval||1),field('repeat_until','آخرین تاریخ تکرار (اختیاری)','date',values.recurrence?.until||''),field('repeat_count','تعداد کل نوبت‌ها (اختیاری)','number',values.recurrence?.count||''),field('reminder','یادآوری پیش از موعد یا شروع','select',String(values.reminders?.[0]??''),[['','بدون یادآوری'],['0','در زمان موعد / شروع'],['5','۵ دقیقه قبل'],['15','۱۵ دقیقه قبل'],['30','۳۰ دقیقه قبل'],['60','یک ساعت قبل'],['1440','یک روز قبل'],['10080','یک هفته قبل']]))
  inputs.repeat_interval.min=1;inputs.repeat_interval.max=365;inputs.repeat_count.min=1;inputs.repeat_count.max=1000
  const sync=()=>{for(const name of ['repeat_interval','repeat_until','repeat_count'])inputs[name].closest('label').hidden=!inputs.repeat_frequency.value;inputs.repeat_interval.required=!!inputs.repeat_frequency.value;inputs.due_time.closest('label').hidden=!inputs.due_date.value}
  inputs.repeat_frequency.addEventListener('change',sync);inputs.due_date.addEventListener('change',sync);sync()
  const label=node('label','ضمیمهٔ عکس یا صوت'),files=node('input');files.type='file';files.multiple=true;files.name='attachments';files.accept='image/png,image/jpeg,image/gif,image/webp,audio/mpeg,audio/wav,audio/x-wav,audio/ogg,audio/webm,audio/mp4,audio/x-m4a';label.append(files)
  const message=node('p','هر فایل حداکثر ۲ مگابایت؛ حداکثر ۵ ضمیمه برای هر آیتم. عکس و صوت از حساب خودتان قابل دسترسی‌اند. فایل ذخیره‌نشده پس از رفرش باید دوباره انتخاب شود.');message.className='uc-form-hint';const selected=node('p');selected.setAttribute('role','status')
  let pending=values.files||[]
  files.onchange=()=>{pending=[...files.files];selected.textContent=pending.map(file=>file.name).join('، ');files.setCustomValidity(pending.length>5?'حداکثر ۵ فایل انتخاب کنید.':pending.some(file=>file.size>2097152)?'حداکثر حجم هر فایل ۲ مگابایت است.':'');files.reportValidity();form.dispatchEvent(new Event('input'))}
  if(pending.length)selected.textContent=pending.map(file=>file.name).join('، ')
  form.append(label,message,selected)
  const hint=node('p','تکرارهای ماهانه و سالانه بر اساس تقویم شمسی‌اند؛ اگر روز در ماه مقصد وجود نداشته باشد، آخرین روز ماه انتخاب می‌شود. یادآوری فقط هنگام بازبودن سایت بررسی می‌شود.');hint.className='uc-form-hint';form.append(hint,button('فعال‌کردن اعلان مرورگر',async()=>{hint.textContent='Notification' in window?(await Notification.requestPermission()==='granted'?'اعلان مرورگر فعال شد؛ برای دریافت یادآوری سایت باید باز باشد.':'اعلان مرورگر مجاز نشده است؛ یادآوری داخل سایت نمایش داده می‌شود.'):'این مرورگر اعلان را پشتیبانی نمی‌کند؛ یادآوری داخل سایت فعال است.'}))
  const value=()=>({due_date:inputs.due_date.value||null,due_time:inputs.due_time.value||'23:59',recurrence:inputs.repeat_frequency.value?{frequency:inputs.repeat_frequency.value,interval:Number(inputs.repeat_interval.value)||1,until:inputs.repeat_until.value||null,count:inputs.repeat_count.value?Number(inputs.repeat_count.value):null}:null,reminders:inputs.reminder.value===''?[]:[Number(inputs.reminder.value)],files:pending});value.sync=sync;return value
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
