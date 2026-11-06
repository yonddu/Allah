import test from 'node:test';
import assert from 'node:assert/strict';
import {RoomConnection} from '../public/network.js';

test('Leaving a page sends only its own leave beacon, clears state and prevents late reconnections',async()=>{
 const previousSocket=globalThis.WebSocket,previousLocation=globalThis.location,nav=Object.getOwnPropertyDescriptor(globalThis,'navigator'),oldFetch=globalThis.fetch;
 const sockets=[],beacons=[],fallback=[];
 class Socket{static OPEN=1;readyState=1;constructor(){sockets.push(this);}send(){}close(code){this.closed=code;}}
 globalThis.WebSocket=Socket;globalThis.location={href:'https://noor.example/',protocol:'https:'};
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{sendBeacon:(url,body)=>{beacons.push({url,body});return true;}}});
 globalThis.fetch=(url,options)=>{fallback.push({url,options});return Promise.resolve(new Response(null,{status:204}));};
 try{
  const received=[],connection=new RoomConnection({status(){},clear(){},welcome(){},profile:()=>({}),count(){},recount(){},player:p=>received.push(p)});
  connection.connect('taj:2');const oldMessage=sockets[0].onmessage;
  oldMessage({data:JSON.stringify({type:'welcome',id:'own-player',self:{id:'own-player'},players:[]})});
  connection.pending.set(1,{x:0,z:0});connection.disconnect({notify:true,suspend:true});
  assert.equal(beacons[0].url,'/api/leave');assert.deepEqual(JSON.parse(await beacons[0].body.text()),{room:'taj:2',player:'own-player'});
  assert.equal(sockets[0].closed,1000);assert.equal(connection.socket,null);assert.equal(connection.selfId,null);assert.equal(connection.pending.size,0);assert.equal(connection.known.size,0);
  oldMessage({data:JSON.stringify({type:'join',player:{id:'stale'}})});assert.deepEqual(received,[]);
  assert.equal(connection.connect(),false);assert.equal(sockets.length,1);
  connection.resume();connection.connect();assert.equal(sockets.length,2);
  sockets[1].onmessage({data:JSON.stringify({type:'welcome',id:'next-player',self:{id:'next-player'},players:[]})});
  globalThis.navigator.sendBeacon=()=>false;connection.disconnect({notify:true});assert.equal(fallback.length,1);assert.equal(fallback[0].options.keepalive,true);assert.deepEqual(JSON.parse(fallback[0].options.body),{room:'taj:2',player:'next-player'});
 }finally{globalThis.WebSocket=previousSocket;globalThis.location=previousLocation;globalThis.fetch=oldFetch;if(nav)Object.defineProperty(globalThis,'navigator',nav);else delete globalThis.navigator;}
});

test('A retry queued before page exit cannot reopen a suspended connection',()=>{
 const oldSocket=globalThis.WebSocket,oldLocation=globalThis.location,oldSet=globalThis.setTimeout,oldClear=globalThis.clearTimeout;let retry;const sockets=[];
 class Socket{static OPEN=1;constructor(){sockets.push(this);}close(){}}
 globalThis.WebSocket=Socket;globalThis.location={href:'https://noor.example/',protocol:'https:'};globalThis.setTimeout=fn=>{retry=fn;return 1;};globalThis.clearTimeout=()=>{};
 try{const connection=new RoomConnection({status(){},clear(){}});connection.connect();sockets[0].onclose();assert.equal(typeof retry,'function');connection.disconnect({suspend:true});retry();assert.equal(sockets.length,1);}
 finally{globalThis.WebSocket=oldSocket;globalThis.location=oldLocation;globalThis.setTimeout=oldSet;globalThis.clearTimeout=oldClear;}
});
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
