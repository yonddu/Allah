export class PartyVoice{
 constructor({send,configProvider,onChange=()=>{},onError=()=>{},blocked=()=>new Set(),mediaDevices=()=>navigator.mediaDevices,Peer=()=>RTCPeerConnection,AudioElement=()=>document.createElement('audio')}){
  Object.assign(this,{send,configProvider,onChange,onError,blocked,mediaDevices,Peer,AudioElement});this.party=null;this.selfId=null;this.stream=null;this.peers=new Map();this.epoch='';this.enabled=false;this.confirmed=false;this.praying=false;this.muted=false;this.volume=.8;this.generation=0;this.config=null;this.configPromise=null;this.retries=new Map();
 }
 async enable(){
  if(this.enabled||this.praying||!this.party)return false;const generation=++this.generation;
  try{
   const devices=this.mediaDevices();if(!devices?.getUserMedia)throw new Error('microphone');
   const stream=await devices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true,channelCount:1},video:false});
   if(generation!==this.generation||this.praying||!this.party){stream.getTracks().forEach(t=>t.stop());return false;}
   this.stream=stream;this.enabled=true;this.confirmed=false;this.muted=false;this.epoch=crypto.randomUUID();this.retries.clear();
   const ack=new Promise(resolve=>{this.ackResolve=resolve;this.ackTimer=setTimeout(()=>resolve(false),8000);});
   if(!this.send({type:'party-voice',enabled:true,epoch:this.epoch})){this.stop(false);return false;}this.onChange();
   if(!await ack||generation!==this.generation){this.stop();return false;}clearTimeout(this.ackTimer);this.ackResolve=null;
   await this.getConfig();if(generation!==this.generation||this.praying)return false;
   await this.reconcile();this.onChange();return true;
  }catch(error){if(generation===this.generation){this.stop();this.onError(error?.name==='NotAllowedError'||error?.message==='microphone'?'microphone':'connection');}return false;}
 }
 async getConfig(){
  if(this.config&&this.config.expiresAt>Date.now()+60000)return this.config;
  if(!this.configPromise)this.configPromise=Promise.resolve(this.configProvider()).then(c=>{if(!Array.isArray(c.iceServers))throw new Error('ice');this.config=c;return c;}).finally(()=>this.configPromise=null);
  return this.configPromise;
 }
 applyState(party,selfId){
  const changed=this.party?.id!==party?.id;if(changed)this.stop(false);this.party=party;this.selfId=selfId;
  const me=party?.members.find(m=>m.id===selfId);
  if(this.enabled&&me?.voiceReady&&me.epoch===this.epoch){this.confirmed=true;this.ackResolve?.(true);}
  else if(this.enabled&&this.confirmed)this.stop(false);
  this.reconcile().catch(()=>this.onError('connection'));this.onChange();
 }
 usable(member){return this.enabled&&this.confirmed&&!this.praying&&member&&this.party?.members.some(m=>m.id===member.id&&m.epoch===member.epoch)&&member.id!==this.selfId&&member.voiceReady&&!member.praying&&!this.blocked().has(member.accountId);}
 async reconcile(){
  if(!this.enabled||!this.confirmed||this.praying){for(const id of [...this.peers.keys()])this.closePeer(id);return;}
  for(const [id,entry]of this.peers){const member=this.party?.members.find(m=>m.id===id);if(!this.usable(member)||entry.epoch!==member.epoch)this.closePeer(id);}
  const config=await this.getConfig();if(!this.enabled||this.praying)return;
  for(const member of this.party?.members||[])if(this.usable(member)&&!this.peers.has(member.id)){
   const entry=this.ensurePeer(member,config);if(this.selfId.localeCompare(member.id)<0)this.offer(entry).catch(()=>this.onError('connection'));
  }
 }
 ensurePeer(member,config){
  let entry=this.peers.get(member.id);if(entry)return entry;
  const PC=this.Peer(),pc=new PC({iceServers:config.iceServers,iceTransportPolicy:config.relayOnly?'relay':'all',bundlePolicy:'max-bundle'});
  entry={id:member.id,epoch:member.epoch,pc,audio:null,ice:[],pendingIce:[],queue:Promise.resolve(),generation:this.generation};this.peers.set(member.id,entry);
  for(const track of this.stream.getAudioTracks()){const sender=pc.addTrack(track,this.stream);try{const p=sender.getParameters();p.encodings=[...(p.encodings?.length?p.encodings:[{}])];p.encodings[0].maxBitrate=32000;sender.setParameters(p).catch(()=>{});}catch{}}
  pc.onicecandidate=event=>{
   if(!event.candidate||!this.current(entry))return;entry.ice.push(event.candidate.toJSON());if(entry.iceTimer)return;
   entry.iceTimer=setTimeout(()=>{entry.iceTimer=null;while(entry.ice.length&&this.current(entry))this.send({type:'voice-signal',to:entry.id,ice:entry.ice.splice(0,10)});},40);
  };
  pc.ontrack=event=>{
   if(!this.current(entry))return;if(entry.audio){entry.audio.pause();entry.audio.srcObject=null;entry.audio.remove();}const audio=this.AudioElement();entry.audio=audio;audio.autoplay=true;audio.playsInline=true;audio.hidden=true;audio.volume=this.volume;audio.srcObject=event.streams[0]||new MediaStream([event.track]);document.body.append(audio);audio.play().catch(()=>{if(this.current(entry))this.onError('playback');});
  };
  pc.onconnectionstatechange=()=>{
   this.onChange();if(pc.connectionState==='failed'&&this.current(entry)){
    const count=this.retries.get(entry.id)||0;this.retries.set(entry.id,count+1);this.closePeer(entry.id);
    if(count<2)setTimeout(()=>this.reconcile().catch(()=>{}),1200);else this.onError('connection');
   }
  };
  return entry;
 }
 current(entry){return this.enabled&&!this.praying&&entry.generation===this.generation&&this.peers.get(entry.id)===entry&&this.usable(this.party?.members.find(m=>m.id===entry.id));}
 async offer(entry){
  if(!this.current(entry)||entry.pc.signalingState!=='stable'||entry.offering)return;entry.offering=true;
  try{await entry.pc.setLocalDescription(await entry.pc.createOffer());if(this.current(entry))this.send({type:'voice-signal',to:entry.id,description:{type:entry.pc.localDescription.type,sdp:entry.pc.localDescription.sdp}});}finally{entry.offering=false;}
 }
 async signal(message){
  const member=this.party?.members.find(m=>m.id===message.from);
  if(message.partyId!==this.party?.id||message.recipientEpoch!==this.epoch||member?.epoch!==message.epoch||!this.usable(member))return;
  const config=await this.getConfig();if(!this.usable(member))return;const entry=this.ensurePeer(member,config);
  entry.queue=entry.queue.then(async()=>{
   if(!this.current(entry))return;
   if(message.description){
    await entry.pc.setRemoteDescription(message.description);
    for(const candidate of entry.pendingIce.splice(0))await entry.pc.addIceCandidate(candidate);
    if(message.description.type==='offer'){await entry.pc.setLocalDescription(await entry.pc.createAnswer());if(this.current(entry))this.send({type:'voice-signal',to:entry.id,description:{type:entry.pc.localDescription.type,sdp:entry.pc.localDescription.sdp}});}
   }
   for(const candidate of message.ice||[]){if(entry.pc.remoteDescription)await entry.pc.addIceCandidate(candidate);else entry.pendingIce.push(candidate);}
  }).catch(()=>{if(this.current(entry))this.onError('connection');});
  return entry.queue;
 }
 closePeer(id){const entry=this.peers.get(id);if(!entry)return;this.peers.delete(id);clearTimeout(entry.iceTimer);entry.pc.ontrack=entry.pc.onicecandidate=entry.pc.onconnectionstatechange=null;entry.pc.close();if(entry.audio){entry.audio.pause();entry.audio.srcObject=null;entry.audio.remove();}}
 stop(notify=true){
  const wasEnabled=this.enabled;this.generation++;this.enabled=false;this.confirmed=false;this.ackResolve?.(false);this.ackResolve=null;clearTimeout(this.ackTimer);
  this.stream?.getTracks().forEach(track=>track.stop());this.stream=null;this.epoch='';for(const id of [...this.peers.keys()])this.closePeer(id);
  if(notify&&wasEnabled&&this.party)this.send({type:'party-voice',enabled:false});this.onChange();
 }
 setPrayer(active){if(this.praying===active)return;this.praying=active;if(active)this.stop();this.onChange();}
 setMuted(value){this.muted=!!value;for(const track of this.stream?.getAudioTracks()||[])track.enabled=!this.muted;this.onChange();}
 setVolume(value){this.volume=Math.max(0,Math.min(1,value));for(const p of this.peers.values())if(p.audio)p.audio.volume=this.volume;}
 resumeAudio(){for(const p of this.peers.values())p.audio?.play().catch(()=>{});}
 reset(){this.stop(false);this.party=null;this.selfId=null;this.config=null;this.onChange();}
 diagnostics(){return {partyId:this.party?.id||null,members:this.party?.members.length||0,voiceActive:this.enabled,micEnabled:this.enabled&&!this.muted,tracks:this.stream?.getTracks().map(t=>t.readyState)||[],connectedPeers:[...this.peers.values()].filter(p=>p.pc.connectionState==='connected').length,peerCount:this.peers.size};}
}
