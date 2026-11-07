// Network-first application: never cache accounts, chats, models or old application modules.
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{if(event.request.mode==='navigate')event.respondWith(fetch(event.request).catch(()=>new Response('<!doctype html><html lang="en"><meta name="viewport" content="width=device-width"><title>Noor offline</title><body style="background:#102c2a;color:#f4d28b;font:18px system-ui;padding:32px"><h1>Noor is offline</h1><p>Reconnect to enter the sanctuary and update your prayer times.</p><button onclick="location.reload()">Try again</button></body></html>',{headers:{'Content-Type':'text/html; charset=utf-8'}})));});
self.addEventListener('push',event=>{
 let data;try{data=event.data.json();}catch{data={};}const prayer=['Fajr','Dhuhr','Asr','Maghrib','Isha'].includes(data.prayer)?data.prayer:'Prayer',minutes=Math.ceil((Number(data.startsAt)-Date.now())/60000);
 const body=Number.isFinite(minutes)&&minutes>0?`${prayer} prayer starts in ${minutes} minute${minutes===1?'':'s'}.`:`${prayer} prayer time has arrived.`;
 event.waitUntil(self.registration.showNotification(prayer+' prayer reminder',{body,tag:typeof data.tag==='string'?data.tag:'noor-prayer',icon:'/icons/icon-192.png',badge:'/icons/icon-192.png',data:{url:'/'},lang:'en'}));
});
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async clients=>{for(const client of clients)if(new URL(client.url).origin===self.location.origin){await client.focus();return;}await self.clients.openWindow('/');}));});
