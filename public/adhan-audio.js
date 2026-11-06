import {ADHAN_RECORDING} from './adhan-source.js';
export class AdhanAudio{
 constructor({onChange=()=>{},onPlaying=()=>{}}={}){
  this.onChange=onChange;this.onPlaying=onPlaying;this.enabled=true;this.unlocked=false;this.playing=false;this.volume=.7;this.lastId=null;this.context=null;this.audio=null;this.enabling=null;
  try{this.enabled=localStorage.getItem('noor-adhan-enabled')!=='0';this.lastId=localStorage.getItem('noor-adhan-played');}catch{}
  window.addEventListener('pagehide',()=>this.close());
 }
 async enable(){
  if(this.enabling)return this.enabling;
  if(this.unlocked){this.setEnabled(true);return true;}
  const AudioContext=window.AudioContext||window.webkitAudioContext;if(!AudioContext)throw new Error('Audio unavailable');
  this.context??=new AudioContext();
  if(!this.audio){this.audio=new Audio(ADHAN_RECORDING.file);this.audio.preload='none';this.gain=this.context.createGain();this.source=this.context.createMediaElementSource(this.audio);this.source.connect(this.gain);this.gain.connect(this.context.destination);this.audio.addEventListener('ended',()=>this.finish());this.audio.addEventListener('error',()=>this.finish());}
  // Request both permissions within the click; warm this same media element silently.
  this.gain.gain.value=0;const resume=this.context.resume(),play=this.audio.play(),audio=this.audio,context=this.context,generation=this.generation||0;
  const request=Promise.all([resume,play]).then(()=>{
   if(this.context!==context||this.audio!==audio||generation!==(this.generation||0))return false;audio.pause();audio.currentTime=0;this.gain.gain.value=this.volume;this.unlocked=true;this.setEnabled(true);return true;
  }).catch(error=>{audio.pause();if(this.context===context){this.unlocked=false;this.onChange();}throw error;}).finally(()=>{if(this.enabling===request)this.enabling=null;});
  this.enabling=request;return request;
 }
 setEnabled(enabled){this.enabled=!!enabled;try{localStorage.setItem('noor-adhan-enabled',this.enabled?'1':'0');}catch{}if(!enabled)this.stop();this.onChange();}
 async play({id,at,now=Date.now()}){
  if(!this.enabled||!this.unlocked||this.lastId===id||this.pendingId||this.playing)return false;
  const offset=Math.max(0,(now-at)/1000);if(offset>=ADHAN_RECORDING.duration)return false;
  const audio=this.audio,context=this.context,generation=this.generation||0;this.pendingId=id;
  const cancelled=()=>generation!==(this.generation||0)||this.audio!==audio||!this.enabled;
  try{
   await context.resume();if(cancelled())return false;audio.currentTime=offset;this.gain.gain.value=this.volume;await audio.play();
   if(cancelled()){audio.pause();return false;}this.lastId=id;this.playing=true;try{localStorage.setItem('noor-adhan-played',id);}catch{}this.onPlaying(true);this.onChange();return true;
  }catch{if(!cancelled()){this.unlocked=false;this.onChange();}return false;}finally{if(generation===(this.generation||0))this.pendingId=null;}
 }
 finish(){if(this.playing)this.onPlaying(false);this.playing=false;this.onChange();}
 stop(){this.generation=(this.generation||0)+1;this.pendingId=null;this.audio?.pause();this.finish();}
 close(){this.stop();this.context?.close().catch(()=>{});this.context=null;this.audio=null;this.source=null;this.gain=null;this.enabling=null;this.unlocked=false;}
}
