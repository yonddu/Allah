import test from 'node:test';
import assert from 'node:assert/strict';
import {prayerYaw} from '../public/core.js';
import worker,{PrayerRoom,roomCapacity} from '../worker.js';
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
  await room.webSocketMessage(ws,JSON.stringify({type:'prayer',active:true,pose:'prostrating',premium:true}));const state=ws.deserializeAttachment();assert.equal(state.protected,false);assert.equal(state.yaw,prayerYaw('mecca',state));
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
 const {room,socket}=setup(),a=socket('a','u1'),b=socket('b','u2');
 await room.webSocketMessage(a,JSON.stringify({type:'profile',motionProtocol:2,profile:{name:'a'}}));a.messages.length=b.messages.length=0;
 await room.webSocketMessage(a,JSON.stringify({type:'move',x:.1,z:0,yaw:0,seq:1}));
 await room.webSocketMessage(a,JSON.stringify({type:'move',x:.2,z:0,yaw:0,seq:2}));
 assert.equal(a.messages.length,0);room.flushMovement();
 assert.equal(a.messages.length,1);assert.equal(a.messages[0].type,'motion');assert.equal(a.messages[0].players[0][1],2);
 assert.equal(b.messages[0].type,'state');assert.equal(b.messages[0].player.profile.name,'a');
 await room.webSocketMessage(a,JSON.stringify({type:'move',x:.2,z:0,seq:3}));
 await room.webSocketMessage(a,JSON.stringify({type:'prayer',active:true,pose:'bowing'}));assert.equal(room.pendingMoves.size,0);assert.equal(a.messages.at(-1).player.praying,true);
});
