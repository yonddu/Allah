import test from 'node:test';import assert from 'node:assert/strict';
import {AdhanAudio} from '../public/adhan-audio.js';

test('Adhan requires a gesture, plays once, and cannot resume after disabling or leaving the page',async()=>{
 const previous={window:globalThis.window,Audio:globalThis.Audio,localStorage:globalThis.localStorage};
 const saved=new Map(),events={};let plays=0,resolvePlay;
 class Media{addEventListener(){}pause(){this.paused=true;}play(){plays++;this.paused=false;return resolvePlay?new Promise(r=>{resolvePlay=r;}):Promise.resolve();}}
 class Context{createGain(){return {gain:{value:0},connect(){}};}createMediaElementSource(){return {connect(){}};}resume(){return Promise.resolve();}close(){return Promise.resolve();}}
 globalThis.window={AudioContext:Context,addEventListener:(key,fn)=>events[key]=fn};globalThis.Audio=Media;globalThis.localStorage={getItem:key=>saved.get(key),setItem:(key,value)=>saved.set(key,value)};
 try{
  const changes=[],audio=new AdhanAudio({onPlaying:p=>changes.push(p)}),event={id:'fajr-1',at:1000,now:6000};
  assert.equal(await audio.play(event),false);assert.equal(plays,0);
  await audio.enable();assert.equal(audio.unlocked,true);assert.equal(await audio.play(event),true);assert.equal(audio.audio.currentTime,5);
  assert.equal(await audio.play(event),false);audio.stop();assert.equal(await audio.play(event),false);
  const reloaded=new AdhanAudio();await reloaded.enable();assert.equal(await reloaded.play(event),false,'Already heard in this browser');
  resolvePlay=true;const pending=audio.play({...event,id:'dhuhr-1'});await new Promise(r=>setImmediate(r));const media=audio.audio;audio.setEnabled(false);resolvePlay();assert.equal(await pending,false);assert.equal(media.paused,true);assert.equal(audio.playing,false);assert.equal(saved.get('noor-adhan-played'),'fajr-1');
  resolvePlay=null;await audio.enable();resolvePlay=true;const leaving=audio.play({...event,id:'asr-1'});await new Promise(r=>setImmediate(r));audio.close();resolvePlay();assert.equal(await leaving,false);assert.equal(audio.unlocked,false);assert.equal(audio.audio,null);
  resolvePlay=null;const blocked=new AdhanAudio();await blocked.enable();blocked.audio.play=()=>Promise.reject(new Error('NotAllowedError'));assert.equal(await blocked.play({...event,id:'isha-1'}),false);assert.equal(blocked.unlocked,false);assert.equal(blocked.playing,false);
  assert.deepEqual(changes,[true,false]);events.pagehide();
 }finally{for(const [key,value]of Object.entries(previous))if(value===undefined)delete globalThis[key];else globalThis[key]=value;}
});
