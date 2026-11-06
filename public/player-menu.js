import {t} from './i18n.js';
import {featureText} from './feature-labels.js';
export function initPlayerMenu({onAction,canWhisper=()=>true}){
 const menu=document.createElement('div');menu.id='playerMenu';menu.className='player-menu glass';menu.hidden=true;menu.setAttribute('role','menu');menu.setAttribute('aria-label',t('함께하기'));
 const title=document.createElement('div');title.id='playerMenuTitle';title.className='player-menu-title';title.dataset.noI18n='';title.dir='auto';
 const greet=document.createElement('button'),whisper=document.createElement('button'),partyInvite=document.createElement('button');
 partyInvite.id='playerPartyAction';greet.id='playerGreetAction';whisper.id='playerWhisperAction';
 for(const button of [greet,whisper,partyInvite]){button.type='button';button.setAttribute('role','menuitem');}
 menu.tabIndex=-1;menu.append(title,greet,whisper,partyInvite);document.getElementById('app').append(menu);
 let selected=null;
 function close(){menu.hidden=true;selected=null;}
 function open(player,x,y){
  selected=player;title.textContent=player.name;greet.textContent=t('인사');whisper.textContent=t('귓속말');partyInvite.textContent=featureText('invite')+' · '+featureText('party');partyInvite.disabled=!!player.praying;
  greet.disabled=!!player.praying;whisper.disabled=!!player.praying||!canWhisper();
  menu.hidden=false;const rect=menu.getBoundingClientRect(),width=window.innerWidth,height=window.innerHeight;
  menu.style.left=Math.max(8,Math.min(x,width-rect.width-8))+'px';menu.style.top=Math.max(8,Math.min(y,height-rect.height-8))+'px';
  ([greet,whisper,partyInvite].find(b=>!b.disabled)||menu).focus();
 }
 for(const [button,action]of [[greet,'greeting'],[whisper,'whisper'],[partyInvite,'party']])button.addEventListener('click',()=>{
  if(!selected||button.disabled)return;const player=selected;close();onAction(action,player);
 });
 document.addEventListener('pointerdown',event=>{if(!menu.contains(event.target))close();});
 menu.addEventListener('keydown',event=>{
  if(event.key==='Escape'){event.preventDefault();close();}
  if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
   event.preventDefault();const items=[greet,whisper,partyInvite].filter(b=>!b.disabled);if(!items.length)return;
   const current=items.indexOf(document.activeElement),delta=event.key==='ArrowUp'?-1:1,index=event.key==='Home'?0:event.key==='End'?items.length-1:(current+delta+items.length)%items.length;items[index].focus();
  }
 });
 window.addEventListener('resize',close);window.addEventListener('blur',close);window.addEventListener('languagechange',close);
 return {open,close};
}
