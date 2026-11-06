import {t} from './i18n.js';
import {PartyVoice} from './party-voice.js';
import {featureText as f,applyFeatureLabels} from './feature-labels.js';
export function initParty({send,getSelfId,getRoom,getPlayers,getBlocked,toast}){
 const $=id=>document.getElementById(id);let party=null,invites=[],selfId=null,voice;
 const row=(name)=>{const item=document.createElement('div');item.className='party-member';const label=document.createElement('span');label.dataset.noI18n='';label.dir='auto';label.textContent=name;item.append(label);return item;};
 function render(){
  if(!voice)return;applyFeatureLabels();const me=party?.members.find(m=>m.id===selfId),d=voice.diagnostics();
  $('partyBadge').textContent=voice.praying?'':party?String(party.members.length):invites.length?String(invites.length):'';
  $('partySummary').textContent=party?party.members.length+' / 6':f('partyHelp');$('partyCreateButton').hidden=!!party;$('partyLeaveButton').hidden=!party;
  $('partyMembers').replaceChildren();
  for(const member of party?.members||[]){
   const item=row(member.name),state=document.createElement('small');state.textContent=member.praying?f('prayerQuiet'):member.voiceReady?f('connected'):f('voiceHint');item.append(state);
   if(party.leaderId===selfId&&member.id!==selfId){const kick=document.createElement('button');kick.type='button';kick.className='small-secondary';kick.textContent=f('kick');kick.addEventListener('click',()=>send({type:'party-kick',to:member.id}));item.append(kick);}$('partyMembers').append(item);
  }
  $('partyInvites').replaceChildren();invites=invites.filter(i=>i.expires>Date.now());
  for(const invite of invites){
   const item=row(invite.fromName),accept=document.createElement('button'),decline=document.createElement('button');accept.type=decline.type='button';accept.textContent=t('수락');decline.textContent=t('거절');accept.className='small-primary';decline.className='small-secondary';accept.disabled=!!party;
   for(const [button,type]of [[accept,'party-accept'],[decline,'party-decline']])button.addEventListener('click',()=>{send({type,inviteId:invite.id});invites=invites.filter(i=>i.id!==invite.id);render();});item.append(accept,decline);$('partyInvites').append(item);
  }
  $('partyVoiceJoin').hidden=!party||d.voiceActive;$('partyVoiceJoin').disabled=voice.praying;
  $('partyVoiceLeave').hidden=!d.voiceActive;$('partyMicButton').hidden=!d.voiceActive;$('partyMicButton').textContent=f(voice.muted?'unmute':'mute');$('partyMicButton').setAttribute('aria-pressed',String(voice.muted));
  $('partyVoiceStatus').textContent=voice.praying?f('prayerQuiet'):d.voiceActive?(d.connectedPeers?f('connected')+' · '+d.connectedPeers:t('연결 중…')):f('voiceHint');
 }
 function visitors(){
  const previous=$('partyInviteTarget').value;$('partyInviteTarget').replaceChildren(new Option('—',''));
  for(const player of getPlayers())if(player.id!==selfId&&!player.praying&&!getBlocked().has(player.accountId)&&!party?.members.some(m=>m.accountId===player.accountId))$('partyInviteTarget').append(new Option(player.profile.name,player.id));
  if([...$('partyInviteTarget').options].some(o=>o.value===previous))$('partyInviteTarget').value=previous;
 }
 voice=new PartyVoice({send,blocked:getBlocked,configProvider:async()=>{
  const u=new URL('/api/voice/ice',location.href);u.searchParams.set('room',getRoom());u.searchParams.set('player',getSelfId());
  const response=await fetch(u,{credentials:'same-origin',cache:'no-store'});if(!response.ok)throw new Error('ice');return response.json();
 },onChange:render,onError:code=>{$('partyAudioResume').hidden=code!=='playback';toast(f(code==='microphone'?'micDenied':code==='playback'?'playback':'voiceError'));}});
 function invite(id){if(voice.praying||!id)return;if(!send({type:'party-invite',to:id}))toast(f('partyError'));}
 $('partyButton').addEventListener('click',()=>{visitors();render();$('partyDialog').showModal();});
 $('partyCreateButton').addEventListener('click',()=>{if(!send({type:'party-create'}))toast(f('partyError'));});
 $('partyLeaveButton').addEventListener('click',()=>{voice.stop();send({type:'party-leave'});});
 $('partyInviteButton').addEventListener('click',()=>invite($('partyInviteTarget').value));
 $('partyVoiceJoin').addEventListener('click',()=>voice.enable());
 $('partyVoiceLeave').addEventListener('click',()=>voice.stop());
 $('partyMicButton').addEventListener('click',()=>voice.setMuted(!voice.muted));
 $('partyVolume').addEventListener('input',event=>voice.setVolume(Number(event.target.value)/100));
 $('partyAudioResume').addEventListener('click',()=>{voice.resumeAudio();$('partyAudioResume').hidden=true;});
 window.addEventListener('languagechange',()=>{render();if($('partyDialog').open)visitors();});
 window.addEventListener('pagehide',()=>voice.stop(false));
 return {
  voice,invite,diagnostics:()=>voice.diagnostics(),setSelf(id){selfId=id;},
  message(message){
   if(message.type==='party-state'){party=message.party;selfId=getSelfId();voice.applyState(party,selfId);render();if($('partyDialog').open)visitors();}
   else if(message.type==='party-invite'){if(!voice.praying){invites=invites.filter(i=>i.id!==message.invite.id);invites.push(message.invite);toast(f('inviteReceived'));render();}}
   else if(message.type==='party-error')toast(f('partyError'));
   else if(message.type==='voice-signal')voice.signal(message).catch(()=>toast(f('voiceError')));
  },
  reset(){party=null;invites=[];selfId=null;voice.reset();render();},
  setPrayer(active){voice.setPrayer(active);render();},
  privacyChanged(){voice.reconcile().catch(()=>{});if($('partyDialog').open)visitors();}
 };
}
