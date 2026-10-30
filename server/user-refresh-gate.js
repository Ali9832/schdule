// Only throttle legacy-to-canonical synchronization, never cache private API responses.
export function createUserRefreshGate({ttlMs=15000,maxEntries=500,now=Date.now}={}){
  const entries=new Map()
  return {
    async run(user,action){
      let entry=entries.get(user)
      if(entry?.pending)return entry.pending
      if(entry&&entry.expires>now())return
      if(!entry){entry={expires:0,pending:null,revision:0};entries.set(user,entry)}
      const revision=entry.revision
      const task=Promise.resolve().then(action).then(()=>{if(revision===entry.revision)entry.expires=now()+ttlMs}).finally(()=>{
        entry.pending=null
        if(entries.size>maxEntries)for(const [key,value]of entries){if(!value.pending&&key!==user)entries.delete(key);if(entries.size<=maxEntries)break}
      })
      entry.pending=task
      return task
    },
    invalidate(user){const entry=entries.get(user);if(entry){entry.expires=0;entry.revision++}},
    get size(){return entries.size}
  }
}
