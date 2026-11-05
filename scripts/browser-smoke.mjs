import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
await mkdir('artifacts',{recursive:true});
let log='';
const server=spawn(process.execPath,['node_modules/wrangler/bin/wrangler.js','dev','--local','--ip','127.0.0.1','--port','8787'],{stdio:['ignore','pipe','pipe']});
for(const stream of [server.stdout,server.stderr])stream.on('data',b=>log=(log+b.toString()).slice(-14000));
let browser;
try{
  let healthy=false;
  for(let n=0;n<120;n++){try{const r=await fetch('http://127.0.0.1:8787/api/health');if(r.ok){healthy=true;break;}}catch{}await delay(500);}
  if(!healthy)throw new Error('Local Worker did not start.\n'+log);
  browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  const page=await context.newPage(),errors=[];
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
  await page.locator('#tab-outfit').click();
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
  const card=await page.locator('#qiblaCard').boundingBox();
  assert.ok(card.x<35&&card.y<125&&card.width<=190);
  await page.locator('#qiblaExpandButton').click();
  await page.locator('#citySelect').selectOption('35.8714,128.6014');
  assert.equal(await page.locator('#kaabaMarker').isVisible(),true);
  const marker=await page.locator('#kaabaMarker').evaluate(el=>({left:parseFloat(el.style.left),top:parseFloat(el.style.top)}));
  assert.ok(marker.left<50&&marker.top<50);
  await page.locator('#qiblaExpandButton').click();
  const before=await page.evaluate(()=>window.__noorScene.diagnostics().position);
  const stick=await page.locator('#joystick').boundingBox(),cx=stick.x+stick.width/2,cy=stick.y+stick.height/2;
  await page.mouse.move(cx,cy);await page.mouse.down();await page.mouse.move(cx+24,cy);await delay(400);await page.mouse.up();await delay(200);
  const after=await page.evaluate(()=>window.__noorScene.diagnostics());
  assert.ok(Math.hypot(after.position.x-before.x,after.position.z-before.z)>.1);
  assert.deepEqual(after.joystick,{x:0,y:0});assert.equal(after.tier,'low');
  // Render 32 total avatars locally; no test messages are sent to a public room.
  await page.evaluate(async()=>{
    const {sanitizeProfile}=await import('/core.js'),scene=window.__noorScene;
    for(let n=0;n<31;n++)scene.syncPlayer({id:'benchmark-'+n,accountId:'qa-'+n,profile:sanitizeProfile({name:'Visitor '+n,color:n%6,skin:n%5,cover:n%2?'kufi':'hijab'}),x:(n%7-3)*1.8,z:Math.floor(n/7)*2.5,pose:n%3?'standing':'sitting',praying:n%3===0,yaw:0,protected:false});
  });
  await delay(1000);
  const crowd=await page.evaluate(()=>window.__noorScene.diagnostics());
  assert.equal(crowd.remoteVisitors,31);assert.ok(crowd.drawCalls<260,JSON.stringify(crowd));assert.ok(crowd.triangles<150000,JSON.stringify(crowd));
  await page.screenshot({path:'artifacts/mobile-32-visitors.png'});
  const maps=[{map:'zayed',...crowd}];
  for(const map of ['blue','nabawi']){
    await page.locator('#mapButton').click();
    await page.locator('.map-card[data-map="'+map+'"]').click();
    await page.locator('#enterRoomButton').click();
    await page.waitForFunction(id=>window.__noorScene.hallReady&&window.__noorScene.mapId===id,map,{timeout:30000});
    await delay(300);maps.push({map,...await page.evaluate(()=>window.__noorScene.diagnostics())});
    await page.screenshot({path:'artifacts/mobile-'+map+'.png'});
  }
  await page.locator('#languageButton').click();await page.locator('#languageSelect').selectOption('ar');
  await page.waitForFunction(()=>document.documentElement.dir==='rtl');
  await page.locator('#closeLanguage').click();
  const rtlCard=await page.locator('#qiblaCard').boundingBox();assert.ok(rtlCard.x<35);
  await writeFile('artifacts/browser-report.json',JSON.stringify({note:'Desktop Chromium with software WebGL; these are rendering budgets, not real-phone FPS measurements.',maps,errors},null,2));
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({browser:'passed',maps:maps.map(m=>({map:m.map,drawCalls:m.drawCalls,triangles:m.triangles})),crowdDrawCalls:crowd.drawCalls}));
}finally{
  if(browser)await browser.close();server.kill('SIGTERM');await writeFile('artifacts/local-worker.log',log);
}
