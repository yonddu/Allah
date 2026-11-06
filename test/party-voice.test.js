import test from 'node:test';import assert from 'node:assert/strict';import {PartyVoice} from '../public/party-voice.js';import {FEATURE_KEYS,FEATURE_LOCALES} from '../public/feature-labels.js';
test('Every supported language includes the party and support labels',()=>{assert.equal(Object.keys(FEATURE_LOCALES).length,21);for(const [code,labels]of Object.entries(FEATURE_LOCALES)){assert.equal(labels.length,FEATURE_KEYS.length,code);assert.ok(labels.every(x=>typeof x==='string'&&x.trim()),code);}});
function setup(getMedia){
 const sent=[];let voice;const track={enabled:true,readyState:'live',stop(){this.readyState='ended';}},stream={getTracks:()=>[track],getAudioTracks:()=>[track]},me={id:'self',accountId:'u1',voiceReady:false,epoch:'',praying:false};
 voice=new PartyVoice({send:message=>{sent.push(message);if(message.type==='party-voice'&&message.enabled)queueMicrotask(()=>voice.applyState({id:'party',members:[{...me,voiceReady:true,epoch:message.epoch}]},'self'));return true;},configProvider:async()=>({iceServers:[],relayOnly:false,expiresAt:Date.now()+600000}),mediaDevices:()=>({getUserMedia:getMedia||(async()=>stream)})});
 voice.applyState({id:'party',members:[me]},'self');return {voice,sent,track,stream};
}
test('Microphone is opt-in; mute, prayer, leave and reconnect never leave capture running',async()=>{
 const s=setup();assert.equal(s.voice.stream,null);assert.equal(s.sent.length,0);assert.equal(await s.voice.enable(),true);assert.equal(s.track.readyState,'live');s.voice.setMuted(true);assert.equal(s.track.enabled,false);
 s.voice.setPrayer(true);assert.equal(s.track.readyState,'ended');assert.equal(s.voice.enabled,false);assert.equal(s.voice.peers.size,0);s.voice.setPrayer(false);assert.equal(s.voice.enabled,false);
 assert.ok(s.sent.some(m=>m.type==='party-voice'&&m.enabled===false));s.voice.reset();assert.equal(s.voice.stream,null);
});
test('A permission prompt completing after prayer starts immediately stops its new track',async()=>{
 let resolve;const s=setup(()=>new Promise(r=>resolve=r)),pending=s.voice.enable();s.voice.setPrayer(true);resolve(s.stream);assert.equal(await pending,false);assert.equal(s.track.readyState,'ended');assert.equal(s.sent.some(m=>m.enabled===true),false);
});
