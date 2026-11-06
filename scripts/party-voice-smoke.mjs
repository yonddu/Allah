import {spawn} from 'node:child_process';import {mkdir,writeFile,mkdtemp} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {setTimeout as delay} from 'node:timers/promises';import assert from 'node:assert/strict';import {chromium} from 'playwright';
await mkdir('artifacts',{recursive:true});const state=await mkdtemp(join(tmpdir(),'noor-party-'));const origin='http://127.0.0.1:8790';let log='',browser;const contexts=[];
const worker=spawn(process.execPath,['node_modules/wrangler/bin/wrangler.js','dev','--local','--ip','127.0.0.1','--port','8790','--var','NOOR_VOICE_TEST_MODE:1','--persist-to',state],{stdio:['ignore','pipe','pipe']});for(const stream of [worker.stdout,worker.stderr])stream.on('data',b=>log=(log+b).slice(-20000));
try{
 let healthy=false;for(let n=0;n<100;n++){try{if((await fetch(origin+'/api/health')).ok){healthy=true;break;}}catch{}await delay(250);}assert.ok(healthy,log);
 browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});const pages=[],errors=[];
 for(const name of ['Voice A','Voice B','Outside party']){
  const context=await browser.newContext({viewport:{width:390,height:844}});contexts.push(context);await context.grantPermissions(['microphone'],{origin});await context.addInitScript(name=>{
   localStorage.setItem('noor-language','ko');localStorage.setItem('noor-onboarded','1');localStorage.setItem('noor-room','mecca:2');localStorage.setItem('noor-profile',JSON.stringify({name,model:'model03',gender:'male'}));
   window.micRequests=0;const get=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=(...args)=>{window.micRequests++;return get(...args);};
  },name);
  const page=await context.newPage();pages.push(page);page.on('pageerror',error=>errors.push(error.message));await page.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
  await page.goto(origin+'/?qa=1',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__noorScene?.hallReady,null,{timeout:60000});await page.locator('#enterRoomButton').click();await page.waitForFunction(()=>window.__noorScene?.selfId&&window.__noorParty,null,{timeout:60000});
  await page.evaluate(()=>window.__noorScene.renderer.setAnimationLoop(null));
 }
 const [a,b,c]=pages,bId=await b.evaluate(()=>window.__noorScene.selfId);
 for(const page of pages)assert.equal(await page.evaluate(()=>window.micRequests),0);
 await a.locator('#partyButton').click();await a.locator('#partyCreateButton').click();await a.waitForFunction(()=>window.__noorParty.diagnostics().members===1);
 await a.locator('#partyInviteTarget').selectOption(bId);await a.locator('#partyInviteButton').click();
 await b.locator('#partyButton').click();await b.locator('#partyInvites').getByRole('button',{name:'수락',exact:true}).click();
 for(const page of [a,b])await page.waitForFunction(()=>window.__noorParty.diagnostics().members===2);
 assert.equal(await c.evaluate(()=>window.__noorParty.diagnostics().partyId),null);
 for(const page of [a,b])await page.locator('#partyVoiceJoin').click();
 for(const page of [a,b])await page.waitForFunction(()=>window.__noorParty.diagnostics().connectedPeers===1,null,{timeout:25000});
 const bytes=[];for(const page of [a,b]){
  await page.waitForFunction(async()=>{for(const entry of window.__noorParty.voice.peers.values()){const stats=await entry.pc.getStats();for(const r of stats.values())if(r.type==='inbound-rtp'&&r.bytesReceived>0)return true;}return false;},null,{timeout:15000});
  bytes.push(await page.evaluate(async()=>{let n=0;for(const entry of window.__noorParty.voice.peers.values())for(const r of (await entry.pc.getStats()).values())if(r.type==='inbound-rtp')n+=r.bytesReceived||0;return n;}));
 }
 assert.equal(await c.evaluate(()=>window.micRequests),0);assert.equal(await c.evaluate(()=>window.__noorParty.diagnostics().peerCount),0);
 await a.locator('#partyMicButton').click();assert.equal(await a.evaluate(()=>window.__noorParty.voice.stream.getAudioTracks()[0].enabled),false);
 await a.evaluate(()=>window.capturedTrack=window.__noorParty.voice.stream.getAudioTracks()[0]);
 await a.locator('#partyDialog [data-close]').click();await a.locator('#prayerButton').click();await a.waitForFunction(()=>!window.__noorParty.diagnostics().voiceActive);
 assert.equal(await a.evaluate(()=>window.capturedTrack.readyState),'ended');await b.waitForFunction(()=>window.__noorParty.diagnostics().peerCount===0);
 await a.locator('#prayerButton').click();assert.equal(await a.evaluate(()=>window.__noorParty.diagnostics().voiceActive),false);assert.equal(await a.evaluate(()=>window.micRequests),1);
 await a.locator('#partyButton').click();await a.locator('#partyVoiceJoin').click();await a.waitForFunction(()=>window.__noorParty.diagnostics().connectedPeers===1,null,{timeout:25000});
 await a.locator('#partyLeaveButton').click();await a.waitForFunction(()=>window.__noorParty.diagnostics().partyId===null);await b.waitForFunction(()=>window.__noorParty.diagnostics().peerCount===0);
 await a.locator('#partyDialog [data-close]').click();await a.locator('#donateButton').click();assert.equal(await a.locator('#donationLink').getAttribute('href'),'https://ko-fi.com/solh130919');assert.equal(await a.locator('#donationMessage').textContent(),"여러분의 후원으로 서버가 유지, 개선 됩니다. 감사합니다. 평화가 있길");await a.waitForFunction(()=>document.getElementById('donationQr').naturalWidth>0);await a.screenshot({path:'artifacts/donation-dialog.png'});
 assert.deepEqual(errors,[]);const report={passed:true,syntheticMicrophones:true,receivedAudioBytes:bytes,outsiderHasAudio:false,prayerStoppedCapture:true,autoMicResume:false,donation:true,errors};await writeFile('artifacts/party-voice-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}catch(error){await writeFile('artifacts/party-voice-failure.txt',String(error.stack||error));for(let i=0;i<contexts.length;i++)try{await contexts[i].pages()[0]?.screenshot({path:'artifacts/party-failure-'+i+'.png'});}catch{}throw error;
}finally{if(browser)await browser.close();worker.kill('SIGTERM');await writeFile('artifacts/party-worker.log',log);}
