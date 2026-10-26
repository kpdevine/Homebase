// Push only: no fetch handler or asset cache, so deployments keep updating normally.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('push',event=>{
  event.waitUntil((async()=>{
    let message={};try{message=event.data?.json()||{};}catch{}
    await self.registration.showNotification('Pocket Planet',{
      body:message.body||'It’s time to log your day.',
      icon:'/assets/icons/pocket-planet-192.png',badge:'/assets/icons/pocket-planet-48.png',
      tag:typeof message.tag==='string'?message.tag:'pocket-planet-reminder',renotify:false,
      data:{url:message.url===self.location.origin+'/?open=solar'?message.url:self.location.origin+'/'},
    });
  })());
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil((async()=>{
    for(const client of await self.clients.matchAll({type:'window',includeUncontrolled:true})) {
      if(new URL(client.url).origin===self.location.origin){if(event.notification.data?.url===self.location.origin+'/?open=solar')await client.navigate(event.notification.data.url);await client.focus();return;}
    }
    await self.clients.openWindow(event.notification.data?.url===self.location.origin+'/?open=solar'?event.notification.data.url:self.location.origin+'/');
  })());
});
