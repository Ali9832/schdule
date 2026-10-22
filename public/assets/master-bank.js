(() => {
let DATA;
const EDIT_KEY="nova-master-items-edits-v1";
let localEdits={};
let lastDeletedId=null;
let linkedTasks=[];
let originalTitles=new Map();
let bankReady=false;
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
 return Number(a.status==='☑')-Number(b.status==='☑') || Number(a.excelRow)-Number(b.excelRow);
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
 const card=document.querySelector('.mod-master');if(!card)return;
 const active=DATA.items.filter(item=>!item.deleted),done=active.filter(item=>item.status==='☑').length;
 const primary=card.querySelector('.module-percent');if(primary)primary.textContent=faDigits(active.length);
 const meta=card.querySelector('.module-meta');if(meta)meta.textContent=`${faDigits(done)} انجام‌شده • ${faDigits(active.length-done)} باز • ۲۳ دسته`;
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
 const blob=new Blob([JSON.stringify({version:1,items:localEdits},null,2)],{type:"application/json"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="NOVA_Master_Item_Edits.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function applySavedEdits(){
 DATA.items.forEach(item=>{const edit=localEdits[item.id];if(!edit || typeof edit!=="object")return;if(["☐","☑"].includes(edit.status))item.status=edit.status;for(const field of ["note","text"])if(typeof edit[field]==="string")item[field]=edit[field];item.deleted=edit.deleted===true;});
}
function refreshCounts(){
 const active=DATA.items.filter(item=>!item.deleted);
 DATA.macroCounts=Object.fromEntries(Object.keys(DATA.macroTitles).map(code=>[code,active.filter(item=>macroCode(item.macro)===code).length]));
 renderMacros();applyFilters();
}
function startEdit(row){
 const item=DATA.items.find(item=>item.id===row.dataset.id);if(!item || row.querySelector('.item-edit'))return;
 const title=row.querySelector('.item-title');title.hidden=true;
 const editor=document.createElement('div');editor.className='item-edit';
 editor.innerHTML=`<textarea class="item-title-editor" aria-label="ویرایش عنوان آیتم">${esc(item.text)}</textarea><div class="item-edit-buttons"><button type="button" data-action="save">ذخیره</button><button type="button" data-action="cancel">انصراف</button></div>`;
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
  const taskId=localEdits[id]?.taskId;
  if(taskId){
   row.dataset.saving='1';row.querySelectorAll('button').forEach(button=>button.disabled=true);
   try{await window.apiFetch(`/api/tasks/${encodeURIComponent(taskId)}`,{method:'PATCH',body:JSON.stringify({title:text})});await window.refreshAll();}
   catch(error){byId('saveMessage').textContent='ویرایش ذخیره نشد: '+error.message;return;}
   finally{delete row.dataset.saving;row.querySelectorAll('button').forEach(button=>button.disabled=false);}
  }
  saveItem(id,{text});row.querySelector('.item-title').textContent=text;row.querySelector('.item-title').hidden=false;row.querySelector('.item-edit').remove();
  row.dataset.search=textBlob(DATA.items.find(item=>item.id===id));applyFilters();return;
 }
 if(button.dataset.action==='delete'){
  saveItem(id,{deleted:true});row.remove();lastDeletedId=id;refreshCounts();
  byId('saveMessage').append(' آیتم حذف شد. ');const undo=document.createElement('button');undo.type='button';undo.textContent='بازگردانی';undo.addEventListener('click',undoDelete);byId('saveMessage').append(undo);
 }
}
function undoDelete(){
 const item=DATA.items.find(item=>item.id===lastDeletedId);if(!item)return;
 saveItem(item.id,{deleted:false});byId('tbody-'+item.h).insertAdjacentHTML('beforeend',rowHtml(item));reorderCategory(item.h);lastDeletedId=null;refreshCounts();
}
async function startBank(){
 try{
  const response=await fetch("data/master-items.json");if(!response.ok)throw new Error("دریافت آیتم‌ها ناموفق بود");DATA=await response.json();
  originalTitles=new Map(DATA.items.map(item=>[item.id,normalizeSearch(item.text).trim()]));
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
   try{localEdits=JSON.parse(event.newValue||'{}');applySavedEdits();const open=[...document.querySelectorAll('.nova-master-bank .category-section.open')].map(section=>section.dataset.h);renderBank();open.forEach(h=>toggleSection(h));refreshCounts();renderDashboard();}catch(error){console.warn('Bank storage:',error);}
  });
  try{synchronizeTasks(await window.apiFetch('/api/tasks'));}catch(error){console.warn('Task linking:',error);}
  byId("bank").addEventListener("click",handleAction);
  byId("bank").addEventListener("change",event=>{const id=event.target.dataset.item;if(id)setStatus(id,event.target.checked);});
  byId("bank").addEventListener("input",event=>{const id=event.target.dataset.note;if(id){saveItem(id,{note:event.target.value});const row=event.target.closest("tr");row.dataset.search=textBlob(DATA.items.find(x=>x.id===id));}});
 }catch(error){byId("resultSummary").textContent="بارگذاری بانک آیتم‌ها ناموفق بود. صفحه را تازه کنید.";console.error(error);}
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
  const s=DATA.styles[h]||{tint:"#f5f8f9",accent:"#6f8790",line:"#dfe7ea"};
  return `--c-tint:${s.tint};--c-accent:${s.accent};--c-line:${s.line}`;
}
function esc(s){
  return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
}
function textBlob(it){
  return [it.id,it.h,it.category,it.macro,it.priority,it.type,it.text,it.decision,it.rawSources,it.owner,it.specialtyTag,it.note,it.source,it.refSheet,it.refRow].join(" ").toLowerCase();
}

function initFilters(){
  Object.entries(DATA.macroTitles).sort().forEach(([code,title])=>{
    const o=document.createElement("option");o.value=code;o.textContent=title;byId("macro").appendChild(o);
  });
  [...new Set(DATA.items.map(x=>x.priority))].filter(Boolean).sort().forEach(v=>{
    const o=document.createElement("option");o.value=v;o.textContent=v;byId("priority").appendChild(o);
  });
  [...new Set(DATA.items.map(x=>x.type))].filter(Boolean).sort().forEach(v=>{
    const o=document.createElement("option");o.value=v;o.textContent=v;byId("type").appendChild(o);
  });
}

function renderMacros(){
  const colors=["#EAF7F4","#EDF5FC","#FFF1E9","#F3EEFA","#FCEEF1","#F2F5F7"];
  byId("macroRow").innerHTML=Object.entries(DATA.macroTitles).sort().map(([code,title],i)=>`
    <div class="macro" style="background:${colors[i%colors.length]}" onclick="NovaBank.setMacro('${code}')">
      <b>${esc(code)}</b><span>${esc(title.replace(code+" — ",""))}</span><strong>${faDigits(DATA.macroCounts[code]||0)} آیتم</strong>
    </div>`).join("");
}


function renderBank(){
  const byCat={};
  DATA.categories.forEach(c=>byCat[c.h]=[]);
  DATA.items.filter(it=>!it.deleted).forEach(it=>{(byCat[it.h]??=[]).push(it)});

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
            ${byCat[c.h].sort(compareBankItems).map(it=>rowHtml(it)).join("")}
          </tbody>
        </table>
      </div>
    </article>`).join("");
}

function rowHtml(it){
  const ref=[it.refSheet,it.refRow?("ردیف "+it.refRow):""].filter(Boolean).join(" • ");
  return `<tr class="${it.status==='☑'?'item-completed':''}" data-id="${esc(it.id)}" data-search="${esc(textBlob(it))}" data-priority="${esc(it.priority)}" data-type="${esc(it.type)}" data-m="${esc(macroCode(it.macro))}">
    <td class="col-actions"><div class="item-actions"><input type="checkbox" aria-label="وضعیت ${esc(it.id)}" data-item="${esc(it.id)}" ${it.status==="☑"?"checked":""}><button type="button" class="item-action edit" data-action="edit" title="ویرایش آیتم" aria-label="ویرایش ${esc(it.id)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m16 3 5 5M3 21l5-1L21 7a2 2 0 0 0-4-4L4 16l-1 5Z"/></svg></button><button type="button" class="item-action delete" data-action="delete" title="حذف آیتم" aria-label="حذف ${esc(it.id)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/></svg></button></div></td>
    <td class="col-id"><b>${esc(it.id)}</b><span class="meta">${esc(it.h)}</span></td>
    <td><span class="item-title">${esc(it.text)}</span>${it.owner?`<span class="meta">مالک تخصصی: ${esc(it.owner)}</span>`:""}<textarea class="item-note" data-note="${esc(it.id)}" aria-label="یادداشت و اقدام بعدی ${esc(it.id)}" placeholder="یادداشت / اقدام بعدی">${esc(it.note||"")}</textarea></td>
    <td><span class="pill ${priorityClass(it.priority)}">${esc(it.priority)}</span></td>
    <td>${esc(it.type)}</td>
    <td>${esc(it.decision||"—")}</td>
    <td>${esc(ref||it.source||"—")}</td>

  </tr>`;
}

function toggleSection(h){
  const section=byId("sec-"+h); if(section){section.classList.toggle("open");section.querySelector(".category-header").setAttribute("aria-expanded",section.classList.contains("open"));}
}
function jumpToCategory(h){
  const sec=byId("sec-"+h); if(!sec)return;
  sec.classList.add("open");sec.querySelector(".category-header").setAttribute("aria-expanded","true");
  sec.scrollIntoView({behavior:"smooth",block:"start"});
}
function openAll(){document.querySelectorAll(".nova-master-bank .category-section:not(.hidden)").forEach(x=>{x.classList.add("open");x.querySelector(".category-header").setAttribute("aria-expanded","true")})}
function closeAll(){document.querySelectorAll(".nova-master-bank .category-section").forEach(x=>{x.classList.remove("open");x.querySelector(".category-header").setAttribute("aria-expanded","false")})}
function setMacro(code){byId("macro").value=code;applyFilters();openMatching()}

function clearFilters(){
  byId("q").value="";byId("macro").value="";byId("priority").value="";byId("type").value="";
  applyFilters();
}
function applyFilters(){
  const q=normalizeSearch(byId("q").value.trim());
  const m=byId("macro").value;
  const p=byId("priority").value;
  const t=byId("type").value;
  let shown=0, shownCats=0;

  DATA.categories.forEach(c=>{
    const sec=byId("sec-"+c.h);
    let catShown=0;
    sec.querySelectorAll("tbody tr").forEach(tr=>{
      const okQ=!q || normalizeSearch(tr.dataset.search||"").includes(q);
      const okM=!m || tr.dataset.m===m;
      const okP=!p || tr.dataset.priority===p;
      const okT=!t || tr.dataset.type===t;
      const ok=okQ&&okM&&okP&&okT;
      tr.style.display=ok?"":"none";
      if(ok)catShown++;
    });
    sec.classList.toggle("hidden",catShown===0);
    byId("count-"+c.h).textContent=faDigits(catShown);
    if(catShown){shownCats++;shown+=catShown}
  });
  byId("resultSummary").textContent=`نمایش ${faDigits(shown)} آیتم در ${faDigits(shownCats)} دسته از مجموع ${faDigits(DATA.items.filter(item=>!item.deleted).length)} آیتم`;
}
function openMatching(){
  document.querySelectorAll(".nova-master-bank .category-section:not(.hidden)").forEach(x=>{x.classList.add("open");x.querySelector(".category-header").setAttribute("aria-expanded","true")});
}

startBank();

window.NovaBank={applyFilters,clearFilters,openMatching,closeAll,exportEdits,openAll,toggleSection,jumpToCategory,setMacro,setStatus,renderDashboard,synchronizeTasks};
if(new URLSearchParams(location.search).get("page")==="items" && typeof window.goPage==="function")window.goPage("items");
})();
