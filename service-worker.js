const CACHE='matlog-v1-20261107';
const ASSETS=['./','./index.html','./style.css?v=1','./app.js?v=1','./data/seed.json','./manifest.webmanifest','./icons/apple-touch-icon.png'];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()).catch(()=>{}));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
  event.respondWith((async()=>{
    try{
      const network=await fetch(event.request);
      if(network.ok){const cache=await caches.open(CACHE);cache.put(event.request,network.clone());}
      return network;
    }catch(err){return (await caches.match(event.request))||(await caches.match('./index.html'))||Response.error();}
  })());
});
