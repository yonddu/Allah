import assert from 'node:assert/strict';
import {WebSocket} from 'ws';
const delay=ms=>new Promise(r=>setTimeout(r,ms));
export async function checkRoomGathering(browser,origin){
 const sockets=[],contexts=[];
 const openVisitor=async()=>{
  const context=await browser.newContext({locale:'en-US',viewport:{width:390,height:844},extraHTTPHeaders:{'CF-Connecting-IP':'198.18.27.'+(contexts.length+1)}});contexts.push(context);const page=await context.newPage();
  await page.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());await page.goto(origin+'/?qa=1');await page.waitForFunction(()=>window.__noorScene?.selfId,null,{timeout:60000});return page;
 };
 try{
  const a=await openVisitor();assert.match(await a.locator('#currentMapName').textContent(),/ · 1$/);assert.equal(await a.locator('#onlineCount').isVisible(),true);
  await a.locator('#prayerButton').click();const firstId=await a.evaluate(()=>window.__noorScene.selfId);
  for(let n=0;n<2;n++){
   const response=await fetch(origin+'/api/session',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','CF-Connecting-IP':'198.18.25.'+(n+1)},body:JSON.stringify({name:'Gathering QA '+n})});assert.ok(response.ok);
   const cookie=response.headers.get('set-cookie').split(';')[0];
   await new Promise((resolve,reject)=>{const ws=new WebSocket(origin.replace('http:','ws:')+'/api/room?room=mecca:2',{origin,headers:{Cookie:cookie}});sockets.push(ws);ws.on('error',reject);ws.on('message',raw=>{if(JSON.parse(raw).type==='welcome')resolve();});});
  }
  await delay(16000);assert.equal(await a.evaluate(()=>window.__noorScene.selfId),firstId,'A prayer must not be interrupted by room consolidation');
  assert.match(await a.locator('#onlineCount').textContent(),/3$/);
  await a.locator('#prayerButton').click();
  await a.waitForFunction(()=>document.getElementById('currentMapName').textContent.endsWith(' · 2')&&window.__noorScene.selfId,null,{timeout:22000});
  const rooms=await(await fetch(origin+'/api/rooms?map=mecca')).json();assert.equal(rooms.rooms[0].count,0);assert.equal(rooms.rooms[1].count,3);
  const b=await openVisitor();assert.match(await b.locator('#currentMapName').textContent(),/ · 2$/);assert.match(await b.locator('#onlineCount').textContent(),/4$/);
  await b.locator('#mapButton').click();await b.locator('#serverChoices button').first().waitFor();assert.equal(await b.locator('#serverChoices button').count(),1,'Empty overflow servers remain closed while it is quiet');
  const presence=await(await fetch(origin+'/api/presence')).json();assert.equal(presence.total,4);
  console.log(JSON.stringify({gathering:'passed',prayerPreserved:true,busyRoomPreferred:true,realOnlineCount:4}));
 }finally{
  for(const context of contexts)await context.close();for(const socket of sockets)socket.close();
  for(let n=0;n<100;n++){const r=await fetch(origin+'/api/presence');if((await r.json()).total===0)break;await delay(50);}
 }
}
