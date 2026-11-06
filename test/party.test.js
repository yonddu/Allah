import test from 'node:test';import assert from 'node:assert/strict';import {PrayerRoom} from '../worker.js';
function setup(n=8){
 const sockets=[],access={},ctx={getWebSockets:()=>sockets,blockConcurrencyWhile:fn=>fn()};
 const env={COMMUNITY:{idFromName:x=>x,get:()=>({fetch:async()=>Response.json(access)})}},room=new PrayerRoom(ctx,env);
 for(let i=0;i<n;i++){let data={id:'p'+i,accountId:'u'+i,profile:{name:'Visitor '+i},x:i*4,z:8,yaw:0,praying:false,pose:'standing',tokens:30,rateAt:Date.now(),lastMove:Date.now()-250};const ws={messages:[],deserializeAttachment:()=>structuredClone(data),serializeAttachment:s=>data=structuredClone(s),send:x=>ws.messages.push(JSON.parse(x)),close:()=>{}};sockets.push(ws);access['u'+i]={id:'u'+i,premium:false,friends:[],blocked:[]};}
 const send=async(i,data)=>{const state=sockets[i].deserializeAttachment();state.tokens=30;state.partyInviteAt=0;sockets[i].serializeAttachment(state);await room.webSocketMessage(sockets[i],JSON.stringify(data));};
 const join=async(i)=>{await send(0,{type:'party-invite',to:'p'+i});const invite=sockets[i].messages.findLast(m=>m.type==='party-invite')?.invite;assert.ok(invite);await send(i,{type:'party-accept',inviteId:invite.id});};
 return {room,sockets,access,ctx,env,send,join};
}
test('Party invitations require consent; membership is private and survives hibernation',async()=>{
 const s=setup();await s.send(0,{type:'party-create'});const id=s.sockets[0].deserializeAttachment().partyId;
 assert.ok(id);assert.equal(s.sockets[1].messages.length,0);await s.send(1,{type:'party-accept',inviteId:'forged'});assert.equal(s.sockets[1].deserializeAttachment().partyId,undefined);
 await s.join(1);assert.equal(s.sockets[1].deserializeAttachment().partyId,id);assert.equal(s.sockets[2].messages.length,0);
 const restarted=new PrayerRoom(s.ctx,s.env);restarted.parties.state(s.sockets[1]);assert.equal(s.sockets[1].messages.at(-1).party.members.length,2);
});
test('Party cap, leader-only removal, leave and disconnect are authoritative',async()=>{
 const s=setup();await s.send(0,{type:'party-create'});for(let i=1;i<=5;i++)await s.join(i);
 assert.equal(s.room.parties.members(s.sockets[0].deserializeAttachment().partyId).length,6);
 await s.send(0,{type:'party-invite',to:'p6'});assert.ok(s.sockets[0].messages.some(m=>m.type==='party-error'&&m.code==='full'));
 await s.send(1,{type:'party-kick',to:'p2'});assert.ok(s.sockets[2].deserializeAttachment().partyId);
 await s.send(0,{type:'party-kick',to:'p2'});assert.equal(s.sockets[2].deserializeAttachment().partyId,null);
 await s.send(0,{type:'party-leave'});assert.equal(s.sockets[1].messages.at(-1).party.leaderId,'p1');
 s.room.webSocketClose(s.sockets[1],1000);assert.equal(s.sockets[3].messages.findLast(m=>m.type==='party-state').party.members.some(m=>m.id==='p1'),false);
});
test('Audio signaling is limited to consenting voice members and never broadcasts SDP',async()=>{
 const s=setup();await s.join(1);await s.send(0,{type:'party-voice',enabled:true,epoch:'a'});await s.send(1,{type:'party-voice',enabled:true,epoch:'b'});
 const offer={type:'voice-signal',to:'p1',from:'p7',description:{type:'offer',sdp:'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n'}};
 await s.send(0,offer);const m=s.sockets[1].messages.findLast(m=>m.type==='voice-signal');assert.equal(m.from,'p0');assert.equal(m.epoch,'a');assert.equal(m.recipientEpoch,'b');
 assert.equal(s.sockets[2].messages.some(m=>m.type==='voice-signal'),false);
 const count=s.sockets[1].messages.filter(m=>m.type==='voice-signal').length;await s.send(2,offer);assert.equal(s.sockets[1].messages.filter(m=>m.type==='voice-signal').length,count);
 s.access.u1.blocked=['u0'];await s.send(0,offer);assert.equal(s.sockets[1].messages.filter(m=>m.type==='voice-signal').length,count);
 s.access.u1.blocked=[];await s.send(0,{type:'prayer',active:true});assert.equal(s.sockets[0].deserializeAttachment().voiceReady,false);await s.send(0,offer);assert.equal(s.sockets[1].messages.filter(m=>m.type==='voice-signal').length,count);
 assert.equal(s.room.parties.authorize('u1','p0'),false);assert.equal(s.room.parties.authorize('u1','p1'),true);assert.equal(s.room.parties.authorize('u1','p1'),false);
});
test('Blocked or praying visitors cannot be invited and forged SDP/video is rejected',async()=>{
 const s=setup();s.access.u1.blocked=['u0'];await s.send(0,{type:'party-invite',to:'p1'});assert.equal(s.sockets[1].messages.length,0);
 s.access.u1.blocked=[];await s.join(1);await s.send(0,{type:'party-voice',enabled:true,epoch:'a'});await s.send(1,{type:'party-voice',enabled:true,epoch:'b'});
 await s.send(0,{type:'voice-signal',to:'p1',description:{type:'offer',sdp:'m=video 9 UDP/TLS/RTP/SAVPF 100\r\n'}});assert.equal(s.sockets[1].messages.some(m=>m.type==='voice-signal'),false);
});
