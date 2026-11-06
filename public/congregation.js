import {t,currentLanguage} from './i18n.js';
import {congregationText as g} from './congregation-i18n.js';
import {CONGREGATION_VENUES,makeCongregation,congregationPhase,PRAYER_RAKAHS} from './congregation-core.js';
import {PRAYER_NAMES} from './prayer-times-core.js';
import {sanitizeProfile,prayerAreaAllows} from './core.js';
import {AdhanAudio} from './adhan-audio.js';

export class CongregationUI{
 constructor({scene,network,sound,toast,onModeChange}){
  Object.assign(this,{scene,network,sound,toast,onModeChange});this.session=null;this.offset=0;this.clockReady=false;this.lastSync=0;this.joinedId=null;this.imam=null;this.dismissedId=null;
  this.adhan=new AdhanAudio({onChange:()=>this.render(),onPlaying:playing=>{sound.adhanPlaying=playing;sound.applyMix();}});
  const $=id=>document.getElementById(id);this.$=$;
  $('togetherButton').addEventListener('click',()=>{this.render();$('congregationDialog').showModal();this.sync();});
  $('congregationJoin').addEventListener('click',()=>this.joinedId?this.leave():this.join());
  $('congregationNoticeJoin').addEventListener('click',()=>{if(this.joinedId)this.leave();else if(this.joiningOpen())this.join();else $('congregationDialog').showModal();});
  $('congregationNoticeSound').addEventListener('click',()=>void this.enableSound());
  $('congregationEnableSound').addEventListener('click',()=>void this.enableSound());
  $('congregationAdhanToggle').addEventListener('change',e=>{if(e.target.checked)void this.enableSound();else this.adhan.setEnabled(false);});
  $('congregationDismiss').addEventListener('click',()=>{this.dismissedId=this.session?.id;this.render();});
  window.addEventListener('languagechange',()=>this.render());
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){this.sync();this.render();}});
  scene.updateCongregation=(dt,time)=>this.frame(dt,time);
  scene.congregationPose=a=>this.session&&a.congregationId===this.session.id&&this.followerPhase?this.followerPhase:null;
  scene.congregationAllows=(from,to)=>!this.activePrayer()||prayerAreaAllows(from,to,{...CONGREGATION_VENUES[scene.mapId].imam,yaw:CONGREGATION_VENUES[scene.mapId].yaw});
  this.timer=setInterval(()=>this.render(),500);this.render();
 }
 now(){return Date.now()+this.offset;}
 sync(){if(!this.network.selfId)return;this.lastSync=Date.now();this.network.send({type:'congregation-sync',clientSent:this.lastSync});}
 message(message){
  if(message.type==='congregation-error'){this.toast(g(message.code==='full'?'full':'closed'));this.sync();return;}
  if(message.map!==this.scene.mapId||!Number.isFinite(message.adhanAt)||!Number.isFinite(message.serverNow))return;
  const received=Date.now();
  if(Number.isFinite(message.clientSent)){this.offset=message.serverNow-(message.clientSent+received)/2;this.clockReady=true;}
  else if(!this.clockReady)this.offset=message.serverNow-received;
  this.session=makeCongregation(message.map,message.prayer,message.adhanAt,{scale:message.scale||1});this.participants=Array.isArray(message.participants)?message.participants:[];
  if(!message.clientSent&&received-this.lastSync>30000)this.sync();this.render();
 }
 joiningOpen(){const s=this.session,now=this.now();return !!s&&!!this.network.selfId&&now>=s.adhanAt&&now<s.steps.find(step=>step.key==='bow').at;}
 activePrayer(){return !!this.session&&this.session.map===this.scene.mapId&&this.now()>=this.session.startsAt&&this.now()<this.session.endsAt;}
 join(){
  if(!this.joiningOpen()){this.toast(g('closed'));return;}
  this.network.send({type:'congregation-join',id:this.session.id});if(this.adhan.enabled)void this.enableSound();this.$('congregationDialog').close();
 }
 leave(){this.network.send({type:'congregation-leave'});}
 async enableSound(){try{await this.adhan.enable();this.maybeAdhan();}catch{this.toast(g('soundOff'));}this.render();}
 maybeAdhan(){const s=this.session,now=this.now();if(s&&now>=s.adhanAt&&now<s.adhanEndsAt&&!this.sound.praying)void this.adhan.play({id:s.prayer+':'+s.adhanAt,at:s.adhanAt,now});}
 self(player){
  const wasJoined=!!this.joinedId;if(!player.congregationId&&!wasJoined)return false;
  this.joinedId=player.congregationId||null;this.scene.congregationJoined=!!this.joinedId;this.scene.position={x:player.x,z:player.z};this.scene.yaw=player.yaw;this.scene.protected=player.protected;this.scene.keys.clear();this.scene.direction.clear();this.scene.resetJoystick?.();
  this.setMode(!!player.praying,player.pose,true);return true;
 }
 setMode(active,pose,force=false){
  const changed=this.scene.praying!==active||this.scene.pose!==pose;this.scene.praying=active;this.scene.pose=pose;this.scene.protected=active;
  if(changed||force){if(active){this.adhan.stop();this.scene.cancelGreeting();}this.onModeChange(active);this.render();}
 }
 ensureImam(){
  if(this.imam)return this.imam;
  const a=this.scene.makeAvatar(sanitizeProfile({model:'model03',name:'Imam NPC',gender:'male'}));a.root.visible=false;a.label.visible=false;a.rug.visible=a.fringe.visible=false;
  this.scene.scene.add(a.root);a.human.ready.catch(()=>{});this.imam=a;return a;
 }
 frame(dt,time){
  const s=this.session,now=this.now();this.followerPhase=s?congregationPhase(s,now,{follower:true}):null;
  if(this.joinedId&&s?.id===this.joinedId){const phase=this.followerPhase;this.setMode(now>=s.startsAt&&now<s.endsAt,phase.pose);}
  if(!s||s.map!==this.scene.mapId||now<s.adhanAt-60000||now>=s.closesAt){if(this.imam){this.imam.root.visible=false;this.imam.label.visible=false;}return;}
  const a=this.ensureImam(),venue=CONGREGATION_VENUES[s.map],visible=now>=s.adhanAt&&a.human.loaded;
  a.root.visible=visible;a.label.visible=visible;if(!visible)return;
  a.root.position.set(venue.imam.x,0,venue.imam.z);a.root.rotation.y=venue.yaw;a.label.element.textContent=g('imam');a.label.element.title=g('imam');
  const phase=congregationPhase(s,now),praying=now>=s.startsAt;
  this.scene.applyPose(a,phase.pose,praying,time,false,dt);a.greetingLabel.visible=a.speechLabel.visible=false;
 }
 render(){
  const $=this.$,set=(id,text)=>{if($(id).textContent!==text)$(id).textContent=text;};
  for(const el of document.querySelectorAll('[data-congregation-label]'))el.textContent=g(el.dataset.congregationLabel);
  $('togetherButton').title=g('title');$('togetherButton').setAttribute('aria-label',g('title'));
  $('congregationDialog').querySelector('[data-close]').setAttribute('aria-label',t('닫기'));$('congregationDismiss').setAttribute('aria-label',t('닫기'));
  const s=this.session,now=this.now(),phase=congregationPhase(s,now),venue=CONGREGATION_VENUES[this.scene.mapId],active=s&&now>=s.adhanAt&&now<s.closesAt;
  if(this.sound.praying&&this.adhan.playing)this.adhan.stop();
  let status=g('waiting');
  if(s){
   const name=t(PRAYER_NAMES[s.prayer]);
   if(phase.key==='upcoming'){const time=new Intl.DateTimeFormat(currentLanguage(),{timeZone:venue.zone,weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(s.adhanAt));status=g('next',{name,time});}
   else status=g(phase.key==='adhan'?'adhan':phase.key==='gather'?'gather':phase.key==='complete'?'complete':'praying')+' · '+name;
  }
  set('congregationStatus',status);set('congregationMembers',g('members',{n:this.participants?.length||0}));set('congregationRakah',phase.rakah&&s?g('unit',{n:phase.rakah,total:PRAYER_RAKAHS[s.prayer]}):'');
  set('congregationVenueNote',g('venueNote',{city:t(venue.label)}));set('congregationJoin',g(this.joinedId?'leave':'join'));$('congregationJoin').disabled=!this.joinedId&&!this.joiningOpen();
  $('congregationAdhanToggle').checked=this.adhan.enabled;set('congregationEnableSound',g('enableSound'));$('congregationEnableSound').hidden=this.adhan.enabled&&this.adhan.unlocked;
  set('congregationSoundStatus',g(this.adhan.enabled&&this.adhan.unlocked?'soundReady':'soundOff'));
  $('congregationNotice').hidden=!active||this.dismissedId===s.id&&!this.joinedId;
  set('congregationNoticeTitle',g('title'));set('congregationNoticeText',status);set('congregationNoticeJoin',g(this.joinedId?'leave':this.joiningOpen()?'join':'title'));
  $('congregationNoticeSound').hidden=!this.adhan.enabled||this.adhan.unlocked||phase.key!=='adhan';set('congregationNoticeSound',g('enableSound'));this.maybeAdhan();
 }
 reset(){
  if(this.joinedId){this.joinedId=null;this.scene.congregationJoined=false;this.setMode(false,'standing',true);}
  if(this.imam){this.scene.disposeAvatar(this.imam);this.imam=null;}this.session=null;this.participants=[];this.clockReady=false;this.lastSync=0;this.adhan.stop();this.render();
 }
 diagnostics(){return {session:this.session,joined:!!this.joinedId,phase:congregationPhase(this.session,this.now()),follower:congregationPhase(this.session,this.now(),{follower:true}),participants:this.participants?.length||0,clockOffset:this.offset,imamReady:!!this.imam?.human.loaded,adhan:{enabled:this.adhan.enabled,unlocked:this.adhan.unlocked,playing:this.adhan.playing,lastId:this.adhan.lastId}};}
}
