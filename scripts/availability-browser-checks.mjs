import assert from 'node:assert/strict';

export async function checkServerAvailability(browser,origin){
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const page=await context.newPage(),errors=[];let mode='busy',sessionBusy=false,rejectSocket=false,lastSocket;
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
 await page.route('**/api/rooms?*',route=>{
  if(mode==='busy')return route.fulfill({status:503,contentType:'text/html',body:'Service unavailable'});
  if(mode==='full')return route.fulfill({json:{rooms:[1,2,3].map(server=>({server,count:50,capacity:50}))}});
  if(mode==='offline')return route.abort('internetdisconnected');
  return route.continue();
 });
 await page.route('**/api/session',route=>sessionBusy?route.fulfill({status:429,contentType:'text/html',body:'Too many requests'}):route.continue());
 await page.routeWebSocket('**/api/room?*',socket=>{
  if(rejectSocket){socket.close({code:1013,reason:'Busy'});return;}
  lastSocket=socket;socket.connectToServer();
 });
 try{
  await page.goto(origin+'/?qa=1&lang=ko',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!window.__noorScene?.hallReady,null,{timeout:60000});
  await page.locator('#serverNotice').waitFor({state:'visible',timeout:20000});
  assert.match(await page.locator('#serverNoticeMessage').textContent(),/서버 확장이 필요/);
  assert.equal(await page.locator('#serverNotice a').getAttribute('href'),'https://ko-fi.com/solh130919');
  await page.screenshot({path:'artifacts/server-busy-mobile.png'});
  mode='full';await page.locator('#serverRetry').click();
  await page.waitForFunction(()=>document.getElementById('serverNoticeMessage').textContent.includes('가득 찼습니다'));
  assert.equal(await page.locator('#statusDot.connected').count(),0);
  mode='offline';await page.locator('#serverRetry').click();
  await page.waitForFunction(()=>document.getElementById('serverNoticeMessage').textContent.includes('인터넷 연결'));
  assert.doesNotMatch(await page.locator('#serverNoticeMessage').textContent(),/서버 확장/);
  mode='ok';sessionBusy=true;await page.locator('#serverRetry').click();
  await page.waitForFunction(()=>document.getElementById('serverNoticeMessage').textContent.includes('접속 요청'));
  await page.evaluate(async()=>{await (await import('/i18n.js')).setLanguage('ar');});
  assert.equal(await page.locator('html').getAttribute('dir'),'rtl');
  const box=await page.locator('#serverNotice').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=390);
  await page.screenshot({path:'artifacts/server-busy-arabic.png'});
  await page.evaluate(async()=>{await (await import('/i18n.js')).setLanguage('ko');});
  sessionBusy=false;await page.locator('#serverRetry').click();
  await page.waitForFunction(()=>document.getElementById('statusDot').classList.contains('connected'),null,{timeout:20000});
  assert.equal(await page.locator('#serverNotice').isVisible(),false);
  // The browser cannot inspect a failed WebSocket upgrade. Diagnose it via
  // the directory and reject retries without filling any real production room.
  mode='full';rejectSocket=true;lastSocket.close({code:1013,reason:'Busy'});
  await page.locator('#serverNotice').waitFor({state:'visible',timeout:15000});
  assert.match(await page.locator('#serverNoticeMessage').textContent(),/가득 찼습니다/);
  await page.setViewportSize({width:1280,height:800});await page.screenshot({path:'artifacts/server-full-desktop.png'});
  await page.locator('#serverNoticeClose').click();assert.equal(await page.locator('#serverNotice').isVisible(),false);
  mode='ok';rejectSocket=false;
  await page.evaluate(()=>document.getElementById('serverRetry').click());
  await page.waitForFunction(()=>document.getElementById('statusDot').classList.contains('connected'),null,{timeout:20000});
  assert.equal(await page.locator('#serverNotice').isVisible(),false);assert.deepEqual(errors,[]);
  console.log('Overload browser checks passed: full room, HTTP 503/429, offline distinction, WebSocket failure, recovery, mobile and Arabic.');
 }finally{await context.close();}
}
