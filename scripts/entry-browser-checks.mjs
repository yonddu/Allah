import assert from 'node:assert/strict';

export async function checkFirstVisits(browser,origin,output='artifacts'){
  const cases=[
    {locale:'ar-SA',language:'en',nextServer:true},
    {locale:'id-ID',language:'en'},
    {locale:'de-DE',language:'en'},
    {locale:'ar-SA',language:'en',saved:'ar',failedLocale:true},
    {locale:'ar-SA',language:'en',saved:'en'},
    {locale:'ar-SA',language:'ar',dir:'rtl',saved:'ar',legacyProfile:true},
    {locale:'en-US',language:'en',full:true}
  ];
  const report=[];
  for(const [index,test]of cases.entries()){
    const context=await browser.newContext({locale:test.locale,viewport:{width:390,height:844},isMobile:true,hasTouch:true,extraHTTPHeaders:{'CF-Connecting-IP':'198.18.26.'+(index+1)}}),errors=[];
    try{
      await context.addInitScript(test=>{
        if(test.saved)localStorage.setItem('noor-language',test.saved);
        if(test.legacyProfile)localStorage.setItem('noor-profile',JSON.stringify({name:'방문자',model:'model02',gender:'male'}));
        window.locationRequests=0;window.microphoneRequests=0;
        navigator.geolocation.getCurrentPosition=()=>{window.locationRequests++;};
        if(navigator.mediaDevices)navigator.mediaDevices.getUserMedia=()=>{window.microphoneRequests++;return Promise.reject(new Error('Unexpected microphone request'));};
      },test);
      const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
      await page.route('**/*',async route=>{
        const url=route.request().url();if(!url.startsWith(origin))return route.abort();
        if(url.endsWith('/locales/ar.json')){
          if(test.failedLocale)return route.abort();
          await new Promise(resolve=>setTimeout(resolve,500));
        }
        if(url.includes('/api/rooms?')&&(test.nextServer||test.full))return route.fulfill({json:{rooms:[1,2,3].map(server=>({server,count:test.full||server===1?50:0,capacity:50}))}});
        return route.continue();
      });
      await page.goto(origin+'/?qa=1',{waitUntil:'domcontentloaded'});
      // Even while a language download is delayed or unavailable, no Korean is painted.
      assert.equal(/[\uac00-\ud7a3]/.test(await page.locator('body').innerText()),false);
      await page.waitForFunction(()=>window.__noorScene?.hallReady&&document.getElementById('loading').hidden,null,{timeout:60000});
      if(test.full){await page.locator('#serverNotice').waitFor({state:'visible'});assert.match(await page.locator('#serverNoticeMessage').textContent(),/Server expansion is needed/);assert.equal(await page.locator('#serverNotice a').getAttribute('href'),'https://ko-fi.com/solh130919');assert.equal(await page.evaluate(()=>window.__noorScene.selfId||null),null);}
      else await page.waitForFunction(()=>window.__noorScene?.selfId&&document.getElementById('statusDot').classList.contains('connected'),null,{timeout:30000});
      assert.equal(await page.locator('html').getAttribute('lang'),test.language);
      assert.equal(await page.locator('html').getAttribute('dir'),test.dir||'ltr');
      assert.equal(await page.locator('dialog[open]').count(),0);
      assert.equal(await page.locator('#customPanel').isVisible(),false);
      assert.equal(await page.evaluate(()=>window.__noorScene.local.human.assetId),test.legacyProfile?'model02':'model01');
      assert.equal(await page.evaluate(()=>window.locationRequests),0);assert.equal(await page.evaluate(()=>window.microphoneRequests),0);
      const leaks=await page.evaluate(()=>{
        const leaks=[];
        for(const el of document.querySelectorAll('body *')){
          if(el.closest('script,style,#languageSelect')||!el.getClientRects().length||getComputedStyle(el).visibility==='hidden')continue;
          for(const node of el.childNodes)if(node.nodeType===Node.TEXT_NODE&&/[\uac00-\ud7a3]/.test(node.textContent))leaks.push(node.textContent);
          for(const attr of ['title','placeholder','aria-label'])if(/[\uac00-\ud7a3]/.test(el.getAttribute(attr)||''))leaks.push(attr+': '+el.getAttribute(attr));
        }
        return leaks;
      });
      assert.deepEqual(leaks,[],test.locale+' must not display Korean UI');
      if(test.nextServer)assert.equal(await page.locator('#currentMapName').textContent().then(s=>s.slice(-1)),'2');
      if(index<2){
        await page.locator('#prayerQuestSettings').click();await page.locator('#prayerCity').selectOption('17');await page.locator('#prayerTimesDialog [data-close]').click();
        assert.equal(await page.locator('#prayerQuestRows .prayer-quest-row').count(),5);
        const bounds=await page.locator('#prayerQuest').boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=390.5);
        await page.screenshot({path:output+'/first-visit-'+test.language+'.png'});
        await page.locator('#customizeButton').click();assert.equal(await page.locator('#customPanel').isVisible(),true);
        await page.locator('#displayName').fill('');await page.locator('#displayName').blur();
        const defaultName=await page.locator('#displayName').inputValue();assert.ok(defaultName.trim());assert.equal(/[\uac00-\ud7a3]/.test(defaultName),false,'Clearing a name must keep the localized visitor name');
        await page.locator('#closeCustomize').click();
        await page.locator('#mapButton').click();assert.equal(await page.locator('#mapDialog').isVisible(),true);assert.equal(await page.locator('.map-card').count(),4);await page.locator('#mapCloseButton').click();
      }
      assert.deepEqual(errors,[]);report.push({locale:test.locale,language:test.language,fallback:!!test.failedLocale,saved:!!test.saved,legacy:!!test.legacyProfile,full:!!test.full});
    }finally{await context.close();}
  }
  console.log(JSON.stringify({firstVisits:report}));return report;
}
