import {initTasbih} from './tasbih.js';
import {initReminders} from './reminders.js';
import {t} from './i18n.js';
import {PLAY_CAMERA} from './camera.js';
import {DEFAULT_PROFILE,COLORS,sanitizeProfile,MAPS,parseRoom,canBeginPrayer} from './core.js';
import {Sanctuary} from './scene.js';
import {initPrayerTimes} from './prayer-times.js';
import {initLocation} from './location.js';
import {RoomConnection} from './network.js';
import {initPlayerMenu} from './player-menu.js';
import {initParty} from './party.js';
import {applyFeatureLabels,featureText as f} from './feature-labels.js';
import {recommendedRoom,visibleRooms,consolidationTarget} from './room-allocation.js';
import {initCommunity} from './social.js';
import {Soundscape} from './audio.js';
import {USER_MODELS} from './user-model-catalog.js';
import {thumbnailName} from './footwear.js';
import {CongregationUI} from './congregation.js';
import {congregationText as groupText} from './congregation-i18n.js';

const $=id=>document.getElementById(id);
let generatedName=false;
let toastTimer,profile=loadProfile(),savedRoom;
try{savedRoom=localStorage.getItem('noor-room');}catch{}
let currentRoom=parseRoom(savedRoom)?.key||'mecca:1',scene,network,community,playerMenu,partyUi,congregationUi;
let pageGeneration=0,pageLeaving=false;
let presence=null,presenceRequest=null,roomCount=0,entryBusy=false,preferBusyMap=!parseRoom(savedRoom);
const number=n=>new Intl.NumberFormat(document.documentElement.lang||'en').format(n);
function presenceText(key,n){return f(key).replace('{n}',number(n));}
function renderPresence(){
 const known=presence?.maps?.[parseRoom(currentRoom).map]?.rooms.find(r=>r.server===parseRoom(currentRoom).server)?.count||0;
 const total=Math.max(0,(presence?.total||0)+(network?.selfId?roomCount-known:0)),text='👥 '+number(total);
 if($('onlineCount').textContent!==text)$('onlineCount').textContent=text;
 $('onlineCount').title=presenceText('online',total)+' · '+presenceText('here',roomCount);$('onlineCount').setAttribute('aria-label',$('onlineCount').title);
}
function setRoomCount(n){roomCount=n;renderPresence();}
function removePresenceSelf(){
 const map=presence?.maps?.[parseRoom(currentRoom).map],room=map?.rooms.find(r=>r.server===parseRoom(currentRoom).server);
 if(room?.count>0){room.count--;map.total=Math.max(0,map.total-1);presence.total=Math.max(0,presence.total-1);}
}
async function refreshPresence({gather=false}={}){
 if(pageLeaving||document.hidden)return null;const generation=pageGeneration;
 try{
  presenceRequest??=fetch('/api/presence').then(r=>{if(!r.ok)throw new Error('Presence unavailable');return r.json();}).finally(()=>{presenceRequest=null;});
  const snapshot=await presenceRequest;if(pageLeaving||generation!==pageGeneration)return null;presence=snapshot;renderPresence();
  if(gather&&network?.selfId&&!entryBusy&&!scene.praying&&!scene.congregationJoined&&!scene.moving&&!partyUi?.diagnostics().partyId&&!$('customPanel').classList.contains('open')&&!document.querySelector('dialog[open]')&&!document.activeElement?.matches('input,textarea,[contenteditable=true]')){
   const room=parseRoom(currentRoom),target=consolidationTarget(presence.maps[room.map]?.rooms||[],room.server);
   if(target){
    removePresenceSelf();roomCount=0;
    network.disconnect({notify:true});currentRoom=room.map+':'+target.server;chosenMap=room.map;chosenServer=target.server;mapLabels();
    try{localStorage.setItem('noor-room',currentRoom);}catch{}
    network.connect(currentRoom);toast(f('gathered'));
   }
  }
  return presence;
 }catch{return null;}
}
function toast(message){
  $('toast').textContent=t(message);$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),4500);
}
function loadProfile(){try{const raw=JSON.parse(localStorage.getItem('noor-profile'));if(raw){const saved=sanitizeProfile(raw);if(saved.name===DEFAULT_PROFILE.name){generatedName=true;saved.name=t('방문자');}return saved;}}catch{}generatedName=true;return {...DEFAULT_PROFILE,name:t('방문자')};}
function persistProfile(){try{localStorage.setItem('noor-profile',JSON.stringify(profile));$('saveStatus').textContent='이 기기에 저장했습니다';}catch{$('saveStatus').textContent='이번 접속에서만 유지됩니다';}}
function openDialog(id){if(!$(id).open)$(id).showModal();}
function fatal(message){$('loading').hidden=true;$('fatal').hidden=false;if(message)$('fatalMessage').textContent=message;}
for(const button of document.querySelectorAll('[data-close]'))button.addEventListener('click',()=>button.closest('dialog').close());
try{
  scene=new Sanctuary($('scene'),profile,fatal,parseRoom(currentRoom).map);
}catch(e){console.error(e);fatal();throw e;}
const sound=new Soundscape(toast);
for(const [id,label]of [['characterChoices','캐릭터 유형'],['wardrobeChoices','기도 복장']])for(const item of USER_MODELS){
  const b=document.createElement('button');b.type='button';b.dataset.value=item.id;b.dataset.gender=item.gender;
  const preview=document.createElement('span');preview.className='model-thumb';preview.style.backgroundImage='url(/user-models/'+thumbnailName(item)+')';preview.setAttribute('aria-hidden','true');
  const text=document.createElement('span');text.textContent=String(item.index+1);b.append(preview,text);b.setAttribute('aria-label',t(label)+' '+(item.index+1));b.title=t(label)+' '+(item.index+1);$(id).append(b);
}
function updateChoices(){
  for(const b of document.querySelectorAll('[data-gender]'))b.hidden=b.dataset.gender!==profile.gender;
  for(const b of document.querySelectorAll('[data-field="cover"] button'))b.hidden=profile.gender==='female'&&b.dataset.value!=='hijab';
  $('femaleCoverNote').hidden=profile.gender!=='female';
  for(const b of document.querySelectorAll('[data-field] button')){
    const field=b.closest('[data-field]').dataset.field;b.setAttribute('aria-pressed',String(profile[field]===b.dataset.value));
  }
  for(const b of document.querySelectorAll('[data-swatch]'))b.setAttribute('aria-pressed',String(profile[b.dataset.swatch]===Number(b.dataset.value)));
}
let profileTimer;
function changedProfile(){
  profile=sanitizeProfile(profile);if(profile.name===DEFAULT_PROFILE.name){generatedName=true;profile.name=t('방문자');}scene.updateProfile(profile);persistProfile();updateChoices();
  clearTimeout(profileTimer);profileTimer=setTimeout(()=>{network?.send({type:'profile',profile});community?.updateName().catch(e=>toast(e.message));},450);
}
for(const [container,field,colors,names]of [
  ['skinChoices','skin',COLORS.skin,['밝은 살구','살구','브론즈','딥 브라운','다크 브라운']],
  ['robeChoices','color',COLORS.robe,['아이보리','에메랄드','미드나잇 블루','버건디','샌드 골드','차콜']],
  ['rugChoices','rug',COLORS.rug,['에메랄드','버건디','블루','샌드 골드','바이올렛']]
]){
  for(let i=0;i<colors.length;i++){
    const b=document.createElement('button');b.className='swatch';b.dataset.swatch=field;b.dataset.value=i;b.style.backgroundColor=colors[i];b.title=names[i];b.setAttribute('aria-label',names[i]);
    b.addEventListener('click',()=>{profile[field]=i;changedProfile();});$(container).append(b);
  }
}
for(const group of document.querySelectorAll('[data-field]'))for(const b of group.querySelectorAll('button'))b.addEventListener('click',()=>{profile[group.dataset.field]=b.dataset.value;changedProfile();});
$('displayName').value=profile.name;
let nameTimer;
$('displayName').addEventListener('input',()=>{generatedName=false;clearTimeout(nameTimer);nameTimer=setTimeout(()=>{profile.name=$('displayName').value||t('방문자');changedProfile();},650);});
$('displayName').addEventListener('blur',()=>{clearTimeout(nameTimer);profile.name=$('displayName').value;changedProfile();$('displayName').value=profile.name;});
const tabs=[...document.querySelectorAll('[data-tab]')];
function selectTab(button){for(const b of tabs){const selected=b===button;b.setAttribute('aria-selected',String(selected));b.tabIndex=selected?0:-1;$('panel-'+b.dataset.tab).hidden=!selected;}}
for(const b of tabs){b.addEventListener('click',()=>selectTab(b));b.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();const n=(tabs.indexOf(b)+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;selectTab(tabs[n]);tabs[n].focus();}});}
$('customizeButton').addEventListener('click',()=>$('customPanel').classList.toggle('open'));
$('closeCustomize').addEventListener('click',()=>$('customPanel').classList.remove('open'));
$('portraitButton').addEventListener('click',()=>{scene.portraitMode=true;scene.cameraAngle=scene.yaw+Math.PI;scene.cameraDistance=3;scene.cameraHeight=1.5;toast('화면을 드래그해 다른 각도도 볼 수 있습니다.');});
$('helpButton').addEventListener('click',()=>openDialog('helpDialog'));
$('settingsButton').addEventListener('click',()=>openDialog('settingsDialog'));
$('settingsCharacterButton').addEventListener('click',()=>{$('settingsDialog').close();$('customPanel').classList.add('open');selectTab(document.querySelector('[data-tab="face"]'));scene.portraitMode=true;scene.cameraAngle=scene.yaw+Math.PI;scene.cameraDistance=3;scene.cameraHeight=1.5;});
$('settingsLanguageButton').addEventListener('click',()=>{$('settingsDialog').close();openDialog('languageDialog');});
$('qualitySelect').addEventListener('change',e=>{scene.quality(e.target.value);try{localStorage.setItem('noor-quality',e.target.value);}catch{}});
try{const value=localStorage.getItem('noor-quality');if(['auto','high','low'].includes(value)){$('qualitySelect').value=value;scene.quality(value);}}catch{}
$('soundButton').addEventListener('click',()=>openDialog('soundDialog'));
$('enableSoundButton').addEventListener('click',async()=>{void congregationUi?.enableSound();try{await sound.enable();$('soundButton').querySelector('.utility-label').textContent='소리 설정';toast('소리를 켰습니다. 크기는 아래에서 조절할 수 있습니다.');}catch{toast('오디오를 시작하지 못했습니다. 다시 눌러주세요.');}});
$('bgmToggle').addEventListener('change',e=>{sound.bgmEnabled=e.target.checked;sound.applyMix();});
$('bgmVolume').addEventListener('input',e=>sound.setVolume(Number(e.target.value)/100));
$('prayerVolume').addEventListener('input',e=>sound.setPrayerVolume(Number(e.target.value)/100));
$('prayerSoundToggle').addEventListener('change',e=>{sound.prayerEnabled=e.target.checked;if(!e.target.checked)sound.recitation.pause();else if(scene.praying)sound.playRecitation();});
$('prayerAudioFile').addEventListener('change',e=>sound.setFile(e.target.files[0]));
const poses=['standing','bowing','prostrating','sitting'],poseLabels=['서기','숙이기','엎드리기','앉기'];
function prayerUI(){
  community?.setPrayerMode(scene.praying);partyUi?.setPrayer(scene.praying);if(scene.praying)scene.clearSpeech();
  document.body.classList.toggle('prayer-mode',scene.praying);
  $('prayerQuranLink').hidden=!scene.praying;$('greetingButton').hidden=scene.praying;
  $('joystickThumb').setAttribute('aria-disabled',String(scene.praying||scene.congregationJoined));
  $('prayerButtonText').textContent=scene.congregationJoined?groupText('leave'):t(scene.praying?'기도 마치기':'기도 시작');
  $('poseButton').hidden=!scene.praying||scene.congregationJoined;$('poseButton').textContent=t('다음 자세 · {pose}',{pose:t(poseLabels[poses.indexOf(scene.pose)]||'서기')});
  $('prayerLabel').textContent=scene.congregationJoined?groupText('title'):scene.praying?t('기도 중 · {pose}',{pose:t(poseLabels[poses.indexOf(scene.pose)]||'서기')}):t('가상 공간 기도 방향 ↑');
}
function setPrayer(active){
  if(active&&!canBeginPrayer({id:network?.selfId,...scene.position},[...scene.remote].map(([id,a])=>({id,x:a.target.x,z:a.target.z,yaw:a.targetYaw,praying:a.praying})),scene.mapId)){toast('다른 이용자와 건물에서 조금 떨어진 곳에서 기도를 시작해주세요.');return;}
  if(active){congregationUi?.adhan.stop();scene.cancelGreeting();$('toast').classList.remove('visible');}
  scene.praying=active;scene.pose='standing';scene.protected=active;scene.keys.clear();scene.direction.clear();scene.resetJoystick?.();
  network?.send({type:'prayer',active,pose:scene.pose});
  if(active){sound.startPrayer();$('soundButton').querySelector('.utility-label').textContent='소리 설정';toast('기도 방향으로 정렬했습니다. 다음 자세 버튼으로 자세를 바꿀 수 있습니다.');}
  else sound.stopPrayer();
  prayerUI();
}
$('prayerButton').addEventListener('click',()=>{if(scene.congregationJoined)congregationUi.leave();else setPrayer(!scene.praying);});
$('poseButton').addEventListener('click',()=>{scene.pose=poses[(poses.indexOf(scene.pose)+1)%poses.length];network.send({type:'prayer',active:true,pose:scene.pose});prayerUI();});
let greetingTimer;
function greetPlayer(to=null){
  if(scene.praying||$('greetingButton').disabled)return;
  $('greetingButton').disabled=true;
  if(!network?.send(to?{type:'greeting',to}:{type:'greeting'}))scene.playGreeting();
  clearTimeout(greetingTimer);greetingTimer=setTimeout(()=>{$('greetingButton').disabled=false;},5000);
}
$('greetingButton').addEventListener('click',()=>greetPlayer());
network=new RoomConnection({
  profile:()=>profile,
  status:state=>{
    $('statusDot').classList.toggle('connected',state==='connected');
    if(state==='offline'&&roomCount>0)removePresenceSelf();if(state!=='connected')setRoomCount(0);
    if(state==='offline'){scene.protected=false;$('roomStatus').textContent='온라인 연결이 끊어져 재연결 중입니다. 개인 미리보기는 계속 이용할 수 있습니다.';}
  },
  welcome:self=>{
    partyUi?.setSelf(self.id);scene.selfId=self.id;scene.position={x:self.x,z:self.z};scene.yaw=self.yaw;scene.protected=self.protected;
    congregationUi?.self(self);if(scene.praying&&!scene.congregationJoined)network.send({type:'prayer',active:true,pose:scene.pose});
  },
  self:p=>{if(congregationUi?.self(p))return;if(p.correction&&Math.hypot(p.correction.x,p.correction.z)>.08)scene.position={x:scene.position.x+p.correction.x,z:scene.position.z+p.correction.z};scene.protected=p.protected;if(p.authoritative&&(p.praying||scene.praying!==p.praying))scene.position={x:p.x,z:p.z};if(p.authoritative&&scene.praying!==p.praying){scene.praying=p.praying;scene.pose=p.pose;if(scene.praying){scene.cancelGreeting();sound.startPrayer();}else sound.stopPrayer();prayerUI();}},
  player:p=>{scene.syncPlayer(p);community?.player(p);},leave:id=>{scene.removePlayer(id);community?.leave(id);},clear:()=>{scene.selfId=null;scene.clearSpeech();scene.clearPlayers();community?.clear();partyUi?.reset();congregationUi?.reset();},
  congregation:message=>congregationUi?.message(message),
  count:setRoomCount,
  recount:()=>setRoomCount(scene.remote.size+1),
  notice:toast,party:message=>partyUi?.message(message),chat:message=>community?.chat(message),greeting:message=>{if(!scene.praying&&!scene.blockedIds?.has(message.accountId))scene.playGreeting(message.id===network.selfId?null:message.id,message.targetPlayerId||null);}
});
network.suspended=true;
community=initCommunity({
  getName:()=>profile.name,toast,onPublicChat:message=>scene.showSpeech(message),onSession:session=>{scene.clearSpeech();scene.accountId=session.id;scene.blockedIds=new Set(session.blocked.map(p=>p.id));scene.friendIds=session.friends.map(p=>p.id).filter(id=>!scene.blockedIds.has(id));partyUi?.privacyChanged();},
  sendChat:(text,to)=>network.send(to?{type:'whisper',text,to}:{type:'chat',text}),reconnect:()=>network.connect(currentRoom)
});
partyUi=initParty({send:data=>network.send(data),getSelfId:()=>network.selfId,getRoom:()=>currentRoom,getPlayers:()=>[...network.known.values()],getBlocked:()=>scene.blockedIds||new Set(),toast});
congregationUi=new CongregationUI({scene,network,sound,toast,onModeChange:active=>{if(active)sound.startPrayer({group:true});else sound.stopPrayer();prayerUI();}});
applyFeatureLabels();$('donateButton').addEventListener('click',()=>openDialog('donationDialog'));
playerMenu=initPlayerMenu({
  canWhisper:()=>community?.session?.whispers!==false,
  onAction:(action,person)=>{
    const avatar=scene.remote.get(person.id);
    if(scene.praying||!avatar||avatar.praying||scene.blockedIds?.has(avatar.accountId))return;
    if(action==='greeting')greetPlayer(avatar.accountId);else if(action==='party')partyUi.invite(avatar.id);else community.beginWhisper(avatar.accountId);
  }
});
scene.onPlayerMenu=(id,x,y)=>{
  const avatar=scene.remote.get(id);if(!avatar||scene.praying||scene.blockedIds?.has(avatar.accountId))return;
  playerMenu.open({id,accountId:avatar.accountId,name:avatar.profile.name,praying:avatar.praying},x,y);
};
scene.onPlayerMenuClose=()=>playerMenu.close();
$('reconnectButton').addEventListener('click',async()=>{const generation=pageGeneration;try{await community.start();if(pageLeaving||generation!==pageGeneration)return;network.resume();network.retry=0;network.connect(currentRoom);$('settingsDialog').close();}catch(e){toast(e.message);}});
let chosenMap=parseRoom(currentRoom).map,chosenServer=parseRoom(currentRoom).server,roomsVersion=0;
const mapText=(id,field)=>id==='makkah'?f(({name:'makkah',city:'makkahCity',description:'makkahDescription'})[field]):t(MAPS[id][field]);
function mapLabels(){
  const room=parseRoom(currentRoom),map=MAPS[room.map];
  $('currentMapName').textContent=mapText(room.map,'name')+' · '+room.server;
  $('mapCaption').textContent=map.short+' · '+mapText(room.map,'city');renderPresence();
}
function renderMaps(){
  $('mapChoices').replaceChildren();
  for(const [id,map]of Object.entries(MAPS)){
    const b=document.createElement('button');b.className='map-card';b.dataset.map=id;b.setAttribute('aria-pressed',String(chosenMap===id));
    const art=document.createElement('span');art.className='map-art '+id;
    const title=document.createElement('strong');title.textContent=mapText(id,'name');
    const city=document.createElement('small');city.textContent=mapText(id,'city');
    const desc=document.createElement('p');desc.textContent=mapText(id,'description');b.append(art,title,city,desc);
    const count=document.createElement('span');count.className='map-population';count.textContent=presence?presenceText('online',presence.maps[id]?.total||0):'—';b.append(count);
    b.addEventListener('click',()=>{chosenMap=id;chosenServer=1;renderMaps();loadServers();});$('mapChoices').append(b);
  }
}
async function loadServers(){
  const version=++roomsVersion;$('serverChoices').replaceChildren();$('roomStatus').textContent='서버 상태를 확인하고 있습니다…';
  let rooms=[1,2,3].map(server=>({server,count:null,capacity:50}));
  try{const r=await fetch('/api/rooms?map='+chosenMap);if(!r.ok)throw new Error('offline');rooms=(await r.json()).rooms;if(version!==roomsVersion)return;$('roomStatus').textContent='같은 모스크와 서버를 선택한 이용자끼리 만납니다.';}
  catch{if(version!==roomsVersion)return;$('roomStatus').textContent='서버 상태를 불러오지 못했습니다. 입장은 다시 시도할 수 있습니다.';}
  const shown=rooms.some(r=>r.count===null)?rooms:visibleRooms(rooms);
  if(!shown.some(r=>r.server===chosenServer))chosenServer=recommendedRoom(rooms)?.server||chosenServer;
  if(shown.length===1&&rooms.every(r=>r.count!==null))$('roomStatus').textContent=f('gatheringHint');
  for(const room of shown){
    const b=document.createElement('button');b.textContent='서버 '+room.server;b.dataset.server=room.server;b.setAttribute('aria-pressed',String(chosenServer===room.server));b.disabled=room.count>=room.capacity;
    const count=document.createElement('small');count.textContent=room.count===null?'연결 확인 전':room.count+' / '+room.capacity+'명';b.append(count);
    b.addEventListener('click',()=>{chosenServer=room.server;for(const n of $('serverChoices').children)n.setAttribute('aria-pressed',String(n===b));});$('serverChoices').append(b);
  }
}
$('mapButton').addEventListener('click',()=>{chosenMap=parseRoom(currentRoom).map;chosenServer=parseRoom(currentRoom).server;renderMaps();openDialog('mapDialog');loadServers();refreshPresence().then(()=>{if($('mapDialog').open)renderMaps();});});
async function enterRoom({automatic=false}={}){
  const generation=pageGeneration;
  $('enterRoomButton').disabled=true;entryBusy=true;
  try{
    if(!automatic)sound.enable().then(()=>$('soundButton').querySelector('.utility-label').textContent=t('소리 설정')).catch(()=>{});
    await scene.local.human.ready;
    if(pageLeaving||generation!==pageGeneration)return;
    if(automatic){
      try{
        const directory=await refreshPresence();
        if(preferBusyMap&&directory){const busy=Object.entries(directory.maps).filter(([,m])=>m.total>0&&recommendedRoom(m.rooms)).sort((a,b)=>b[1].total-a[1].total)[0];if(busy)chosenMap=busy[0];}
        preferBusyMap=false;
        const r=await fetch('/api/rooms?map='+chosenMap);if(!r.ok)throw new Error('offline');
        const {rooms}=await r.json(),available=recommendedRoom(rooms);
        if(pageLeaving||generation!==pageGeneration)return;
        if(!available){toast('기도원이 가득 찼습니다. 잠시 후 다시 입장해주세요.');return;}
        chosenServer=available.server;
      }catch{}
    }
    if(pageLeaving||generation!==pageGeneration)return;
    if(scene.praying)setPrayer(false);if(network.selfId){removePresenceSelf();roomCount=0;network.disconnect({notify:true,suspend:true});}currentRoom=chosenMap+':'+chosenServer;await scene.setMap(chosenMap);scene.position={...MAPS[chosenMap].spawn};scene.cameraDistance=PLAY_CAMERA.distance;scene.cameraHeight=PLAY_CAMERA.height;scene.cameraAngle=MAPS[chosenMap].cameraAngle;scene.snapCamera();
    if(pageLeaving||generation!==pageGeneration)return;
    mapLabels();try{localStorage.setItem('noor-room',currentRoom);}catch{}
    await community.start();if(pageLeaving||generation!==pageGeneration)return;network.resume();network.retry=0;network.connect(currentRoom);$('mapDialog').close();
  }catch(e){$('roomStatus').textContent=t(e.message);if(automatic)toast('온라인 연결을 준비하지 못했습니다. 설정에서 다시 연결할 수 있습니다.');}
  finally{$('enterRoomButton').disabled=false;entryBusy=false;}
}
$('enterRoomButton').addEventListener('click',()=>enterRoom());
window.addEventListener('pagehide',()=>{
  if(pageLeaving)return;pageLeaving=true;pageGeneration++;
  network.disconnect({notify:true,suspend:true});community.stop();playerMenu.close();
  if(scene.praying)setPrayer(false);
});
window.addEventListener('pageshow',event=>{
  if(!event.persisted)return;pageLeaving=false;
  for(const dialog of document.querySelectorAll('dialog[open]'))dialog.close();
  chosenMap=parseRoom(currentRoom).map;chosenServer=parseRoom(currentRoom).server;void enterRoom({automatic:true});
});
initTasbih(scene);initReminders({toast});
const locationService=initLocation(toast);initPrayerTimes({location:locationService,toast});updateChoices();mapLabels();prayerUI();
setInterval(()=>{if(!document.hidden)network.movement(scene.position,scene.yaw);},150);
await scene.ready;
await scene.local.human.ready;
await scene.environmentReady;
$('enterRoomButton').disabled=false;
requestAnimationFrame(()=>{$('loading').hidden=true;});
if(new URLSearchParams(location.search).has('qa')){window.__noorScene=scene;window.__noorParty=partyUi;window.__noorCongregation=congregationUi;window.__noorGroupTest=()=>network.send({type:'congregation-test-start'});}
void enterRoom({automatic:true});

setInterval(()=>{if(!document.hidden&&community.session)community.refresh().catch(()=>{});},30000);
setInterval(()=>{if(!document.hidden&&network.selfId)void refreshPresence({gather:true});},15000);

window.addEventListener('languagechange',()=>{for(const [list,id,label]of [[USER_MODELS,'characterChoices','캐릭터 유형'],[USER_MODELS,'wardrobeChoices','기도 복장']])for(const item of list){const b=document.querySelector('#'+id+' [data-value="'+item.id+'"]');b.lastElementChild.textContent=String(item.index+1);b.setAttribute('aria-label',t(label)+' '+(item.index+1));b.title=t(label)+' '+(item.index+1);}mapLabels();prayerUI();if($('mapDialog').open){renderMaps();loadServers();}if(generatedName){profile.name=t('방문자');$('displayName').value=profile.name;changedProfile();}});
if(generatedName){profile.name=t('방문자');$('displayName').value=profile.name;scene.updateProfile(profile);}
