export const PRAYER_TRACK={
  title:'알바카라 · 연속 낭송',duration:'2시간 25분 10초',author:'Atcovi / Aaqib Azeez',license:'CC0 1.0',
  url:"https://upload.wikimedia.org/wikipedia/commons/4/4f/Chapter_2%2C_Al-Baqarah_%28Murattal%29_-_Recitation_of_the_Holy_Qur%27an.mp3",
  source:"https://commons.wikimedia.org/wiki/File:Chapter_2,_Al-Baqarah_(Murattal)_-_Recitation_of_the_Holy_Qur%27an.mp3"
};
export class Soundscape {
  constructor(toast){
    this.toast=toast;this.ctx=null;this.master=null;this.bgmEnabled=true;this.prayerEnabled=true;this.praying=false;this.enabled=false;
    this.volume=.23;this.prayerVolume=.65;this.localUrl=null;this.resuming=false;
    this.recitation=new Audio();this.recitation.preload='none';this.recitation.loop=true;this.recitation.src=PRAYER_TRACK.url;
    this.water=new Audio('/audio/water.ogg');this.water.preload='none';this.water.loop=true;this.water.volume=this.volume;
    let triedWaterFallback=false;
    this.water.addEventListener('error',()=>{if(!triedWaterFallback){triedWaterFallback=true;this.water.src='https://upload.wikimedia.org/wikipedia/commons/2/26/Flowing-water-100019.ogg';if(this.enabled&&!this.praying&&this.bgmEnabled)this.water.play().catch(()=>{});}});
    this.recitation.addEventListener('error',()=>this.toast('낭송을 불러오지 못했습니다. 재생을 다시 누르거나 개인 음원을 선택해주세요.'));
    document.addEventListener('visibilitychange',()=>{
      if(document.hidden){this.water.pause();this.ctx?.suspend();}
      else if(this.enabled&&!this.praying)this.toast('소리를 다시 들으려면 소리 켜기를 눌러주세요.');
    });
    window.addEventListener('pagehide',event=>{this.enabled=false;this.praying=false;this.recitation.pause();this.water.pause();this.ctx?.close().catch(()=>{});this.ctx=null;this.master=null;this.wind=null;if(!event.persisted&&this.localUrl)URL.revokeObjectURL(this.localUrl);});
  }
  async enable(){
    this.enabled=true;
    if(this.bgmEnabled&&!this.praying){this.water.volume=this.volume;this.water.play().catch(()=>{});}
    const Context=window.AudioContext||window.webkitAudioContext;
    if(Context){
      if(!this.ctx){
        this.ctx=new Context();this.master=this.ctx.createGain();this.master.gain.value=0;this.master.connect(this.ctx.destination);
        // Soft wind and an indoor room tone, with no instruments or vocal imitation.
        const length=this.ctx.sampleRate*5,buffer=this.ctx.createBuffer(1,length,this.ctx.sampleRate),data=buffer.getChannelData(0);let last=0;
        for(let n=0;n<length;n++){last=(last+Math.random()*.04-.02)/1.025;data[n]=last;}
        const wind=this.ctx.createBufferSource();wind.buffer=buffer;wind.loop=true;
        const low=this.ctx.createBiquadFilter();low.type='lowpass';low.frequency.value=700;
        const high=this.ctx.createBiquadFilter();high.type='highpass';high.frequency.value=80;
        const windGain=this.ctx.createGain();windGain.gain.value=.12;wind.connect(low);low.connect(high);high.connect(windGain);windGain.connect(this.master);wind.start();
        this.wind=wind;
      }
      await this.ctx.resume();
    }
    this.applyMix();if(this.praying&&this.prayerEnabled)this.playRecitation();
  }
  applyMix(){
    const audible=this.enabled&&this.bgmEnabled&&!this.praying;
    if(this.master)this.master.gain.setTargetAtTime(audible?this.volume:0,this.ctx.currentTime,.4);
    this.water.volume=audible?this.volume:0;
    if(audible)this.water.play().catch(()=>{});else this.water.pause();
  }
  setVolume(value){this.volume=value;this.applyMix();}
  setPrayerVolume(value){this.prayerVolume=value;this.recitation.volume=value;}
  playRecitation(){
    if(!this.enabled)return;this.recitation.volume=this.prayerVolume;
    this.recitation.play().catch(()=>this.toast('낭송 재생을 위해 소리 켜기를 눌러주세요.'));
  }
  startPrayer(){
    this.praying=true;this.applyMix();
    if(this.prayerEnabled){if(!this.enabled)this.enabled=true;this.recitation.volume=this.prayerVolume;this.playRecitation();}
  }
  stopPrayer(){
    this.praying=false;this.recitation.pause();this.applyMix();
    // Keep the listener's position. The next prayer continues instead of restarting a 145-minute recording.
  }
  setFile(file){
    if(!file||(!file.type.startsWith('audio/')&&!/\.(mp3|ogg|wav|m4a|aac)$/i.test(file.name))||file.size>100*1024*1024){this.toast('100MB 이하의 오디오 파일을 선택해주세요.');return;}
    this.recitation.pause();if(this.localUrl)URL.revokeObjectURL(this.localUrl);this.localUrl=URL.createObjectURL(file);this.recitation.src=this.localUrl;
    if(this.praying&&this.prayerEnabled)this.playRecitation();this.toast('선택한 기도음은 이 기기에서만 재생됩니다.');
  }
}
