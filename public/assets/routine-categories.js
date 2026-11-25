(() => {
  'use strict';
  const category=document.getElementById('genericCategory'),status=document.getElementById('genericStatus').closest('.field');
  const original=[...category.options].map(o=>({value:o.value,text:o.textContent})),labels={general:'عمومی',spiritual:'معنوی',reading:'کتاب‌خوانی',exercise:'ورزش'};
  let generation=0;
  function setOptions(items,value){category.replaceChildren();for(const item of items){const option=document.createElement('option');option.value=item.value;option.textContent=item.text;category.append(option);}category.value=value;}
  function restore(){status.classList.remove('hidden');status.hidden=false;setOptions(original,original[0]?.value||'');}
  function prepare(habit={},habits=[]){
    const current=habit.routine_type||'general',types=new Set([...Object.keys(labels),...habits.map(h=>h.routine_type||'general'),current]);
    setOptions([...types].map(type=>({value:type,text:labels[type]||type})),current);
    status.classList.add('hidden');status.hidden=true;
  }
  const open=window.openGenericAdd;
  window.openGenericAdd=async function(type='general',...args){
    const owner=++generation;
    if(type!=='habit'){restore();return open.call(this,type,...args);}
    try{const habits=await apiFetch('/api/habits');if(owner!==generation)return;const page=document.querySelector('.page:not(.hidden)')?.id,preset=args[1]||({reading:'reading',sports:'exercise',spiritual:'spiritual'}[page])||'general';prepare({routine_type:preset},habits);return open.call(this,type,...args);}
    catch(error){if(owner===generation)showToast('فرم روتین باز نشد',error.message);}
  };
  for(const name of ['baseEditTask','baseEditModule']){const edit=window[name];window[name]=function(...args){generation++;if(name==='baseEditTask'||args[0]!=='habit')restore();return edit.apply(this,args);};}
  const close=window.closeGenericAdd;window.closeGenericAdd=function(...args){generation++;return close.apply(this,args);};
  window.RoutineCategories={prepare,label:type=>labels[type]||type||labels.general};
})();
