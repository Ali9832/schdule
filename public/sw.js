const CACHE='nova-v11-12-1-dashboard-performance-v2';
const SHELL=['/','/index.html','/manifest.webmanifest'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('nova-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==location.origin||url.pathname.startsWith('/api/'))return;
 const update=async()=>{
  const response=await fetch(request);
  if(response.ok){const cache=await caches.open(CACHE);await cache.put(request,response.clone());}
  return response;
 };
 if(request.mode==='navigate'){
  event.respondWith(update().catch(async()=>await caches.match(request)||await caches.match('/index.html')||Response.error()));
  return;
 }
 event.respondWith((async()=>{
  const cached=await caches.match(request);
  if(cached){event.waitUntil(update().catch(()=>{}));return cached;}
  return update();
 })());
});
