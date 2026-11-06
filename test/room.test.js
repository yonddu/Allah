import test from 'node:test';
import assert from 'node:assert/strict';
import {prayerYaw} from '../public/core.js';
import worker,{PrayerRoom,roomCapacity} from '../worker.js';

test('Public presence counts every courtyard and recommends occupied rooms without exposing identities',async()=>{
 const env={ROOMS:{idFromName:n=>n,get:key=>({fetch:async()=>Response.json({count:({'mecca:2':3,'taj:1':2,'makkah:1':4})[key]||0})})}};
 const response=await worker.fetch(new Request('https://noor.example/api/presence'),env),data=await response.json();
 assert.equal(response.headers.get('Cache-Control'),'no-store');assert.equal(data.total,9);assert.equal(data.maps.mecca.total,3);assert.equal(data.maps.makkah.total,4);
 assert.equal(JSON.stringify(data).includes('accountId'),false);
 const rooms=await(await worker.fetch(new Request('https://noor.example/api/rooms?map=mecca'),env)).json();assert.equal(rooms.recommendedServer,2);assert.equal(rooms.rooms.length,3);
});

test('Leave removes only the authenticated page, releases capacity immediately and is idempotent',async()=>{
 const {room,socket}=setup(),a=socket('a','owner',{praying:true}),anotherTab=socket('another-tab','owner'),peer=socket('peer','other');
 room.protectedSockets.add(a);room.batchClients.add(a);room.pendingMoves.set('a',a.deserializeAttachment());
 const leave=account=>room.fetch(new Request('https://room.internal/leave?player=a',{method:'POST',headers:{'X-Noor-Account':account}}));
 assert.equal((await leave('other')).status,204);assert.equal(room.players().length,3);
 assert.equal((await leave('owner')).status,204);assert.equal(room.players().length,2);assert.equal(a.deserializeAttachment(),null);assert.ok(anotherTab.deserializeAttachment());
 assert.equal(room.protectedSockets.has(a),false);assert.equal(room.batchClients.has(a),false);assert.equal(room.pendingMoves.has('a'),false);
 assert.equal(peer.messages.filter(m=>m.type==='leave'&&m.id==='a').length,1);
 await leave('owner');room.webSocketClose(a,1000);assert.equal(peer.messages.filter(m=>m.type==='leave'&&m.id==='a').length,1);
});

test('Leave endpoint rejects foreign origins and oversized bodies, and derives identity from the session',async()=>{
 let forwarded;const env={COMMUNITY:{idFromName:n=>n,get:()=>({fetch:async()=>Response.json({id:'owner'})})},ROOMS:{idFromName:n=>n,get:room=>({fetch:async request=>{forwarded={room,request};return new Response(null,{status:204});}})}};
 const request=(body,origin='https://noor.example')=>new Request('https://noor.example/api/leave',{method:'POST',headers:{Origin:origin},body});
 const payload=JSON.stringify({room:'taj:2',player:'own-player',account:'forged'});
 assert.equal((await worker.fetch(request(payload,'https://evil.example'),env)).status,403);assert.equal(forwarded,undefined);
 assert.equal((await worker.fetch(request('x'.repeat(1025)),env)).status,413);assert.equal((await worker.fetch(request('{broken'),env)).status,400);
 assert.equal((await worker.fetch(request(payload),env)).status,204);assert.equal(forwarded.room,'taj:2');assert.equal(forwarded.request.headers.get('X-Noor-Account'),'owner');assert.equal(new URL(forwarded.request.url).searchParams.get('player'),'own-player');
 env.COMMUNITY.get=()=>({fetch:async()=>new Response(null,{status:401})});assert.equal((await worker.fetch(request(payload),env)).status,401);
});
function setup(){
  const sockets=[],access={};
  const ctx={getWebSockets:()=>sockets,blockConcurrencyWhile:fn=>fn()};
  const env={COMMUNITY:{idFromName:n=>n,get:()=>({fetch:async()=>Response.json(access)})}};
  const room=new PrayerRoom(ctx,env);
  function socket(id,accountId,extra={}){
    let state={id,accountId,x:0,z:0,yaw:0,profile:{name:id},praying:false,pose:'standing',tokens:30,rateAt:Date.now(),lastMove:Date.now()-100,profileAt:0,...extra};
    const ws={messages:[],deserializeAttachment:()=>structuredClone(state),serializeAttachment:s=>{state=structuredClone(s);},send:s=>ws.messages.push(JSON.parse(s)),close:()=>{}};
    sockets.push(ws);access[accountId]={id:accountId,premium:false,friends:[]};return ws;
  }
  return {room,socket,access,sockets};
}
test('The room rejects teleporting and ignores forged paid protection',async()=>{
  const {room,socket}=setup(),ws=socket('one','u1');
  await room.webSocketMessage(ws,JSON.stringify({type:'move',x:999,z:0,yaw:1}));assert.ok(ws.deserializeAttachment().x<=1.05);
  await room.webSocketMessage(ws,JSON.stringify({type:'protect',premium:true}));assert.equal(ws.deserializeAttachment().protected,undefined);
  await room.webSocketMessage(ws,JSON.stringify({type:'prayer',active:true,pose:'prostrating',premium:true}));const state=ws.deserializeAttachment();assert.equal(state.protected,true);assert.equal(state.yaw,prayerYaw('mecca',state));
  await room.webSocketMessage(ws,JSON.stringify({type:'move',x:2,z:0}));assert.equal(ws.deserializeAttachment().x,state.x);
});
test('Chat filtering is enforced for premium viewers on the server',async()=>{
  const {room,socket,access}=setup(),sender=socket('sender','u1'),subscriber=socket('subscriber','u2'),publicUser=socket('public','u3');
  access.u2.premium=true;
  await room.webSocketMessage(sender,JSON.stringify({type:'chat',text:'hello'}));
  assert.equal(subscriber.messages.filter(m=>m.type==='chat').length,0);
  assert.equal(publicUser.messages.filter(m=>m.type==='chat').length,1);
  access.u2.friends=['u1'];const state=sender.deserializeAttachment();state.chatAt=0;sender.serializeAttachment(state);
  await room.webSocketMessage(sender,JSON.stringify({type:'chat',text:'friend message'}));
  assert.equal(subscriber.messages.filter(m=>m.type==='chat').length,1);
});
test('Worker blocks cross-origin sockets before forwarding any identity',async()=>{
  const r=await worker.fetch(new Request('https://noor.example/api/room?room=zayed:1',{headers:{Upgrade:'websocket',Origin:'https://evil.example'}}),{});
  assert.equal(r.status,403);
  const bad=await worker.fetch(new Request('https://noor.example/api/room?room=unknown',{headers:{Upgrade:'websocket',Origin:'https://noor.example'}}),{});
  assert.equal(bad.status,404);
});

test('Whispers are private to the two accounts and cannot forge sender identity',async()=>{
  const {room,socket}=setup(),a=socket('a','u1'),aTab=socket('a-tab','u1'),b=socket('b','u2'),c=socket('c','u3');
  await room.webSocketMessage(a,JSON.stringify({type:'whisper',to:'u2',text:'private',accountId:'u3',name:'forged'}));
  for(const ws of [a,aTab,b]){const dm=ws.messages.find(m=>m.type==='whisper');assert.equal(dm.accountId,'u1');assert.equal(dm.name,'a');assert.equal(dm.to,'u2');}
  assert.deepEqual(c.messages,[]);
});
test('Server enforces independent mute settings, blocks in both directions and absent recipients',async()=>{
  const {room,socket,access}=setup(),a=socket('a','u1'),b=socket('b','u2'),c=socket('c','u3');
  async function send(data){const state=a.deserializeAttachment();state.chatAt=0;a.serializeAttachment(state);await room.webSocketMessage(a,JSON.stringify(data));}
  access.u2.publicChat=false;await send({type:'chat',text:'public'});assert.equal(b.messages.length,0);assert.equal(c.messages.length,1);
  await send({type:'whisper',to:'u2',text:'dm allowed'});assert.equal(b.messages.length,1);
  access.u2.whispers=false;await send({type:'whisper',to:'u2',text:'muted'});assert.equal(b.messages.length,1);
  access.u2.whispers=true;access.u2.blocked=['u1'];await send({type:'whisper',to:'u2',text:'blocked'});assert.equal(b.messages.length,1);
  access.u2.blocked=[];access.u1.blocked=['u2'];await send({type:'whisper',to:'u2',text:'reverse block'});assert.equal(b.messages.length,1);
  await send({type:'whisper',to:'absent',text:'absent'});assert.equal(c.messages.length,1);
  access.u1.whispers=false;access.u1.blocked=[];await send({type:'whisper',to:'u2',text:'sender muted'});assert.equal(b.messages.length,1);
  assert.ok(a.messages.some(m=>m.type==='notice'));
});


test('Room capacity remains50 by default and only accepts bounded server-side overrides',()=>{
 assert.equal(roomCapacity({}),50);assert.equal(roomCapacity({NOOR_ROOM_CAPACITY:'100'}),100);assert.equal(roomCapacity({NOOR_ROOM_CAPACITY:'64'}),64);
 for(const value of ['999','0','-1','NaN','100junk'])assert.equal(roomCapacity({NOOR_ROOM_CAPACITY:value}),50);
});

test('Movement is coalesced for modern clients while legacy clients keep full state and prayer cannot be overwritten',async()=>{
 const {room,socket}=setup(),a=socket('a','u1'),b=socket('b','u2',{x:5});
 await room.webSocketMessage(a,JSON.stringify({type:'profile',motionProtocol:2,profile:{name:'a'}}));a.messages.length=b.messages.length=0;
 await room.webSocketMessage(a,JSON.stringify({type:'move',x:.1,z:0,yaw:0,seq:1}));
 await room.webSocketMessage(a,JSON.stringify({type:'move',x:.2,z:0,yaw:0,seq:2}));
 assert.equal(a.messages.length,0);room.flushMovement();
 assert.equal(a.messages.length,1);assert.equal(a.messages[0].type,'motion');assert.equal(a.messages[0].players[0][1],2);
 assert.equal(b.messages[0].type,'state');assert.equal(b.messages[0].player.profile.name,'a');
 await room.webSocketMessage(a,JSON.stringify({type:'move',x:.2,z:0,seq:3}));
 await room.webSocketMessage(a,JSON.stringify({type:'prayer',active:true,pose:'bowing'}));assert.equal(room.pendingMoves.size,0);assert.equal(a.messages.at(-1).player.praying,true);
});

test('Every prayer area is protected without payment or friend exceptions; prayer stops release it',async()=>{
 const {room,socket,access}=setup(),host=socket('host','u1'),guest=socket('guest','u2',{x:1.5,z:-1,lastMove:Date.now()-250});
 access.u1.friends=['u2'];await room.webSocketMessage(host,JSON.stringify({type:'prayer',active:true}));assert.equal(host.deserializeAttachment().protected,true);
 await room.webSocketMessage(guest,JSON.stringify({type:'move',x:.6,z:-1}));assert.equal(guest.deserializeAttachment().x,1.5);
 await room.webSocketMessage(host,JSON.stringify({type:'prayer',active:false}));
 const state=guest.deserializeAttachment();state.lastMove=Date.now()-250;guest.serializeAttachment(state);
 await room.webSocketMessage(guest,JSON.stringify({type:'move',x:.6,z:-1}));assert.ok(guest.deserializeAttachment().x<1.5);
 room.flushMovement();
});
test('Prayer blocks public chat, whispers and greetings in both directions and preserves chat preferences',async()=>{
 const {room,socket,access}=setup(),a=socket('a','u1'),b=socket('b','u2',{x:5}),c=socket('c','u3',{x:10});
 await room.webSocketMessage(a,JSON.stringify({type:'prayer',active:true}));for(const ws of [a,b,c])ws.messages.length=0;
 await room.webSocketMessage(b,JSON.stringify({type:'chat',text:'quiet'}));assert.equal(a.messages.length,0);assert.equal(c.messages.filter(m=>m.type==='chat').length,1);
 const bs=b.deserializeAttachment();bs.chatAt=0;b.serializeAttachment(bs);
 await room.webSocketMessage(b,JSON.stringify({type:'whisper',to:'u1',text:'quiet'}));assert.equal(a.messages.length,0);
 await room.webSocketMessage(a,JSON.stringify({type:'chat',text:'forged'}));assert.equal(c.messages.some(m=>m.text==='forged'),false);
 await room.webSocketMessage(b,JSON.stringify({type:'greeting'}));assert.equal(a.messages.length,0);assert.equal(c.messages.filter(m=>m.type==='greeting').length,1);
 await room.webSocketMessage(a,JSON.stringify({type:'greeting'}));assert.equal(c.messages.filter(m=>m.type==='greeting').length,1);
 await room.webSocketMessage(a,JSON.stringify({type:'prayer',active:false}));
 const bs2=b.deserializeAttachment();bs2.chatAt=0;b.serializeAttachment(bs2);
 await room.webSocketMessage(b,JSON.stringify({type:'chat',text:'resumed'}));assert.ok(a.messages.some(m=>m.text==='resumed'));assert.equal(access.u1.publicChat,undefined);
});
test('Prayer entry rejects occupied mats; gestures are bounded, private from blocked visitors, and rate limited',async()=>{
 const {room,socket,access}=setup(),a=socket('a','u1'),b=socket('b','u2',{x:0,z:-1}),c=socket('c','u3',{x:6});
 await room.webSocketMessage(a,JSON.stringify({type:'prayer',active:true,pose:'dancing'}));assert.equal(a.deserializeAttachment().praying,false);assert.ok(a.messages.some(m=>m.type==='notice'));
 access.u3.blocked=['u1'];await room.webSocketMessage(a,JSON.stringify({type:'greeting',text:'forged',accountId:'u3'}));
 const greeting=b.messages.find(m=>m.type==='greeting');assert.equal(greeting.accountId,'u1');assert.equal(greeting.text,undefined);assert.equal(c.messages.some(m=>m.type==='greeting'),false);
 await room.webSocketMessage(a,JSON.stringify({type:'greeting'}));assert.equal(b.messages.filter(m=>m.type==='greeting').length,1);
});

test('Directed greetings face the chosen visitor and cannot target blocked, absent or praying accounts',async()=>{
 const {room,socket,access}=setup(),a=socket('a','u1'),b=socket('b','u2',{x:5}),c=socket('c','u3',{x:10});
 await room.webSocketMessage(a,JSON.stringify({type:'greeting',to:'u2',accountId:'u3'}));
 const event=b.messages.find(m=>m.type==='greeting');assert.equal(event.accountId,'u1');assert.equal(event.to,'u2');assert.equal(event.targetPlayerId,'b');
 assert.ok(Math.abs(a.deserializeAttachment().yaw+Math.PI/2)<1e-8,'Face target at positive X');
 const reset=()=>{const state=a.deserializeAttachment();state.greetingAt=0;a.serializeAttachment(state);for(const ws of [a,b,c])ws.messages.length=0;};
 reset();access.u2.blocked=['u1'];await room.webSocketMessage(a,JSON.stringify({type:'greeting',to:'u2'}));assert.equal(b.messages.some(m=>m.type==='greeting'),false);
 reset();access.u2.blocked=[];const bs=b.deserializeAttachment();bs.praying=true;b.serializeAttachment(bs);await room.webSocketMessage(a,JSON.stringify({type:'greeting',to:'u2'}));assert.equal(c.messages.some(m=>m.type==='greeting'),false);
 reset();await room.webSocketMessage(a,JSON.stringify({type:'greeting',to:'absent'}));assert.equal(c.messages.some(m=>m.type==='greeting'),false);
});
