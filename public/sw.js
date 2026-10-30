const CACHE='noava-v2.7.0';
const SHELL=['/','/index.html','/manifest.webmanifest'];
self.addEventListener('notificationclick',event=>{
 if(!event.notification.data?.reading)return;
 event.notification.close();
 event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(async windows=>{
  const target=windows.find(client=>new URL(client.url).origin===self.location.origin);
  const bookId=event.notification.data.book_id;
  if(target){await target.focus();target.postMessage({reading:true,book_id:bookId});}
  else await clients.openWindow('/?reading=1'+(bookId?'&book='+encodeURIComponent(bookId):''));
 }));
});
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>(key.startsWith('noava-')||key.startsWith('molibden-')||key.startsWith('nova-'))&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
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
