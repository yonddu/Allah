import test from 'node:test';
import assert from 'node:assert/strict';
import worker,{PrayerRoom} from '../worker.js';
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
  await room.webSocketMessage(ws,JSON.stringify({type:'prayer',active:true,pose:'prostrating',premium:true}));const state=ws.deserializeAttachment();assert.equal(state.protected,false);assert.equal(state.yaw,0);
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
