import test from 'node:test';import assert from 'node:assert/strict';
import {PrayerRoom} from '../worker.js';
import {nextCongregation,FOLLOW_DELAY} from '../public/congregation-core.js';
import {LANGUAGES} from '../public/i18n.js';
import {CONGREGATION_KEYS,CONGREGATION_LOCALES} from '../public/congregation-i18n.js';

function setup(){
 const data=new Map(),sockets=[],pending=[],env={};let scheduled=null,now=Date.parse('2026-11-07T01:00:00Z');
 const storage={get:async key=>structuredClone(data.get(key)),put:async(key,value)=>data.set(key,structuredClone(value)),setAlarm:async at=>{scheduled=at;},deleteAlarm:async()=>{scheduled=null;}};
 const ctx={storage,getWebSockets:()=>sockets,blockConcurrencyWhile:fn=>fn(),waitUntil:p=>pending.push(p)};
 const room=new PrayerRoom(ctx,env);room.congregation.now=()=>now;
 const session=nextCongregation('mecca',now);now=session.adhanAt+1000;
 const socket=id=>{let state={id,accountId:id,map:'mecca',x:45+(sockets.length%6)*4,z:30+Math.floor(sockets.length/6)*4,yaw:0,profile:{name:id},praying:false,pose:'standing',tokens:30,rateAt:Date.now(),lastMove:Date.now(),profileAt:0};const ws={messages:[],deserializeAttachment:()=>structuredClone(state),serializeAttachment:s=>{state=structuredClone(s);},send:s=>ws.messages.push(JSON.parse(s)),close(){}};sockets.push(ws);return ws;};
 return {room,ctx,env,socket,session,pending,get alarm(){return scheduled;},get now(){return now;},set now(value){now=value;}};
}
test('All supported languages include the congregation and audio controls with intact placeholders',()=>{
 const variables=s=>(s.match(/\{\w+\}/g)||[]).sort();
 for(const {code}of LANGUAGES){const labels=CONGREGATION_LOCALES[code];assert.equal(labels.length,CONGREGATION_KEYS.length,code);for(let i=0;i<labels.length;i++){assert.ok(labels[i].trim());assert.deepEqual(variables(labels[i]),variables(CONGREGATION_LOCALES.en[i]),code);if(code!=='ko')assert.equal(/[\uac00-\ud7a3]/.test(labels[i]),false);}}
});
test('Server seats, phase changes, hibernation recovery, completion and departure are authoritative',async()=>{
 const s=setup(),a=s.socket('a'),b=s.socket('b');await s.room.congregation.ensure('mecca');const id=s.room.congregation.session.id;
 for(const ws of [a,b])await s.room.webSocketMessage(ws,JSON.stringify({type:'congregation-join',id}));
 assert.equal(a.deserializeAttachment().congregationId,id);assert.notEqual(a.deserializeAttachment().congregationSeat,b.deserializeAttachment().congregationSeat);assert.equal(s.room.players().length,2,'The NPC is never counted as a real connection');assert.ok(s.alarm>s.now);
 const bow=s.session.steps.find(p=>p.key==='bow');s.now=bow.at+FOLLOW_DELAY;await s.room.alarm();assert.equal(a.deserializeAttachment().pose,'bowing');assert.equal(a.deserializeAttachment().praying,true);
 const restarted=new PrayerRoom(s.ctx,s.env);restarted.congregation.now=()=>s.now;await restarted.congregation.ensure('mecca');assert.equal(restarted.congregation.session.id,id);assert.equal(restarted.congregation.members().length,2);
 const previous=a.deserializeAttachment();await restarted.webSocketMessage(a,JSON.stringify({type:'prayer',active:false,pose:'standing',congregationId:'forged'}));assert.equal(a.deserializeAttachment().praying,true);assert.equal(a.deserializeAttachment().pose,'bowing');
 await restarted.webSocketMessage(a,JSON.stringify({type:'move',x:99,z:99,yaw:99}));assert.equal(a.deserializeAttachment().x,previous.x);
 const late=s.socket('late');await restarted.webSocketMessage(late,JSON.stringify({type:'congregation-join',id}));assert.equal(late.deserializeAttachment().congregationId,undefined);assert.equal(late.messages.at(-2).code,'closed');
 s.now=s.session.endsAt;await restarted.alarm();for(const ws of [a,b]){assert.equal(ws.deserializeAttachment().congregationId,null);assert.equal(ws.deserializeAttachment().praying,false);}assert.equal(restarted.protectedSockets.size,0);
 for(const ws of [a,b,late])restarted.webSocketClose(ws,1000);await Promise.all(s.pending);assert.equal(s.alarm,null);
});
test('Fifty unique places remain bounded and no visitor can force another visitor to join or leave',async()=>{
 const s=setup();await s.room.congregation.ensure('mecca');const id=s.room.congregation.session.id,peers=Array.from({length:50},(_,i)=>s.socket('p'+i));
 for(const ws of peers)await s.room.webSocketMessage(ws,JSON.stringify({type:'congregation-join',id,playerId:'someone-else',seat:0,x:999}));
 assert.equal(new Set(peers.map(ws=>ws.deserializeAttachment().congregationSeat)).size,50);
 const other=peers[1].deserializeAttachment();await s.room.webSocketMessage(peers[0],JSON.stringify({type:'congregation-leave',playerId:other.id}));assert.equal(peers[0].deserializeAttachment().congregationId,null);assert.equal(peers[1].deserializeAttachment().congregationId,id);
});
test('Test clock changes are disabled in production',async()=>{
 const s=setup(),ws=s.socket('a');await s.room.webSocketMessage(ws,JSON.stringify({type:'congregation-test-start'}));assert.equal(s.room.congregation.testAnchor,null);assert.equal(s.room.congregation.session,null);
});
