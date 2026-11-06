import {spawn} from 'node:child_process';
import {mkdir,writeFile,mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {WebSocket as TestSocket} from 'ws';
await mkdir('artifacts',{recursive:true});
const stateDirectory=await mkdtemp(join(tmpdir(),'noor-browser-test-'));
let log='';
const server=spawn(process.execPath,['node_modules/wrangler/bin/wrangler.js','dev','--local','--ip','127.0.0.1','--port','8787','--persist-to',stateDirectory],{stdio:['ignore','pipe','pipe']});
for(const stream of [server.stdout,server.stderr])stream.on('data',b=>log=(log+b.toString()).slice(-14000));
let browser,page;
try{
  let healthy=false;
  for(let n=0;n<120;n++){try{const r=await fetch('http://127.0.0.1:8787/api/health');if(r.ok){healthy=true;break;}}catch{}await delay(500);}
  if(!healthy)throw new Error('Local Worker did not start.\n'+log);
  browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  await context.addInitScript(()=>{Object.defineProperty(navigator,'deviceMemory',{get:()=>4,configurable:true});Object.defineProperty(navigator,'hardwareConcurrency',{get:()=>4,configurable:true});});
  page=await context.newPage();const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>route.request().url().startsWith('http://127.0.0.1:8787')?route.continue():route.abort());
  await page.goto('http://127.0.0.1:8787/?qa=1',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!window.__noorScene?.hallReady,null,{timeout:60000});
  assert.equal(await page.locator('html').getAttribute('lang'),'id');
  assert.equal(await page.locator('#entryLanguageSelect').inputValue(),'id');
  await page.locator('#entryLanguageSelect').selectOption('ko');
  await page.waitForFunction(()=>document.documentElement.lang==='ko');
  await page.locator('#entryNextButton').click();
  assert.equal(await page.locator('#entryCharacterHost #customPanel').count(),1);
  assert.equal(await page.locator('#entryAvatarPreview #scene').count(),1);
  await page.locator('[data-field="gender"] [data-value="female"]').click();
  assert.equal(await page.locator('#characterChoices button:visible').count(),3);
  await page.locator('#tab-outfit').click();
  assert.equal(await page.locator('#wardrobeChoices button:visible').count(),3);
  await page.locator('#wardrobeChoices [data-value="model09"]').click();
  await page.evaluate(()=>window.__noorScene.local.human.ready);
  assert.equal(await page.evaluate(()=>window.__noorScene.diagnostics().userModel),'model09');
  await page.screenshot({path:'artifacts/female-character-setup.png'});
  assert.equal(await page.locator('[data-field="cover"] [data-value="none"]').isVisible(),false);
  assert.equal(await page.locator('[data-field="cover"] [data-value="hijab"]').getAttribute('aria-pressed'),'true');
  await page.locator('#displayName').fill('QA visitor');
  await page.locator('#displayName').blur();
  await page.locator('#entryNextButton').click();
  await page.locator('#enterRoomButton').click();
  await page.waitForFunction(()=>!document.getElementById('mapDialog').open);
  await page.waitForFunction(()=>document.getElementById('statusDot').classList.contains('connected'),null,{timeout:20000});
  assert.equal(await page.locator('#app > #scene').count(),1);
  assert.equal(await page.locator('.welcome-copy').count(),0);
  assert.equal(await page.locator('#qiblaCard').count(),0);
  assert.equal(await page.locator('#fenceButton').count(),0);
  assert.equal(await page.locator('#quranLink').getAttribute('href'),'https://quran.com/');
  await page.locator('#prayerTimesButton').click();
  await page.locator('#prayerCity').selectOption('0');
  assert.equal(await page.locator('#prayerRows .prayer-time-row').count(),5);
  assert.ok((await page.locator('#prayerCountdown').textContent()).includes('다음 기도'));
  await page.locator('.prayer-options summary').click();await page.locator('#prayerMadhab').selectOption('Hanafi');
  await page.locator('#prayerCity').selectOption('17');
  assert.ok((await page.locator('#prayerLocation').textContent()).includes('America/New_York'));
  assert.equal(await page.locator('#prayerRows time').count(),5);
  await page.screenshot({path:'artifacts/prayer-times.png'});
  await page.locator('#prayerTimesDialog [data-close]').click();
  const before=await page.evaluate(()=>window.__noorScene.diagnostics().position);
  const stick=await page.locator('#joystick').boundingBox(),cx=stick.x+stick.width/2,cy=stick.y+stick.height/2;
  await page.mouse.move(cx,cy);await page.mouse.down();await page.mouse.move(cx+24,cy);await delay(400);await page.mouse.up();await delay(200);
  const after=await page.evaluate(()=>window.__noorScene.diagnostics());
  assert.ok(Math.hypot(after.position.x-before.x,after.position.z-before.z)>.1);
  assert.deepEqual(after.joystick,{x:0,y:0});assert.equal(after.tier,'low');
  await page.evaluate(()=>{const s=window.__noorScene;s.portraitMode=true;s.cameraAngle=s.yaw+Math.PI;s.cameraHeight=1.6;s.cameraDistance=3.2;});
  await delay(800);await page.screenshot({path:'artifacts/avatar-front.png'});
  await page.locator('#greetingButton').click();
  await page.waitForFunction(()=>window.__noorScene.local.greetingLabel.visible);
  await page.screenshot({path:'artifacts/greeting.png'});
  await page.locator('#prayerButton').click();
  assert.equal(await page.locator('#prayerQuranLink').isVisible(),true);
  assert.equal(await page.locator('#prayerQuranLink').getAttribute('href'),'https://quran.com/');
  assert.equal(await page.locator('#chatDock').isVisible(),false);
  assert.equal(await page.locator('#greetingButton').isVisible(),false);
  for(let n=0;n<4;n++){
    await delay(500);await page.screenshot({path:'artifacts/prayer-pose-'+n+'.png'});
    if(n===2){
      const visual=await page.evaluate(()=>{
        const s=window.__noorScene,previous={angle:s.cameraAngle,height:s.cameraHeight,distance:s.cameraDistance,portrait:s.portraitMode};
        for(let frame=0;frame<180;frame++)s.local.human.update('prostrating',true,performance.now()/1000,false,1/60);
        s.cameraAngle=Math.PI/2;s.cameraHeight=.9;s.cameraDistance=2.6;s.portraitMode=false;s.snapCamera();s.local.root.updateMatrixWorld(true);s.renderer.render(s.scene,s.camera);
        const source=s.renderer.domElement,c=document.createElement('canvas');c.width=320;c.height=Math.round(source.height*.6/source.width*320);c.getContext('2d').drawImage(source,0,source.height*.20,source.width,source.height*.60,0,0,c.width,c.height);
        const data=c.toDataURL('image/jpeg',.6);s.cameraAngle=previous.angle;s.cameraHeight=previous.height;s.cameraDistance=previous.distance;s.portraitMode=previous.portrait;s.snapCamera();return data;
      });console.log('NOOR_PROSTRATION_QA:'+visual);
    }
    await page.locator('#poseButton').click();
  }
  await page.locator('#prayerButton').click();
  assert.equal(await page.locator('#prayerQuranLink').isVisible(),false);
  assert.equal(await page.locator('#chatDock').isVisible(),true);
  await page.evaluate(()=>{const s=window.__noorScene;s.portraitMode=false;s.cameraAngle=.42;s.cameraHeight=1.6;s.cameraDistance=5.2;});
  await delay(700);
  const framing=await page.evaluate(()=>{const s=window.__noorScene,p=s.camera.position.clone().set(s.position.x,.94,s.position.z).project(s.camera),label=s.local.label.element;return {x:p.x,y:p.y,labelText:label.textContent,labelFont:parseFloat(getComputedStyle(label).fontSize),htmlLabel:label.tagName,pixelRatio:s.renderer.getPixelRatio()};});
  assert.ok(Math.abs(framing.x)<.08&&Math.abs(framing.y)<.08,'Avatar body must be in the screen centre: '+JSON.stringify(framing));assert.equal(framing.htmlLabel,'DIV');assert.ok(framing.labelFont>=12);assert.equal(framing.labelText,'QA visitor');assert.ok(framing.pixelRatio>=1);
  assert.ok(await page.locator('#chatMode').evaluate(el=>parseFloat(getComputedStyle(el).fontSize)>=11));
  assert.ok(await page.locator('#publicChatTab').evaluate(el=>parseFloat(getComputedStyle(el).fontSize)>=12));
  await page.screenshot({path:'artifacts/centred-readable-mobile.png'});
  // The play HUD leaves the middle open; chat and movement occupy separate bottom corners.
  assert.equal(await page.locator('#customPanel').isVisible(),false);
  const dock=await page.locator('#chatDock').boundingBox(),action=await page.locator('.actionbar').boundingBox();
  assert.ok(dock.x>=stick.x+stick.width&&dock.y>500&&dock.y+dock.height<=action.y,JSON.stringify({dock,action,stick}));
  await page.locator('#collapseChatButton').click();assert.equal(await page.locator('#chatBody').isVisible(),false);
  await page.locator('#collapseChatButton').click();
  const mainId=await page.evaluate(async()=>{const r=await fetch('/api/social');return (await r.json()).id;});
  const peerContexts=[];
  for(const name of ['Chat guest','Uninvolved guest']){
    const ctx=await browser.newContext(),peer=await ctx.newPage();peerContexts.push(ctx);
    await peer.goto('http://127.0.0.1:8787/api/health');
    await peer.evaluate(async name=>{
      const r=await fetch('/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name})});window.chatIdentity=await r.json();
      window.chatReceived=[];await new Promise((resolve,reject)=>{window.chatSocket=new WebSocket('ws://127.0.0.1:8787/api/room?room=mecca:1');window.chatSocket.onmessage=e=>{const m=JSON.parse(e.data);window.chatReceived.push(m);if(m.type==='welcome')resolve();};window.chatSocket.onerror=reject;});
    },name);
  }
  const guest=peerContexts[0].pages()[0],other=peerContexts[1].pages()[0],guestId=await guest.evaluate(()=>window.chatIdentity.id);
  await page.evaluate(async()=>{
    const s=window.__noorScene;await Promise.all([...s.remote.values()].map(a=>a.human.ready));
    s.cameraAngle=0;s.cameraDistance=9;s.cameraHeight=1.6;s.portraitMode=false;s.snapCamera();
  });
  async function rightClickGuest(){
    const point=await page.evaluate(id=>{
      const s=window.__noorScene,a=[...s.remote.values()].find(a=>a.accountId===id),p=a.root.position.clone();p.y=1.05;p.project(s.camera);const r=s.renderer.domElement.getBoundingClientRect();
      return {x:r.x+(p.x+1)*r.width/2,y:r.y+(1-p.y)*r.height/2};
    },guestId);
    await page.mouse.click(point.x,point.y,{button:'right'});
    await page.locator('#playerMenu').waitFor({state:'visible'});
  }
  await rightClickGuest();assert.equal(await page.locator('#playerMenuTitle').textContent(),'Chat guest');
  await page.locator('#playerGreetAction').click();
  await guest.waitForFunction(id=>window.chatReceived.some(m=>m.type==='greeting'&&m.to===id),guestId);
  assert.equal(await page.locator('#playerMenu').isVisible(),false);
  await rightClickGuest();await page.locator('#playerWhisperAction').click();
  assert.equal(await page.locator('#whisperTarget').inputValue(),guestId);
  assert.equal(await page.locator('#whisperChatTab').getAttribute('aria-selected'),'true');
  await page.locator('#chatInput').fill('Private browser test');await page.locator('#sendChatButton').click();
  await guest.waitForFunction(()=>window.chatReceived.some(m=>m.type==='whisper'&&m.text==='Private browser test'));
  assert.equal(await other.evaluate(()=>window.chatReceived.some(m=>m.type==='whisper')),false);
  await page.locator('#peopleButton').click();await page.locator('#whispersOff').check();
  await page.waitForFunction(()=>!document.getElementById('whispersOff').disabled);
  await guest.evaluate(id=>window.chatSocket.send(JSON.stringify({type:'whisper',to:id,text:'Must not appear'})),mainId);
  await guest.waitForFunction(()=>window.chatReceived.some(m=>m.type==='notice'));
  assert.equal(await page.locator('#chatMessages').textContent(),'');
  await page.locator('#publicChatOff').check();await page.waitForFunction(()=>!document.getElementById('publicChatOff').disabled);
  const saved=await page.evaluate(async()=>{const r=await fetch('/api/social');return r.json();});assert.equal(saved.publicChat,false);assert.equal(saved.whispers,false);
  await page.locator('#roomPeople .friend-row').filter({hasText:'Chat guest'}).getByRole('button',{name:'차단',exact:true}).click();
  await page.waitForFunction(id=>window.__noorScene.blockedIds.has(id),guestId);
  await delay(100);
  const blocked=await page.evaluate(id=>[...window.__noorScene.remote.values()].filter(a=>a.accountId===id).every(a=>!a.hips.visible&&!a.simple.visible&&!a.label.visible),guestId);assert.equal(blocked,true);
  await page.locator('#blockedPeople').getByRole('button',{name:'차단 해제',exact:true}).click();
  await page.waitForFunction(id=>!window.__noorScene.blockedIds.has(id),guestId);
  await page.locator('#publicChatOff').uncheck();await page.waitForFunction(()=>!document.getElementById('publicChatOff').disabled);
  await page.locator('#whispersOff').uncheck();await page.waitForFunction(()=>!document.getElementById('whispersOff').disabled);
  await page.locator('#peopleDialog [data-close]').click();
  for(const ctx of peerContexts)await ctx.close();
  await page.waitForFunction(()=>window.__noorScene.remote.size===0);
  await page.locator('#publicChatTab').click();
  // Exercise the production50-connection admission boundary in the real local Worker.
  const cookie=(await context.cookies()).filter(c=>c.name==='noor_session').map(c=>c.name+'='+c.value).join(';'),capacitySockets=[];
  try{
    for(let i=0;i<49;i++)await new Promise((resolve,reject)=>{
      const ws=new TestSocket('ws://127.0.0.1:8787/api/room?room=mecca:1',{origin:'http://127.0.0.1:8787',headers:{Cookie:cookie}});capacitySockets.push(ws);ws.on('error',reject);ws.on('message',b=>{if(JSON.parse(b).type==='welcome')resolve();});
    });
    const room=await page.evaluate(async()=>{const r=await fetch('/api/rooms?map=mecca');return (await r.json()).rooms[0];});assert.equal(room.count,50);assert.equal(room.capacity,50);
    const overflow=await new Promise((resolve,reject)=>{const ws=new TestSocket('ws://127.0.0.1:8787/api/room?room=mecca:1',{origin:'http://127.0.0.1:8787',headers:{Cookie:cookie}});ws.on('unexpected-response',(_,r)=>{resolve(r.statusCode);r.resume();});ws.on('open',()=>{ws.close();reject(new Error('51st connection admitted'));});ws.on('error',()=>{});});assert.equal(overflow,503);
  }finally{for(const ws of capacitySockets)ws.close();}
  await page.waitForFunction(()=>window.__noorScene.remote.size===0,null,{timeout:30000});
  // Render 32 total avatars locally; no test messages are sent to a public room.
  await page.evaluate(async()=>{
    const {sanitizeProfile}=await import('/core.js'),scene=window.__noorScene;scene.cameraAngle=0;scene.cameraDistance=11.6;scene.cameraHeight=4.1;scene.portraitMode=false;const origin={...scene.position};
    for(let n=0;n<31;n++)scene.syncPlayer({id:'benchmark-'+n,accountId:'qa-'+n,profile:sanitizeProfile({name:'Visitor '+n,color:n%6,skin:n%5,cover:n%2?'kufi':'hijab'}),x:origin.x+(n%7-3),z:origin.z-2-Math.floor(n/7)*1.5,pose:n%3?'standing':'sitting',praying:n%3===0,yaw:0,protected:false});
  });
  await page.evaluate(()=>Promise.all([...window.__noorScene.remote.values()].map(a=>a.human.ready)));
  await delay(1000);
  const crowd=await page.evaluate(()=>window.__noorScene.diagnostics());
  assert.equal(crowd.remoteVisitors,31);assert.equal(crowd.userModelsReady,32);assert.ok(crowd.drawCalls>=35,'Crowd body meshes must be rendered: '+JSON.stringify(crowd));assert.ok(crowd.drawCalls<180,JSON.stringify(crowd));assert.ok(crowd.triangles<300000,JSON.stringify(crowd));
  await page.screenshot({path:'artifacts/mobile-32-visitors.png'});
  const maps=[{map:'mecca',...crowd}];
  for(const map of ['taj']){
    await page.locator('#mapButton').click();
    await page.locator('.map-card[data-map="'+map+'"]').click();
    await page.locator('#enterRoomButton').click();
    await page.waitForFunction(id=>window.__noorScene.hallReady&&window.__noorScene.mapId===id,map,{timeout:30000});
    await delay(1100);
    const centre=await page.evaluate(()=>{const s=window.__noorScene;return s.camera.position.clone().set(s.position.x,.94,s.position.z).project(s.camera).y;});assert.ok(Math.abs(centre)<.08,'Avatar must stay centred after changing maps');
    if(map==='taj'){const dome=await page.evaluate(()=>{const s=window.__noorScene,p=s.camera.position.clone().set(0,45,-52).project(s.camera);return {x:p.x,y:p.y};});assert.ok(Math.abs(dome.x)<1&&Math.abs(dome.y)<1,'Taj dome must be in the play view: '+JSON.stringify(dome));}
    maps.push({map,...await page.evaluate(()=>window.__noorScene.diagnostics())});
    await page.screenshot({path:'artifacts/mobile-'+map+'.png'});
  }
  await page.locator('#settingsButton').click();await page.locator('#settingsLanguageButton').click();await page.locator('#languageSelect').selectOption('ar');
  await page.waitForFunction(()=>document.documentElement.dir==='rtl');
  await page.locator('#closeLanguage').click();
  assert.equal(await page.locator('#qiblaCard').count(),0);
  await page.locator('#settingsButton').click();
  await page.locator('#qualitySelect').selectOption('high');
  await page.waitForFunction(()=>window.__noorScene.hallReady&&window.__noorScene.loadedAsset==='high',null,{timeout:30000});
  assert.equal(await page.evaluate(()=>window.__noorScene.renderer.shadowMap.autoUpdate),true);
  await writeFile('artifacts/browser-report.json',JSON.stringify({capacity50:true,note:'Desktop Chromium with software WebGL; these are rendering budgets, not real-phone FPS measurements.',maps,errors},null,2));
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({browser:'passed',maps:maps.map(m=>({map:m.map,drawCalls:m.drawCalls,triangles:m.triangles})),crowdDrawCalls:crowd.drawCalls}));
}catch(error){
  if(page)try{await page.screenshot({path:'artifacts/failure.png'});}catch{}
  await writeFile('artifacts/failure.txt',String(error.stack||error));
  throw error;
}finally{
  if(browser)await browser.close();server.kill('SIGTERM');await writeFile('artifacts/local-worker.log',log);
}
