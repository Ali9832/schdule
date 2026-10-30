(() => {
let DATA;
const EDIT_KEY="nova-master-items-edits-v1";
let localEdits={};
let lastDeletedId=null;
let linkedTasks=[];
let originalTitles=new Map();
let originalItems=new Map();
let bankReady=false;
let bankPromise=null;
const PAGE_SIZE=50;
const filteredCategories=new Map(),visibleLimits=new Map();
let bankIndex=new Map(),bankTitles=new Map(),taskTitles=new Map(),taskLinks=new Map();
const pendingStatus=new Set();
const normalizeSearch=s=>String(s).toLowerCase().replace(/ي/g,"ی").replace(/ك/g,"ک").replace(/[\u200c\u200d]/g," ").replace(/\s+/g," ");
function saveItem(id,patch){
 const item=DATA.items.find(x=>x.id===id);if(!item)return;
 Object.assign(item,patch);localEdits[id]={...(localEdits[id]||{}),...patch};
 if(bankReady){updateRowState(item);if(Object.hasOwn(patch,'status'))reorderCategory(item.h);renderDashboard();}
 try{localStorage.setItem(EDIT_KEY,JSON.stringify(localEdits));byId("saveMessage").textContent="تغییرات در همین مرورگر ذخیره شد.";byId("saveMessage").classList.remove("error");}
 catch{byId("saveMessage").textContent="ذخیره در مرورگر ممکن نیست؛ پیش از بستن صفحه خروجی تغییرات را دانلود کنید.";byId("saveMessage").classList.add("error");}
}
function findLinkedItem(task){
 if(!DATA || !task)return null;
 const explicit=task.master_item_id||(task.tags||[]).find(tag=>tag.startsWith('master:'))?.slice(7);
 const identified=bankIndex.get(explicit)||bankIndex.get(task.id)||bankIndex.get(taskLinks.get(task.id));
 if(identified)return identified;
 const title=normalizeSearch(task.title||'').trim();if(!title)return null;
 const matches=bankTitles.get(title);
 return matches?.size===1 && taskTitles.get(title)===1?bankIndex.get([...matches][0]):null;
}
function synchronizeTasks(tasks){
 if(!Array.isArray(tasks)||!DATA)return;
 linkedTasks=tasks;
 bankIndex=new Map(DATA.items.map(item=>[item.id,item]));bankTitles=new Map();taskTitles=new Map();taskLinks=new Map();
 for(const item of DATA.items){
  for(const title of new Set([normalizeSearch(item.text).trim(),originalTitles.get(item.id)])){
   if(!title)continue;if(!bankTitles.has(title))bankTitles.set(title,new Set());bankTitles.get(title).add(item.id);
  }
  if(localEdits[item.id]?.taskId)taskLinks.set(localEdits[item.id].taskId,item.id);
 }
 for(const task of tasks){const title=normalizeSearch(task.title||'').trim();taskTitles.set(title,(taskTitles.get(title)||0)+1);}
 for(const task of tasks){
  const item=findLinkedItem(task);if(!item || pendingStatus.has(item.id))continue;
  const patch={taskId:task.id,status:task.status==='done'?'☑':'☐'};
  taskLinks.set(task.id,item.id);
  if(typeof task.title==='string')patch.text=task.title;
  if(item.status!==patch.status || item.text!==patch.text || localEdits[item.id]?.taskId!==task.id)saveItem(item.id,patch);
 }
}
function compareBankItems(a,b){
 return Number(a.status==='☑')-Number(b.status==='☑') || String(a.subcategory||'').localeCompare(b.subcategory||'','fa') || Number(a.excelRow)-Number(b.excelRow);
}
function reorderCategory(h){
 const body=byId('tbody-'+h);if(!body)return;
 const rows=new Map([...body.querySelectorAll('tr[data-id]')].map(row=>[row.dataset.id,row]));
 DATA.items.filter(item=>item.h===h&&!item.deleted).sort(compareBankItems).forEach(item=>{const row=rows.get(item.id);if(row)body.appendChild(row);});
}
function updateRowState(item){
 const row=document.querySelector(`#bank-tbody-${item.h} tr[data-id="${item.id}"]`);
 if(!row)return;row.classList.toggle('item-completed',item.status==='☑');
 const checkbox=row.querySelector('[data-item]');if(checkbox)checkbox.checked=item.status==='☑';
 const title=row.querySelector('.item-title');if(title)title.textContent=item.text;
 row.dataset.search=textBlob(item);
}
async function setStatus(id,done){
 const item=DATA?.items.find(item=>item.id===id);if(!item)return;if(pendingStatus.has(id)){updateRowState(item);return;}
 const old=item.status;pendingStatus.add(id);saveItem(id,{status:done?'☑':'☐'});
 try{
  const taskId=localEdits[id]?.taskId;
  if(taskId){
   await window.apiFetch(`/api/tasks/${encodeURIComponent(taskId)}`,{method:'PATCH',body:JSON.stringify({status:done?'done':'todo'})});
   await window.refreshAll();
  }
 }catch(error){saveItem(id,{status:old});byId('saveMessage').textContent='ثبت وضعیت انجام نشد: '+error.message;byId('saveMessage').classList.add('error');}
 finally{pendingStatus.delete(id);renderDashboard();}
}
function renderDashboard(){
 if(!DATA)return;
 const active=DATA.items.filter(item=>!item.deleted),done=active.filter(item=>item.status==='☑').length;
 const stats=document.querySelectorAll('#items .kpis .kpi b');if(stats[1])stats[1].textContent=faDigits(DATA.categories.length);if(stats[2])stats[2].textContent=faDigits(Object.keys(DATA.macroTitles).length);
 if(stats[3])stats[3].textContent=faDigits(done);
 const overview=document.getElementById('bank-comparison-summary');if(overview&&DATA.comparisonSummary){const s=DATA.comparisonSummary;overview.textContent=`ساختار تلفیقی: ${faDigits(s.categories)} دسته در ${faDigits(s.macros)} حوزه • ${faDigits(s.workbookCorrections)} اصلاح نسبت به اکسل • ${faDigits(active.filter(i=>i.classification?.needsReview).length)} مورد نیازمند بازبینی`}
 const card=document.querySelector('.mod-master');if(!card)return;
 const primary=card.querySelector('.module-percent');if(primary)primary.textContent=faDigits(active.length);
 const meta=card.querySelector('.module-meta');if(meta)meta.textContent=`${faDigits(done)} انجام‌شده • ${faDigits(active.length-done)} باز • ${faDigits(DATA.categories.length)} دسته`;
 const list=card.querySelector('.module-scroll');
 if(list){
  const linked=active.filter(item=>localEdits[item.id]?.taskId);
  const rows=[...linked,...active.filter(item=>!localEdits[item.id]?.taskId)].slice(0,8);
  list.innerHTML=rows.map(item=>`<div class="module-list-item ${item.status==='☑'?'bank-completed':''}" data-master-id="${esc(item.id)}"><input type="checkbox" data-master-check="${esc(item.id)}" aria-label="وضعیت ${esc(item.id)}" ${item.status==='☑'?'checked':''}><span class="item-name">${esc(item.text)}</span><span class="mini-state ${item.status==='☑'?'mini-green':'mini-yellow'}">${item.status==='☑'?'انجام':'باز'}</span></div>`).join('');
 }
 const footer=card.querySelector('.module-footer small');if(footer)footer.textContent='وضعیت مشترک با بانک آیتم‌ها';
 const total=document.querySelector('#items .kpis .kpi b');if(total)total.textContent=faDigits(active.length);
}
function exportEdits(){
 if(!bankReady){ensureLoaded().then(()=>{if(bankReady)exportEdits()});return;}
 const blob=new Blob([JSON.stringify({version:1,items:localEdits},null,2)],{type:"application/json"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="NOVA_Master_Item_Edits.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function applySavedEdits(){
 DATA.items.forEach(item=>{
  const original=originalItems.get(item.id);if(original)Object.assign(item,structuredClone(original));
  const edit=localEdits[item.id];if(!edit || typeof edit!=="object")return;
  if(["☐","☑"].includes(edit.status))item.status=edit.status;
  for(const field of ["note","text"])if(typeof edit[field]==="string")item[field]=edit[field];
  const legacyH=DATA.legacyCategoryMap?.[edit.h];
  const targetH=legacyH?(item.classification?.previous?.h===edit.h?item.h:legacyH):edit.h;
  const category=DATA.categories.find(c=>c.h===targetH);
  if(category){item.h=category.h;item.category=category.title;item.macro=category.macro;if(typeof edit.subcategory==='string'&&edit.subcategory.trim())item.subcategory=edit.subcategory;else item.subcategory='سایر موضوعات '+category.title;}
  if(edit.categoryReviewed===true)item.classification={...item.classification,needsReview:false,reason:'دسته‌بندی انتخاب‌شده توسط کاربر'};
  item.deleted=edit.deleted===true;
 });
}
function refreshCounts(){
 const active=DATA.items.filter(item=>!item.deleted);
 DATA.categories.forEach(c=>c.count=active.filter(i=>i.h===c.h).length);
 DATA.macroCounts=Object.fromEntries(Object.keys(DATA.macroTitles).map(code=>[code,active.filter(item=>macroCode(item.macro)===code).length]));
 refreshTopicOptions();
 applyFilters();
}
function refreshTopicOptions(){
 const select=byId('topic');if(!select)return;const selected=select.value;
 select.innerHTML='<option value="">همه زیرگروه‌ها</option>';
 [...new Set(DATA.items.filter(i=>!i.deleted).map(i=>i.subcategory).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fa')).forEach(topic=>{const option=document.createElement('option');option.value=topic;option.textContent=topic;select.appendChild(option)});
 select.value=[...select.options].some(o=>o.value===selected)?selected:'';
}
function startEdit(row){
 const item=DATA.items.find(item=>item.id===row.dataset.id);if(!item || row.querySelector('.item-edit'))return;
 const title=row.querySelector('.item-title');title.hidden=true;
 const editor=document.createElement('div');editor.className='item-edit';
 editor.innerHTML=`<label>عنوان آیتم<textarea class="item-title-editor" aria-label="ویرایش عنوان آیتم">${esc(item.text)}</textarea></label><label>دسته<select class="item-category-editor" aria-label="ویرایش دسته آیتم">${DATA.categories.map(c=>`<option value="${esc(c.h)}" ${c.h===item.h?'selected':''}>${esc(c.h+' — '+c.title)}</option>`).join('')}</select></label><label>زیرگروه موضوعی<select class="item-topic-editor" aria-label="ویرایش زیرگروه آیتم"></select></label><div class="item-edit-buttons"><button type="button" data-action="save">ذخیره</button><button type="button" data-action="cancel">انصراف</button></div>`;
 const category=editor.querySelector('.item-category-editor'),topic=editor.querySelector('.item-topic-editor');
 function fillTopics(){
  const cat=DATA.categories.find(c=>c.h===category.value),general='سایر موضوعات '+cat.title;
  const topics=[...new Set([general,...DATA.items.filter(i=>i.h===cat.h).map(i=>i.subcategory).filter(Boolean)])].sort((a,b)=>a.localeCompare(b,'fa'));
  topic.innerHTML=topics.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('');topic.value=cat.h===item.h&&topics.includes(item.subcategory)?item.subcategory:general;
 }
 category.addEventListener('change',fillTopics);fillTopics();
 editor.querySelector('textarea').addEventListener('input',event=>event.target.setCustomValidity(''));
 title.after(editor);editor.querySelector('textarea').focus();
}
async function handleAction(event){
 const button=event.target.closest('button[data-action]');if(!button)return;
 const row=button.closest('tr');if(!row)return;
 if(row.dataset.saving==='1')return;
 const id=row.dataset.id;
 if(button.dataset.action==='edit'){startEdit(row);return;}
 if(button.dataset.action==='cancel'){row.querySelector('.item-edit')?.remove();row.querySelector('.item-title').hidden=false;return;}
 if(button.dataset.action==='save'){
  const editor=row.querySelector('.item-title-editor');const text=editor.value.trim();
  if(!text){editor.setCustomValidity('عنوان آیتم را وارد کنید.');editor.reportValidity();return;}
  const category=DATA.categories.find(c=>c.h===row.querySelector('.item-category-editor').value);if(!category)return;
  const item=DATA.items.find(i=>i.id===id),moved=item.h!==category.h;
  const subcategory=row.querySelector('.item-topic-editor').value;
  const taskId=localEdits[id]?.taskId;
  if(taskId){
   row.dataset.saving='1';row.querySelectorAll('button').forEach(button=>button.disabled=true);
   try{await window.apiFetch(`/api/tasks/${encodeURIComponent(taskId)}`,{method:'PATCH',body:JSON.stringify({title:text,...(moved?{category:category.title}:{})})});await window.refreshAll();}
   catch(error){byId('saveMessage').textContent='ویرایش ذخیره نشد: '+error.message;return;}
   finally{delete row.dataset.saving;row.querySelectorAll('button').forEach(button=>button.disabled=false);}
  }
  saveItem(id,{text,h:category.h,category:category.title,macro:category.macro,subcategory,categoryReviewed:true,classification:{...item.classification,needsReview:false,reason:'دسته‌بندی انتخاب‌شده توسط کاربر'}});
  row.remove();
  refreshCounts();if(moved){clearFilters();jumpToCategory(category.h);}return;
 }
 if(button.dataset.action==='delete'){
  saveItem(id,{deleted:true});row.remove();lastDeletedId=id;refreshCounts();
  byId('saveMessage').append(' آیتم حذف شد. ');const undo=document.createElement('button');undo.type='button';undo.textContent='بازگردانی';undo.addEventListener('click',undoDelete);byId('saveMessage').append(undo);
 }
}
function undoDelete(){
 const item=DATA.items.find(item=>item.id===lastDeletedId);if(!item)return;
 saveItem(item.id,{deleted:false});lastDeletedId=null;refreshCounts();
}
async function startBank(){
 try{
  const response=await fetch("data/master-items.json");if(!response.ok)throw new Error("دریافت آیتم‌ها ناموفق بود");DATA=await response.json();
  originalTitles=new Map(DATA.items.map(item=>[item.id,normalizeSearch(item.text).trim()]));
  originalItems=new Map(DATA.items.map(item=>[item.id,structuredClone(item)]));
  try{const stored=JSON.parse(localStorage.getItem(EDIT_KEY)||"{}");if(stored && typeof stored==="object" && !Array.isArray(stored))localEdits=stored;}catch{byId("saveMessage").textContent="تغییرات ذخیره‌شده قابل خواندن نیست؛ داده‌های اکسل نمایش داده می‌شود.";}
  applySavedEdits();
  initFilters();renderBank();bankReady=true;refreshCounts();renderDashboard();
  const dashboard=document.querySelector('.mod-master');dashboard?.addEventListener('change',event=>{const id=event.target.dataset.masterCheck;if(id)setStatus(id,event.target.checked);});
  window.addEventListener('nova:data-changed',event=>{
   const {path,method,result}=event.detail;
   if(/^\/api\/(?:v11\/)?tasks(?:\/|$)/.test(path) && method!=='DELETE' && result?.id){
    const next=linkedTasks.filter(task=>task.id!==result.id);next.push(result);synchronizeTasks(next);
   }
  });
  window.addEventListener('storage',event=>{
   if(event.key!==EDIT_KEY)return;
   try{localEdits=JSON.parse(event.newValue||'{}');applySavedEdits();const open=[...document.querySelectorAll('.nova-master-bank .category-section.open')].map(section=>section.dataset.h);renderBank();refreshCounts();open.forEach(h=>toggleSection(h));renderDashboard();}catch(error){console.warn('Bank storage:',error);}
  });
  try{synchronizeTasks(await window.apiFetch('/api/tasks'));}catch(error){console.warn('Task linking:',error);}
  byId("bank").addEventListener("click",handleAction);
  byId("bank").addEventListener("change",event=>{const id=event.target.dataset.item;if(id)setStatus(id,event.target.checked);});
  byId("bank").addEventListener("input",event=>{const id=event.target.dataset.note;if(id){saveItem(id,{note:event.target.value});const row=event.target.closest("tr");row.dataset.search=textBlob(DATA.items.find(x=>x.id===id));}});
 }catch(error){byId("resultSummary").textContent="بارگذاری بانک آیتم‌ها ناموفق بود. صفحه را تازه کنید.";console.error(error);}
}

function ensureLoaded(){
 if(bankReady)return Promise.resolve();
 if(!bankPromise){
  byId('resultSummary').textContent='در حال دریافت بانک آیتم‌ها…';
  bankPromise=startBank().finally(()=>{bankPromise=null;});
 }
 return bankPromise;
}

const faDigits=s=>String(s).replace(/\d/g,d=>"۰۱۲۳۴۵۶۷۸۹"[d]);
const byId=id=>document.getElementById("bank-"+id)||document.getElementById(id);

function macroCode(s){return (s||"").split("—")[0].trim()}
function priorityClass(p){
  if((p||"").startsWith("P0")) return "p0";
  if((p||"").startsWith("P1")) return "p1";
  if((p||"").startsWith("P2") || (p||"").includes("DELEGATE")) return "p2";
  if((p||"").includes("BANK") || (p||"").includes("REFERENCE")) return "bankp";
  return "p3";
}
function cssVars(h){
  const themes={
   M1:['#EAF7F4','#4E9A91','#2F6F68','#CFE7E2'],
   M2:['#ECF3FB','#6B8FBD','#456B98','#D0DDF0'],
   M3:['#F1EDFA','#8A79B8','#675698','#DCD3EE'],
   M4:['#EDF8F0','#69A779','#477C58','#D2E8D8'],
   M5:['#EAF6FA','#5B9CB0','#3D7281','#CFE7EE'],
   M6:['#FFF1E9','#C08A6D','#936349','#ECD7CC'],
   M7:['#F1F7E9','#89A968','#678347','#D8E7C7'],
   M8:['#FCEEF1','#C47D89','#955865','#EFD2D8'],
   M9:['#FFF7E7','#B69955','#876F37','#EEE0B9'],
   M10:['#F0F4F6','#7A909A','#586E78','#D7E0E4']
  };
  const category=DATA.categories.find(c=>c.h===h);
  const [tint,accent,text,line]=themes[macroCode(category?.macro)]||themes.M10;
  return `--c-tint:${tint};--c-accent:${accent};--c-text:${text};--c-line:${line}`;
}
function esc(s){
  return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
}
function textBlob(it){
  return [it.id,it.h,it.category,it.subcategory,it.macro,it.priority,it.type,it.text,it.decision,it.rawSources,it.owner,it.specialtyTag,it.note,it.source,it.refSheet,it.refRow].join(" ").toLowerCase();
}

function initFilters(){
 const filters=document.createElement('div');filters.className='bank-topic-filters';
 filters.innerHTML='<label>زیرگروه موضوعی <select id="bank-topic"><option value="">همه زیرگروه‌ها</option></select></label><label><input id="bank-review" type="checkbox"> فقط موارد نیازمند بازبینی</label>';
 byId('bank').before(filters);
 [...new Set(DATA.items.map(i=>i.subcategory).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fa')).forEach(topic=>{const o=document.createElement('option');o.value=topic;o.textContent=topic;byId('topic').appendChild(o)});
 filters.addEventListener('change',()=>{applyFilters();openMatching()});
  Object.entries(DATA.macroTitles).sort(([a],[b])=>a.localeCompare(b,undefined,{numeric:true})).forEach(([code,title])=>{
    const o=document.createElement("option");o.value=code;o.textContent=title;byId("macro").appendChild(o);
  });
  [...new Set(DATA.items.map(x=>x.priority))].filter(Boolean).sort().forEach(v=>{
    const o=document.createElement("option");o.value=v;o.textContent=v;byId("priority").appendChild(o);
  });
  [...new Set(DATA.items.map(x=>x.type))].filter(Boolean).sort().forEach(v=>{
    const o=document.createElement("option");o.value=v;o.textContent=v;byId("type").appendChild(o);
  });
}

function renderBank(){
  byId("bank").innerHTML=DATA.categories.map(c=>`
    <article class="category-section" id="bank-sec-${c.h}" data-h="${c.h}" data-m="${macroCode(c.macro)}" style="${cssVars(c.h)}">
      <div class="category-header" role="button" tabindex="0" aria-expanded="false" onclick="NovaBank.toggleSection('${c.h}')" onkeydown="if(event.target===this &amp;&amp; (event.key==='Enter' || event.key===' ')){event.preventDefault();NovaBank.toggleSection('${c.h}')}">
        <span class="hcode">${esc(c.h)}</span>
        <div><h4>${esc(c.title)}</h4><small>${esc(c.macro)}</small></div>
        <span class="count"><span id="bank-count-${c.h}">${faDigits(c.count)}</span> آیتم</span>
        <span class="toggle" aria-hidden="true">⌄</span>
      </div>
      <div class="category-body">
        <table class="item-table">
          <thead><tr>
            <th class="col-actions">عملیات</th><th class="col-id">ID</th><th>عنوان / متن آیتم</th><th class="col-prio">اولویت</th>
            <th class="col-type">نوع</th><th class="col-decision">تصمیم تیم</th><th class="col-ref">مرجع</th>
          </tr></thead>
          <tbody id="bank-tbody-${c.h}">
          </tbody>
        </table>
        <button type="button" class="bank-load-more" onclick="NovaBank.loadMore('${c.h}')" hidden>نمایش موارد بیشتر</button>
      </div>
    </article>`).join("");
}

function rowHtml(it){
  const ref=[it.refSheet,it.refRow?("ردیف "+it.refRow):""].filter(Boolean).join(" • ");
  return `<tr class="${it.status==='☑'?'item-completed':''}" data-id="${esc(it.id)}" data-topic="${esc(it.subcategory||'')}" data-review="${it.classification?.needsReview===true}" data-search="${esc(textBlob(it))}" data-priority="${esc(it.priority)}" data-type="${esc(it.type)}" data-m="${esc(macroCode(it.macro))}">
    <td class="col-actions"><div class="item-actions"><input type="checkbox" aria-label="وضعیت ${esc(it.id)}" data-item="${esc(it.id)}" ${it.status==="☑"?"checked":""}><button type="button" class="item-action edit" data-action="edit" title="ویرایش آیتم" aria-label="ویرایش ${esc(it.id)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m16 3 5 5M3 21l5-1L21 7a2 2 0 0 0-4-4L4 16l-1 5Z"/></svg></button><button type="button" class="item-action delete" data-action="delete" title="حذف آیتم" aria-label="حذف ${esc(it.id)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/></svg></button></div></td>
    <td class="col-id"><b>${esc(it.id)}</b><span class="meta">${esc(it.h)}</span></td>
    <td><span class="item-title">${esc(it.text)}</span><span class="bank-topic">${esc(it.subcategory||it.category)}</span>${it.classification?.needsReview?'<span class="bank-review-label">نیازمند بازبینی دسته‌بندی</span>':''}${it.owner?`<span class="meta">مالک تخصصی اولیه: ${esc(it.owner)}</span>`:""}<textarea class="item-note" data-note="${esc(it.id)}" aria-label="یادداشت و اقدام بعدی ${esc(it.id)}" placeholder="یادداشت / اقدام بعدی">${esc(it.note||"")}</textarea></td>
    <td><span class="pill ${priorityClass(it.priority)}">${esc(it.priority)}</span></td>
    <td>${esc(it.type)}</td>
    <td>${esc(it.decision||"—")}</td>
    <td>${esc(ref||it.source||"—")}</td>

  </tr>`;
}

function toggleSection(h){
  if(!byId('sec-'+h)?.classList.contains('open'))renderCategory(h);
  const section=byId("sec-"+h); if(section){section.classList.toggle("open");section.querySelector(".category-header").setAttribute("aria-expanded",section.classList.contains("open"));}
}
function jumpToCategory(h){
  renderCategory(h);
  const sec=byId("sec-"+h); if(!sec)return;
  sec.classList.add("open");sec.querySelector(".category-header").setAttribute("aria-expanded","true");
  sec.scrollIntoView({behavior:"smooth",block:"start"});
}
function openAll(){document.querySelectorAll(".nova-master-bank .category-section:not(.hidden)").forEach(x=>{renderCategory(x.dataset.h);x.classList.add("open");x.querySelector(".category-header").setAttribute("aria-expanded","true")})}
function closeAll(){document.querySelectorAll(".nova-master-bank .category-section").forEach(x=>{x.classList.remove("open");x.querySelector(".category-header").setAttribute("aria-expanded","false")})}
function setMacro(code){byId("macro").value=code;applyFilters();openMatching()}

function clearFilters(){
  if(!bankReady)return;
  byId("q").value="";byId("macro").value="";byId("priority").value="";byId("type").value="";
  byId('topic').value='';byId('review').checked=false;
  applyFilters();
}
function applyFilters(){
  if(!DATA)return;
  const q=normalizeSearch(byId("q").value.trim());
  const m=byId("macro").value;
  const p=byId("priority").value;
  const t=byId("type").value;
  const topic=byId('topic').value,review=byId('review').checked;
  const grouped=new Map(DATA.categories.map(c=>[c.h,[]]));
  for(const item of DATA.items){
   if(item.deleted||q&&!normalizeSearch(textBlob(item)).includes(q)||m&&macroCode(item.macro)!==m||p&&item.priority!==p||t&&item.type!==t||topic&&item.subcategory!==topic||review&&!item.classification?.needsReview)continue;
   grouped.get(item.h)?.push(item);
  }
  let shown=0, shownCats=0;

  DATA.categories.forEach(c=>{
    const sec=byId("sec-"+c.h);
    const matches=grouped.get(c.h).sort(compareBankItems),catShown=matches.length;
    filteredCategories.set(c.h,matches);visibleLimits.set(c.h,PAGE_SIZE);
    if(sec.classList.contains('open'))renderCategory(c.h);
    else byId('tbody-'+c.h).replaceChildren();
    sec.classList.toggle("hidden",catShown===0);
    byId("count-"+c.h).textContent=faDigits(catShown);
    if(catShown){shownCats++;shown+=catShown}
  });
  byId("resultSummary").textContent=`نمایش ${faDigits(shown)} آیتم در ${faDigits(shownCats)} دسته از مجموع ${faDigits(DATA.items.filter(item=>!item.deleted).length)} آیتم`;
}
function openMatching(){
  openAll();
}

function renderCategory(h){
 const body=byId('tbody-'+h);if(!body)return;
 const items=(filteredCategories.get(h)||[]).sort(compareBankItems),limit=visibleLimits.get(h)||PAGE_SIZE;
 body.innerHTML=items.slice(0,limit).map(rowHtml).join('');
 body.closest('.category-body').querySelector('.bank-load-more').hidden=items.length<=limit;
}
function loadMore(h){visibleLimits.set(h,(visibleLimits.get(h)||PAGE_SIZE)+PAGE_SIZE);renderCategory(h);}

window.NovaBank={ensureLoaded,loadMore,applyFilters,clearFilters,openMatching,closeAll,exportEdits,openAll,toggleSection,jumpToCategory,setMacro,setStatus,renderDashboard,synchronizeTasks};
const dashboardPreview=document.querySelector('.mod-master .module-scroll');
if(dashboardPreview)dashboardPreview.innerHTML='<button type="button" onclick="goPage(\'items\')">مشاهده و مدیریت بانک آیتم‌ها</button>';
if(!document.getElementById('items')?.classList.contains('hidden'))ensureLoaded();
if(new URLSearchParams(location.search).get("page")==="items" && typeof window.goPage==="function")window.goPage("items");
})();
