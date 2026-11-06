import test from 'node:test';
import assert from 'node:assert/strict';
import {RoomConnection} from '../public/network.js';
test('Batched movement preserves model identity and self reconciliation, and ignores departed players',()=>{
 const previousSocket=globalThis.WebSocket,previousLocation=globalThis.location;const sockets=[];
 class Socket{static OPEN=1;readyState=1;sent=[];constructor(){sockets.push(this);}send(raw){this.sent.push(JSON.parse(raw));}close(){}}
 globalThis.WebSocket=Socket;globalThis.location={href:'https://noor.example/'};
 try{
  const visible=[],corrections=[];
  const connection=new RoomConnection({status(){},clear(){},welcome(){},profile:()=>({model:'model01'}),count(){},recount(){},player:p=>visible.push(p),self:p=>corrections.push(p),leave(){},notice(){},chat(){}});
  connection.connect();const socket=sockets[0],emit=message=>socket.onmessage({data:JSON.stringify(message)});
  emit({type:'welcome',id:'self',self:{id:'self',profile:{model:'model01'}},players:[{id:'peer',accountId:'other',profile:{model:'model08'}}]});
  assert.equal(socket.sent[0].motionProtocol,2);connection.movement({x:1,z:2},0);
  emit({type:'motion',players:[['self',1,1.1,2.2,0,0,0],['peer',3,4,5,1,2,1],['unknown',1,0,0,0,0,0]]});
  assert.equal(connection.pending.size,0);assert.ok(Math.abs(corrections[0].correction.x-.1)<1e-9);
  assert.equal(visible.at(-1).profile.model,'model08');assert.equal(visible.at(-1).accountId,'other');assert.equal(visible.at(-1).pose,'prostrating');
  emit({type:'leave',id:'peer'});const count=visible.length;emit({type:'motion',players:[['peer',4,0,0,0,0,0]]});assert.equal(visible.length,count);
 }finally{globalThis.WebSocket=previousSocket;globalThis.location=previousLocation;}
});
