import {CONGREGATION_VENUES,congregationDay,nextCongregation,makeCongregation,congregationPhase,congregationSeat,FOLLOW_DELAY} from './public/congregation-core.js';
import {MAPS,legalPosition,canBeginPrayer,publicPlayer,prayerAreaAllows} from './public/core.js';

export class RoomCongregation{
 constructor(room){this.room=room;this.ctx=room.ctx;this.map=room.players()[0]?.state.map||null;this.session=null;this.day=null;this.alarmAt=null;this.lastPhase=null;this.testAnchor=null;this.now=()=>Date.now();}
 async ensure(map=this.map){
  if(!CONGREGATION_VENUES[map])return null;
  if(!this.storedMap||this.map!==map){await this.ctx.storage.put('congregation-map',map);this.map=map;this.storedMap=true;}
  const now=this.now(),day=congregationDay(map,now);
  if(this.room.env.NOOR_CONGREGATION_TEST_MODE==='1'&&this.testAnchor===null)this.testAnchor=await this.ctx.storage.get('congregation-test-anchor')||0;
  if(this.testAnchor){this.session=makeCongregation(map,'fajr',this.testAnchor,{scale:.2});this.session.scale=.2;}
  else if(!this.session||this.session.closesAt<=now||this.day!==day){this.session=nextCongregation(map,now);this.day=day;}
  await this.schedule();return this.session;
 }
 members(){return this.room.players().filter(p=>p.state.congregationId===this.session?.id);}
 snapshot(clientSent){
  const session=this.session;if(!session)return null;
  return {type:'congregation-state',map:this.map,serverNow:this.now(),prayer:session.prayer,adhanAt:session.adhanAt,scale:session.scale||1,participants:this.members().map(p=>p.state.id),...(Number.isFinite(clientSent)?{clientSent}:{})};
 }
 async schedule(){
  const s=this.session;if(!s)return;
  const now=this.now(),boundaries=[s.adhanAt,s.adhanEndsAt,s.startsAt,s.endsAt,s.closesAt,...s.steps.flatMap(p=>[p.at,p.at+FOLLOW_DELAY])];
  const next=boundaries.filter(at=>at>now+5).sort((a,b)=>a-b)[0];
  if(next&&next!==this.alarmAt){await this.ctx.storage.setAlarm(Math.ceil(next));this.alarmAt=next;}
 }
 joiningOpen(now=this.now()){const s=this.session;return !!s&&now>=s.adhanAt&&now<s.steps.find(p=>p.key==='bow').at;}
 async synchronize({broadcast=false}={}){
  if(!this.map)return;
  await this.ensure();const s=this.session,now=this.now(),phase=congregationPhase(s,now,{follower:true});
  const key=s.id+':'+phase.key+':'+phase.rakah;
  if(this.lastPhase!==key){
   for(const peer of this.room.players())if((peer.state.congregationId&&peer.state.congregationId!==s.id)||(peer.state.congregationId===s.id&&now>=s.endsAt))this.release(peer.ws,peer.state);
   for(const {ws,state}of this.members()){
    const praying=now>=s.startsAt&&now<s.endsAt;state.praying=praying;state.protected=praying;state.pose=praying?phase.pose:'standing';state.lastMove=now;
    if(praying){this.room.protectedSockets.add(ws);this.room.parties.silence(ws,state);}else this.room.protectedSockets.delete(ws);
    ws.serializeAttachment(state);this.room.pendingMoves.delete(state.id);this.room.broadcast({type:'state',player:publicPlayer(state)});
   }
   this.lastPhase=key;broadcast=true;
  }
  if(broadcast)this.room.broadcast(this.snapshot());
 }
 exitPosition(state){
  const base=state.congregationReturn||MAPS[state.map].spawn,peers=this.room.players().filter(p=>p.state.id!==state.id&&!p.state.congregationId);
  for(let n=0;n<120;n++){
   const origin=n===0?base:MAPS[state.map].spawn,x=origin.x+(n?((n-1)%10)*2.5:0),z=origin.z+(n?Math.floor((n-1)/10)*3:0);
   if(legalPosition(x,z,state.map)&&peers.every(p=>Math.hypot(x-p.state.x,z-p.state.z)>.9&&(!p.state.praying||prayerAreaAllows(state,{x,z},p.state))))return {x,z};
  }
  return MAPS[state.map].spawn;
 }
 release(ws,state){
  const exit=this.exitPosition(state);Object.assign(state,exit,{praying:false,protected:false,pose:'standing',congregationId:null,lastMove:this.now()});delete state.congregationSeat;delete state.congregationReturn;
  this.room.protectedSockets.delete(ws);this.room.pendingMoves.delete(state.id);ws.serializeAttachment(state);this.room.broadcast({type:'state',player:publicPlayer(state)});
 }
 async handle(ws,state,data){
  if(data.type==='congregation-test-start'){
   if(this.room.env.NOOR_CONGREGATION_TEST_MODE!=='1')return;
   const anchor=this.now()+2000;await this.ctx.storage.put('congregation-test-anchor',anchor);this.testAnchor=anchor;this.lastPhase=null;await this.ensure(state.map||'mecca');await this.synchronize({broadcast:true});return;
  }
  await this.ensure(state.map||'mecca');await this.synchronize();state=ws.deserializeAttachment();if(!state)return;const s=this.session;
  if(data.type==='congregation-sync'){this.room.send(ws,this.snapshot(data.clientSent));return;}
  if(data.type==='congregation-leave'){
   if(state.congregationId)this.release(ws,state);this.room.broadcast(this.snapshot());return;
  }
  if(data.type!=='congregation-join')return;
  if(state.congregationId===s.id){this.room.send(ws,{type:'state',player:publicPlayer(state)});this.room.send(ws,this.snapshot());return;}
  if(data.id!==s.id||!this.joiningOpen()){this.room.send(ws,{type:'congregation-error',code:'closed'});this.room.send(ws,this.snapshot());return;}
  const members=this.members(),used=new Set(members.map(p=>p.state.congregationSeat)),outside=this.room.players().filter(p=>p.state.id!==state.id&&p.state.congregationId!==s.id).map(p=>p.state);
  let seat,index;
  for(index=0;index<50;index++){const candidate=congregationSeat(this.map,index);if(!used.has(index)&&candidate&&canBeginPrayer({id:state.id,...candidate},outside,this.map)){seat=candidate;break;}}
  if(!seat){this.room.send(ws,{type:'congregation-error',code:'full'});return;}
  state.congregationReturn={x:state.x,z:state.z};state.congregationId=s.id;state.congregationSeat=index;Object.assign(state,{x:seat.x,z:seat.z,yaw:seat.yaw});
  const phase=congregationPhase(s,this.now(),{follower:true});state.praying=this.now()>=s.startsAt;state.protected=state.praying;state.pose=state.praying?phase.pose:'standing';state.lastMove=this.now();
  if(state.praying){this.room.protectedSockets.add(ws);this.room.parties.silence(ws,state);}else this.room.protectedSockets.delete(ws);
  ws.serializeAttachment(state);this.room.pendingMoves.delete(state.id);this.room.broadcast({type:'state',player:publicPlayer(state)});this.room.broadcast(this.snapshot());
 }
 allowsMovement(from,to){
  const s=this.session;if(!s||this.now()<s.startsAt||this.now()>=s.endsAt)return true;
  return prayerAreaAllows(from,to,{...CONGREGATION_VENUES[this.map].imam,yaw:CONGREGATION_VENUES[this.map].yaw});
 }
 async alarm(){
  this.alarmAt=null;this.map??=await this.ctx.storage.get('congregation-map');if(!this.room.players().length){await this.ctx.storage.deleteAlarm();return;}
  await this.synchronize();
 }
 async closed(){
  if(!this.map)return;if(!this.room.players().length){await this.ctx.storage.deleteAlarm();this.alarmAt=null;}else{await this.ensure();this.room.broadcast(this.snapshot());}
 }
}
