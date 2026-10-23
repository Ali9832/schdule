(() => {
  const oldRender=window.renderV111Workspace;
  const pending=new Set();
  async function change(task,status){if(pending.has(task.id))return;pending.add(task.id);try{await v111OptimisticTaskField(task.id,'status',status);}finally{pending.delete(task.id);render();}}
  function text(tag,value,className){const node=document.createElement(tag);node.textContent=value??'';if(className)node.className=className;return node}
  function record(task){
    const article=document.createElement('article');article.className='workspace-task'+(task.status==='done'?' is-done':'');article.dataset.id=task.id;
    const head=document.createElement('div');head.className='workspace-task-head';
    const main=document.createElement('div');main.className='workspace-task-main';
    const title=text('button',task.title,'workspace-task-title');title.type='button';title.onclick=()=>openV11Inspector('task',task.id);main.append(title);
    if(task.description)main.append(text('p',task.description,'workspace-task-description'));
    const actions=document.createElement('div');actions.className='workspace-task-actions';
    const check=document.createElement('input');check.type='checkbox';check.checked=task.status==='done';check.disabled=pending.has(task.id);check.setAttribute('aria-label','انجام‌شده: '+task.title);check.onchange=()=>change(task,check.checked?'done':'todo');actions.append(check);
    const status=document.createElement('select');status.setAttribute('aria-label','وضعیت '+task.title);
    for(const [value,label] of [['todo','باز'],['in_progress','در جریان'],['done','انجام‌شده']])status.add(new Option(label,value));status.value=task.status||'todo';status.disabled=pending.has(task.id);status.onchange=()=>change(task,status.value);
    const edit=text('button','ویرایش');edit.type='button';edit.setAttribute('aria-label','ویرایش '+task.title);edit.onclick=async()=>{await openV11Inspector('task',task.id);if(V11_INSPECTOR?.id===task.id&&V11_INSPECTOR?.type==='task'&&document.getElementById('v11Inspector').classList.contains('open'))document.getElementById('v11InspectorEditBtn').click()};actions.append(status,edit);head.append(main,actions);article.append(head);
    const details=document.createElement('dl');details.className='workspace-task-details';
    const fields=[['پروژه',v11ProjectName(task.project_id)],['حوزه',v11AreaName(task.area_id)],['اولویت',taskPriorityFa(task.priority)],['موعد',task.due_date?faDateLabel(task.due_date):'بدون موعد'],['موقعیت انجام کار',task.context||'تعیین نشده'],['سطح انرژی',energyFa(task.energy)],['مدت زمان',task.estimate_minutes?`${toFaNum(task.estimate_minutes)} دقیقه`:'تعیین نشده'],['در انتظار پاسخ',task.waiting_on||'موردی نیست']];
    for(const [label,value] of fields){const group=document.createElement('div');group.append(text('dt',label),text('dd',value||'—'));details.append(group)}article.append(details);return article;
  }
  function render(){
    if(V11_TASK_VIEW!=='list')return oldRender();
    const root=document.getElementById('v11WorkspaceRoot');if(!root)return;
    const scroll=root.querySelector('.workspace-task-list')?.scrollTop||0;
    ['list','board','calendar'].forEach(view=>document.getElementById(`v11${view[0].toUpperCase()+view.slice(1)}Btn`)?.classList.toggle('active',view===V11_TASK_VIEW));
    const rows=V111_PAGE.items?.length||V111_PAGE.total===0?V111_PAGE.items:v11FilteredTasks(),total=V111_PAGE.total??rows.length;
    const meta=document.createElement('div');meta.className='v111-table-meta';meta.append(text('b','فهرست کارها'),text('span',`${toFaNum(rows.length)} کار نمایش داده شده از ${toFaNum(total)} نتیجه`));
    const list=document.createElement('div');list.className='workspace-task-list';list.setAttribute('aria-label','فهرست کارها');list.setAttribute('tabindex','0');
    [...rows].sort((a,b)=>Number(a.status==='done')-Number(b.status==='done')).forEach(task=>list.append(record(task)));
    if(!rows.length)list.append(text('p','کاری مطابق فیلترهای انتخاب‌شده پیدا نشد.','v11-empty'));
    const footer=document.createElement('div');footer.className='v111-pager';footer.append(text('span',V111_PAGE.next_cursor?'کارهای بیشتری برای نمایش وجود دارد.':'همهٔ نتایج نمایش داده شده‌اند.'));
    const more=text('button','بارگذاری بیشتر');more.type='button';more.disabled=!V111_PAGE.next_cursor||V111_PAGE.loading;more.onclick=()=>v111NextPage();footer.append(more);root.replaceChildren(meta,list,footer);list.scrollTop=scroll;
  }
  window.renderV111Workspace=render;window.renderV11Workspace=render;
  if(document.getElementById('workspace')&&!document.getElementById('workspace').classList.contains('hidden'))render();
})();
