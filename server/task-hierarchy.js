export function validateTaskHierarchy(tasks,next,currentId=null){
  const fail=message=>{throw Object.assign(new Error(message),{statusCode:400})}
  if(next.parent_task_id){
    const parent=tasks.find(t=>t.id===next.parent_task_id)
    if(!parent||(parent.project_id||null)!==(next.project_id||null))fail('کار اصلی باید از همین پروژه انتخاب شود.')
    const visited=new Set(currentId?[currentId]:[]);let cursor=parent
    while(cursor){if(visited.has(cursor.id))fail('کار نمی‌تواند زیرمجموعهٔ خودش یا ریزکارهایش باشد.');visited.add(cursor.id);cursor=tasks.find(t=>t.id===cursor.parent_task_id)}
  }
  if(currentId&&tasks.some(t=>t.parent_task_id===currentId&&t.project_id!==next.project_id))fail('این کار ریزکار دارد؛ ابتدا ریزکارها را جدا یا به پروژهٔ مقصد منتقل کنید.')
}
