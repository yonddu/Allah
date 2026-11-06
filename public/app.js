import {t} from './i18n.js';
import {PLAY_CAMERA} from './camera.js';
import {DEFAULT_PROFILE,COLORS,sanitizeProfile,MAPS,parseRoom,canBeginPrayer} from './core.js';
import {Sanctuary} from './scene.js';
import {initPrayerTimes} from './prayer-times.js';
import {initLocation} from './location.js';
import {RoomConnection} from './network.js';
import {initPlayerMenu} from './player-menu.js';
import {initParty} from './party.js';
import {applyFeatureLabels} from './feature-labels.js';
import {initCommunity} from './social.js';
import {Soundscape} from './audio.js';
import {USER_MODELS} from './user-model-catalog.js';

const $=id=>document.getElementById(id);
let generatedName=false;
let toastTimer,profile=loadProfile(),savedRoom;
try{savedRoom=localStorage.getItem('noor-room');}catch{}
let currentRoom=parseRoom(savedRoom)?.key||'mecca:1',scene,network,community,playerMenu,partyUi;
function toast(message){
  $('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),4500);
}
function loadProfile(){try{const raw=JSON.parse(localStorage.getItem('noor-profile'));if(raw)return sanitizeProfile(raw);}catch{}generatedName=true;return {...DEFAULT_PROFILE,name:t('방문자')};}
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
  const preview=document.createElement('span');preview.className='model-thumb';preview.style.backgroundImage='url(/user-models/'+item.id+'.png)';preview.setAttribute('aria-hidden','true');
  const text=document.createElement('span');text.textContent=t(label)+' '+(item.index+1);b.append(preview,text);b.setAttribute('aria-label',t(label)+' '+(item.index+1));$(id).append(b);
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
  profile=sanitizeProfile(profile);scene.updateProfile(profile);persistProfile();updateChoices();
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
$('enableSoundButton').addEventListener('click',async()=>{try{await sound.enable();$('soundButton').querySelector('.utility-label').textContent='소리 설정';toast('소리를 켰습니다. 크기는 아래에서 조절할 수 있습니다.');}catch{toast('오디오를 시작하지 못했습니다. 다시 눌러주세요.');}});
$('bgmToggle').addEventListener('change',e=>{sound.bgmEnabled=e.target.checked;sound.applyMix();});
$('bgmVolume').addEventListener('input',e=>sound.setVolume(Number(e.target.value)/100));
$('prayerVolume').addEventListener('input',e=>sound.setPrayerVolume(Number(e.target.value)/100));
$('prayerSoundToggle').addEventListener('change',e=>{sound.prayerEnabled=e.target.checked;if(!e.target.checked)sound.recitation.pause();else if(scene.praying)sound.playRecitation();});
$('prayerAudioFile').addEventListener('change',e=>sound.setFile(e.target.files[0]));
const poses=['standing','bowing','prostrating','sitting'],poseLabels=['서기','숙이기','엎드리기','앉기'];
function prayerUI(){
  community?.setPrayerMode(scene.praying);partyUi?.setPrayer(scene.praying);
  document.body.classList.toggle('prayer-mode',scene.praying);
  $('prayerQuranLink').hidden=!scene.praying;$('greetingButton').hidden=scene.praying;
  $('joystickThumb').setAttribute('aria-disabled',String(scene.praying));
  $('prayerButtonText').textContent=scene.praying?'기도 마치기':'기도 시작';
  $('poseButton').hidden=!scene.praying;$('poseButton').textContent='다음 자세 · '+poseLabels[poses.indexOf(scene.pose)];
  $('prayerLabel').textContent=scene.praying?'기도 중 · '+poseLabels[poses.indexOf(scene.pose)]:'가상 공간 기도 방향 ↑';
}
function setPrayer(active){
  if(active&&!canBeginPrayer({id:network?.selfId,...scene.position},[...scene.remote].map(([id,a])=>({id,x:a.target.x,z:a.target.z,yaw:a.targetYaw,praying:a.praying})),scene.mapId)){toast('다른 이용자와 건물에서 조금 떨어진 곳에서 기도를 시작해주세요.');return;}
  if(active){scene.cancelGreeting();$('toast').classList.remove('visible');}
  scene.praying=active;scene.pose='standing';scene.protected=active;scene.keys.clear();scene.direction.clear();scene.resetJoystick?.();
  network?.send({type:'prayer',active,pose:scene.pose});
  if(active){sound.startPrayer();$('soundButton').querySelector('.utility-label').textContent='소리 설정';toast('기도 방향으로 정렬했습니다. 다음 자세 버튼으로 자세를 바꿀 수 있습니다.');}
  else sound.stopPrayer();
  prayerUI();
}
$('prayerButton').addEventListener('click',()=>setPrayer(!scene.praying));
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
    $('onlineCount').textContent=state==='connecting'?'연결 중…':state==='offline'?'개인 미리보기':'연결됨';
    if(state==='offline'){scene.protected=false;$('roomStatus').textContent='온라인 연결이 끊어져 재연결 중입니다. 개인 미리보기는 계속 이용할 수 있습니다.';}
  },
  welcome:self=>{
    partyUi?.setSelf(self.id);scene.selfId=self.id;scene.position={x:self.x,z:self.z};scene.yaw=self.yaw;scene.protected=self.protected;
    if(scene.praying)network.send({type:'prayer',active:true,pose:scene.pose});
  },
  self:p=>{if(p.correction&&Math.hypot(p.correction.x,p.correction.z)>.08)scene.position={x:scene.position.x+p.correction.x,z:scene.position.z+p.correction.z};scene.protected=p.protected;if(p.authoritative&&(p.praying||scene.praying!==p.praying))scene.position={x:p.x,z:p.z};if(p.authoritative&&scene.praying!==p.praying){scene.praying=p.praying;scene.pose=p.pose;if(scene.praying){scene.cancelGreeting();sound.startPrayer();}else sound.stopPrayer();prayerUI();}},
  player:p=>{scene.syncPlayer(p);community?.player(p);},leave:id=>{scene.removePlayer(id);community?.leave(id);},clear:()=>{scene.clearPlayers();community?.clear();partyUi?.reset();},
  count:n=>$('onlineCount').textContent=n+'명 접속',
  recount:()=>$('onlineCount').textContent=(scene.remote.size+1)+'명 접속',
  notice:toast,party:message=>partyUi?.message(message),chat:message=>community?.chat(message),greeting:message=>{if(!scene.praying&&!scene.blockedIds?.has(message.accountId))scene.playGreeting(message.id===network.selfId?null:message.id,message.targetPlayerId||null);}
});
community=initCommunity({
  getName:()=>profile.name,toast,onSession:session=>{scene.accountId=session.id;scene.blockedIds=new Set(session.blocked.map(p=>p.id));scene.friendIds=session.friends.map(p=>p.id).filter(id=>!scene.blockedIds.has(id));partyUi?.privacyChanged();},
  sendChat:(text,to)=>network.send(to?{type:'whisper',text,to}:{type:'chat',text}),reconnect:()=>network.connect(currentRoom)
});
partyUi=initParty({send:data=>network.send(data),getSelfId:()=>network.selfId,getRoom:()=>currentRoom,getPlayers:()=>[...network.known.values()],getBlocked:()=>scene.blockedIds||new Set(),toast});
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
$('reconnectButton').addEventListener('click',async()=>{try{await community.start();network.retry=0;network.connect(currentRoom);$('settingsDialog').close();}catch(e){toast(e.message);}});
let chosenMap=parseRoom(currentRoom).map,chosenServer=parseRoom(currentRoom).server,roomsVersion=0;
function mapLabels(){
  const room=parseRoom(currentRoom),map=MAPS[room.map];
  $('currentMapName').textContent=map.name+' · '+room.server;
  $('mapCaption').textContent=map.short+' · '+t(map.city);
}
function renderMaps(){
  $('mapChoices').replaceChildren();
  for(const [id,map]of Object.entries(MAPS)){
    const b=document.createElement('button');b.className='map-card';b.dataset.map=id;b.setAttribute('aria-pressed',String(chosenMap===id));
    const art=document.createElement('span');art.className='map-art '+id;
    const title=document.createElement('strong');title.textContent=map.name;
    const city=document.createElement('small');city.textContent=map.city;
    const desc=document.createElement('p');desc.textContent=map.description;b.append(art,title,city,desc);
    b.addEventListener('click',()=>{chosenMap=id;chosenServer=1;renderMaps();loadServers();});$('mapChoices').append(b);
  }
}
async function loadServers(){
  const version=++roomsVersion;$('serverChoices').replaceChildren();$('roomStatus').textContent='서버 상태를 확인하고 있습니다…';
  let rooms=[1,2,3].map(server=>({server,count:null,capacity:50}));
  try{const r=await fetch('/api/rooms?map='+chosenMap);if(!r.ok)throw new Error('offline');rooms=(await r.json()).rooms;if(version!==roomsVersion)return;$('roomStatus').textContent='같은 모스크와 서버를 선택한 이용자끼리 만납니다.';}
  catch{if(version!==roomsVersion)return;$('roomStatus').textContent='서버 상태를 불러오지 못했습니다. 입장은 다시 시도할 수 있습니다.';}
  for(const room of rooms){
    const b=document.createElement('button');b.textContent='서버 '+room.server;b.dataset.server=room.server;b.setAttribute('aria-pressed',String(chosenServer===room.server));b.disabled=room.count>=room.capacity;
    const count=document.createElement('small');count.textContent=room.count===null?'연결 확인 전':room.count+' / '+room.capacity+'명';b.append(count);
    b.addEventListener('click',()=>{chosenServer=room.server;for(const n of $('serverChoices').children)n.setAttribute('aria-pressed',String(n===b));});$('serverChoices').append(b);
  }
}
$('mapButton').addEventListener('click',()=>{window.dispatchEvent(new Event('noor:select-room'));chosenMap=parseRoom(currentRoom).map;chosenServer=parseRoom(currentRoom).server;renderMaps();openDialog('mapDialog');loadServers();});
$('enterRoomButton').addEventListener('click',async()=>{
  $('enterRoomButton').disabled=true;
  try{
    sound.enable().then(()=>$('soundButton').querySelector('.utility-label').textContent='소리 설정').catch(()=>{});
    await scene.local.human.ready;
    if(scene.praying)setPrayer(false);currentRoom=chosenMap+':'+chosenServer;await scene.setMap(chosenMap);scene.position={...MAPS[chosenMap].spawn};scene.cameraDistance=PLAY_CAMERA.distance;scene.cameraHeight=PLAY_CAMERA.height;scene.cameraAngle=MAPS[chosenMap].cameraAngle;scene.snapCamera();
    mapLabels();try{localStorage.setItem('noor-room',currentRoom);}catch{}
    await community.start();network.retry=0;network.connect(currentRoom);window.dispatchEvent(new Event('noor:entered'));$('mapDialog').close();
  }catch(e){$('roomStatus').textContent=e.message;}
  finally{$('enterRoomButton').disabled=false;}
});
const locationService=initLocation(toast);initPrayerTimes({location:locationService,toast});updateChoices();mapLabels();prayerUI();
setInterval(()=>{if(!document.hidden)network.movement(scene.position,scene.yaw);},150);
await scene.ready;
await scene.local.human.ready;
await scene.environmentReady;
$('enterRoomButton').disabled=false;
requestAnimationFrame(()=>{$('loading').hidden=true;});
if(new URLSearchParams(location.search).has('qa')){window.__noorScene=scene;window.__noorParty=partyUi;}
community.start().then(()=>{if(parseRoom(savedRoom))network.connect(currentRoom);}).catch(()=>toast('온라인 연결을 준비하지 못했습니다. 설정에서 다시 연결할 수 있습니다.'));
if(!parseRoom(savedRoom)||$('mapDialog').open){renderMaps();openDialog('mapDialog');loadServers();}
window.addEventListener('pagehide',()=>{network.generation++;clearTimeout(network.timer);network.socket?.close();});

setInterval(()=>{if(!document.hidden&&community.session)community.refresh().catch(()=>{});},30000);

window.addEventListener('languagechange',()=>{for(const [list,id,label]of [[USER_MODELS,'characterChoices','캐릭터 유형'],[USER_MODELS,'wardrobeChoices','기도 복장']])for(const item of list){const b=document.querySelector('#'+id+' [data-value="'+item.id+'"]');b.lastElementChild.textContent=t(label)+' '+(item.index+1);b.setAttribute('aria-label',t(label)+' '+(item.index+1));}mapLabels();if(generatedName){profile.name=t('방문자');$('displayName').value=profile.name;changedProfile();}});

window.addEventListener('noor:entry-character',e=>{scene.portraitMode=e.detail.active;scene.cameraAngle=e.detail.active?scene.yaw+Math.PI:MAPS[scene.mapId].cameraAngle;scene.cameraDistance=e.detail.active?2.65:PLAY_CAMERA.distance;scene.cameraHeight=e.detail.active?1.6:PLAY_CAMERA.height;});
if(generatedName){profile.name=t('방문자');$('displayName').value=profile.name;scene.updateProfile(profile);}
window.dispatchEvent(new Event('noor:app-ready'));
