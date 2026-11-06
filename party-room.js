export const PARTY_CAPACITY=6;
const snapshot=members=>({id:members[0].state.partyId,leaderId:[...members].sort((a,b)=>(a.state.partyJoined-b.state.partyJoined)||a.state.id.localeCompare(b.state.id))[0].state.id,members:members.map(p=>({id:p.state.id,accountId:p.state.accountId,name:p.state.profile.name,voiceReady:!!p.state.voiceReady&&!p.state.praying,epoch:p.state.voiceEpoch||'',praying:!!p.state.praying}))});
export class RoomParties{
 constructor(room){this.room=room;}
 members(id,except){return id?this.room.players().filter(p=>p.ws!==except&&p.state.partyId===id):[];}
 state(ws){const state=ws.deserializeAttachment(),members=this.members(state?.partyId);this.room.send(ws,{type:'party-state',party:members.length?snapshot(members):null});}
 publish(id,except){const members=this.members(id,except);if(!members.length)return;const message={type:'party-state',party:snapshot(members)};for(const p of members)this.room.send(p.ws,message);}
 error(ws,code){this.room.send(ws,{type:'party-error',code});}
 async handle(ws,state,data){
  const room=this.room,now=Date.now(),save=()=>ws.serializeAttachment(state);
  if(data.type==='party-create'){
   if(!state.partyId){state.partyId=crypto.randomUUID();state.partyJoined=now;state.voiceReady=false;save();}this.state(ws);return;
  }
  if(data.type==='party-sync'){save();this.state(ws);return;}
  if(data.type==='party-invite'){
   if(now-(state.partyInviteAt||0)<1500){save();return;}
   const peers=room.players(),target=peers.find(p=>p.state.id===data.to&&p.state.accountId!==state.accountId);
   if(state.praying||!target||target.state.praying||target.state.partyId){save();this.error(ws,'unavailable');return;}
   const rights=await room.access([state.accountId,target.state.accountId]);
   if((rights[state.accountId]?.blocked||[]).includes(target.state.accountId)||(rights[target.state.accountId]?.blocked||[]).includes(state.accountId)){save();this.error(ws,'unavailable');return;}
   if(!state.partyId){state.partyId=crypto.randomUUID();state.partyJoined=now;state.voiceReady=false;}
   if(this.members(state.partyId).length>=PARTY_CAPACITY){save();this.error(ws,'full');return;}
   state.partyInviteAt=now;save();
   const invite={id:crypto.randomUUID(),partyId:state.partyId,fromId:state.id,fromName:state.profile.name,expires:now+60000};
   target.state.partyInvites=[...(target.state.partyInvites||[]).filter(x=>x.expires>now&&x.partyId!==state.partyId).slice(-3),invite];target.ws.serializeAttachment(target.state);
   this.publish(state.partyId);room.send(target.ws,{type:'party-invite',invite});return;
  }
  if(data.type==='party-accept'||data.type==='party-decline'){
   const invite=(state.partyInvites||[]).find(x=>x.id===data.inviteId&&x.expires>now);
   state.partyInvites=(state.partyInvites||[]).filter(x=>x.id!==data.inviteId&&x.expires>now);save();
   if(data.type==='party-decline')return;
   const members=this.members(invite?.partyId),inviter=members.find(p=>p.state.id===invite?.fromId);
   if(!invite||!inviter||state.partyId||members.length>=PARTY_CAPACITY||members.some(p=>p.state.accountId===state.accountId)){this.error(ws,'unavailable');return;}
   const rights=await room.access([state.accountId,...members.map(p=>p.state.accountId)]);
   if(members.some(p=>(rights[state.accountId]?.blocked||[]).includes(p.state.accountId)||(rights[p.state.accountId]?.blocked||[]).includes(state.accountId))){this.error(ws,'unavailable');return;}
   state.partyId=invite.partyId;state.partyJoined=now;state.partyInvites=[];state.voiceReady=false;save();this.publish(state.partyId);return;
  }
  if(data.type==='party-leave'){
   const id=state.partyId;state.partyId=null;state.voiceReady=false;state.voiceEpoch='';save();this.state(ws);this.publish(id);return;
  }
  if(data.type==='party-kick'){
   const members=this.members(state.partyId),party=members.length?snapshot(members):null,target=members.find(p=>p.state.id===data.to&&p.ws!==ws);
   if(!party||party.leaderId!==state.id||!target){save();return;}
   target.state.partyId=null;target.state.voiceReady=false;target.state.voiceEpoch='';target.ws.serializeAttachment(target.state);this.state(target.ws);save();this.publish(state.partyId);return;
  }
  if(data.type==='party-voice'){
   if(!state.partyId){save();this.error(ws,'unavailable');return;}
   state.voiceReady=data.enabled===true&&!state.praying&&typeof data.epoch==='string'&&/^[a-zA-Z0-9-]{1,64}$/.test(data.epoch);
   state.voiceEpoch=state.voiceReady?data.epoch:'';save();this.publish(state.partyId);return;
  }
  if(data.type==='voice-signal'){
   save();const target=this.members(state.partyId).find(p=>p.state.id===data.to&&p.ws!==ws);
   if(!state.voiceReady||state.praying||!target?.state.voiceReady||target.state.praying)return;
   const description=data.description,ice=data.ice;
   if(description&&(!['offer','answer'].includes(description.type)||typeof description.sdp!=='string'||description.sdp.length>12000||/m=(?!audio )/.test(description.sdp)))return;
   if(ice&&(!Array.isArray(ice)||ice.length>12||ice.some(c=>!c||typeof c.candidate!=='string'||c.candidate.length>1500||typeof c.sdpMid!=='string'&&c.sdpMid!==null)))return;
   if(!description&&!ice)return;
   const rights=await room.access([state.accountId,target.state.accountId]);
   if((rights[state.accountId]?.blocked||[]).includes(target.state.accountId)||(rights[target.state.accountId]?.blocked||[]).includes(state.accountId))return;
   room.send(target.ws,{type:'voice-signal',from:state.id,partyId:state.partyId,epoch:state.voiceEpoch,recipientEpoch:target.state.voiceEpoch,...(description?{description:{type:description.type,sdp:description.sdp}}:{}),...(ice?{ice:ice.map(c=>({candidate:c.candidate,sdpMid:c.sdpMid,sdpMLineIndex:Number.isInteger(c.sdpMLineIndex)?c.sdpMLineIndex:null,usernameFragment:typeof c.usernameFragment==='string'?c.usernameFragment:null}))}:{})});return;
  }
  save();
 }
 silence(ws,state){state.voiceReady=false;state.voiceEpoch='';ws.serializeAttachment(state);if(state.partyId)this.publish(state.partyId);}
 closed(ws,state){if(state?.partyId)this.publish(state.partyId,ws);}
 authorize(accountId,playerId){
  const p=this.room.players().find(p=>p.state.id===playerId&&p.state.accountId===accountId&&p.state.partyId&&p.state.voiceReady&&!p.state.praying);
  if(!p)return false;const now=Date.now();if(now-(p.state.voiceIceAt||0)<25000)return false;p.state.voiceIceAt=now;p.ws.serializeAttachment(p.state);return true;
 }
}
