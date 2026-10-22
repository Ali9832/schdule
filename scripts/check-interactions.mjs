import assert from 'node:assert/strict'
const base=process.env.NOVA_BASE_URL||'http://127.0.0.1:3001'
async function api(path,method='GET',body){
 const response=await fetch(base+path,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(process.env.NOVA_TOKEN?{Authorization:`Bearer ${process.env.NOVA_TOKEN}`}:{})},body:body?JSON.stringify(body):undefined})
 const result=await response.json();assert.ok(response.ok,`${method} ${path}: ${JSON.stringify(result)}`);return result
}
let id
try{
 const before=await api('/api/v11.2/dashboard');const today=before.today
 const task=await api('/api/tasks','POST',{title:`NOVA integration check ${Date.now()}`,due_date:today,status:'todo',priority:'medium'})
 id=task.id
 const bootstrap=await api('/api/bootstrap');assert.ok(bootstrap.tasks.some(task=>task.id===id))
 const paged=await api(`/api/v11/tasks/paged?q=${encodeURIComponent(task.title)}`);assert.ok(paged.items.some(task=>task.id===id))
 const schedule=await api('/api/v11.5/schedule');assert.ok(schedule.entries.some(entry=>entry.source_type==='task'&&entry.entity_id===id))
 const open=await api('/api/v11.2/dashboard');assert.equal(open.summary.tasks_open,before.summary.tasks_open+1)
 await api(`/api/v11/tasks/${id}`,'PATCH',{status:'done'})
 const tasks=await api('/api/tasks');assert.equal(tasks.find(task=>task.id===id).status,'done')
 const completed=await api('/api/v11.2/dashboard');assert.equal(completed.summary.tasks_open,before.summary.tasks_open)
 const updatedSchedule=await api('/api/v11.5/schedule');assert.ok(!updatedSchedule.entries.some(entry=>entry.source_type==='task'&&entry.entity_id===id))
 await api(`/api/tasks/${id}`,'PATCH',{status:'todo'})
 const restored=await api(`/api/v11/tasks/paged?q=${encodeURIComponent(task.title)}`);assert.equal(restored.items.find(task=>task.id===id).status,'todo')
 console.log('PASS: create, dashboard, task list, canonical workspace, calendar, completion and uncheck share task state.')
}finally{
 if(id)await api(`/api/tasks/${id}`,'DELETE')
}
