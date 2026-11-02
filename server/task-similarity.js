export function normalizeTaskTitle(value){
  return String(value||'').normalize('NFKC').toLowerCase().replace(/[يى]/g,'ی').replace(/ك/g,'ک')
    .replace(/[۰-۹]/g,c=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).replace(/[٠-٩]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(c)))
    .replace(/[\u064b-\u065f\u0670\u0640]/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ')
}
const grams=text=>new Set(Array.from({length:Math.max(0,text.length-1)},(_,i)=>text.slice(i,i+2)))
function overlap(a,b){let common=0;for(const item of a)if(b.has(item))common++;return a.size+b.size?2*common/(a.size+b.size):0}
function editSimilarity(a,b){
  let previous=Array.from({length:b.length+1},(_,i)=>i)
  for(let i=1;i<=a.length;i++){const next=[i];for(let j=1;j<=b.length;j++)next[j]=Math.min(next[j-1]+1,previous[j]+1,previous[j-1]+(a[i-1]===b[j-1]?0:1));previous=next}
  return 1-previous[b.length]/Math.max(a.length,b.length)
}
export function similarTasks(tasks,query,{check=false,limit=6}={}){
  const q=normalizeTaskTitle(query);if(!q)return []
  const words=new Set(q.split(' ')),pairs=grams(q),rows=[]
  for(const task of tasks){
    const title=normalizeTaskTitle(task.title);if(!title)continue
    const ratio=Math.min(title.length,q.length)/Math.max(title.length,q.length)
    let score=0,match='similar'
    if(title===q){score=1;match='exact'}
    else if(title.startsWith(q)||q.startsWith(title)){score=.65+.25*ratio;match=ratio>=.72?'similar':'prefix'}
    else{
      const tokens=overlap(words,new Set(title.split(' '))),characters=overlap(pairs,grams(title))
      score=Math.max(tokens*.95,characters*.88)
      if(q.length>=5&&ratio>=.65&&characters>=.45&&title.length<=300)score=Math.max(score,editSimilarity(q,title)*.96)
      if(!check&&q.length>=2&&title.split(' ').some(word=>word.startsWith(q)))score=Math.max(score,.64)
    }
    if(score<(check ? .82 : .6)||(check&&(match==='prefix'||ratio<.65)))continue
    rows.push({id:task.id,title:task.title,status:task.status,due_date:task.due_date||null,project_name:task.project_name||'',score:Math.round(score*1000)/1000,match})
  }
  return rows.sort((a,b)=>b.score-a.score||Number(a.status==='done')-Number(b.status==='done')||a.title.localeCompare(b.title,'fa')).slice(0,limit)
}
export function registerTaskSimilarity(app,{canonical}){
  app.get('/api/tasks/suggestions',{schema:{querystring:{type:'object',additionalProperties:false,required:['q'],properties:{q:{type:'string',minLength:1,maxLength:300},mode:{type:'string',enum:['search','check']}}}}},async(request,reply)=>{
    const data=await canonical(request.user.id),projects=new Map(data.projects.map(p=>[p.id,p.name]))
    reply.header('Cache-Control','private, no-store')
    return {items:similarTasks(data.tasks.map(t=>({...t,project_name:projects.get(t.project_id)||''})),request.query.q,{check:request.query.mode==='check'})}
  })
  app.get('/api/tasks/:id',async(request,reply)=>{
    const data=await canonical(request.user.id),task=data.tasks.find(t=>t.id===request.params.id)
    if(!task)return reply.code(404).send({error:'کار پیدا نشد یا دیگر در دسترس نیست.'})
    return task
  })
}
