import http from 'node:http';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

export async function checkStatusFallback(browser){
 let mode='normal';
 const server=http.createServer(async(request,response)=>{
  const path=new URL(request.url,'http://localhost').pathname;
  if(path==='/'){
   if(mode==='offline'){response.destroy();return;}
   if(mode==='busy'){response.writeHead(503).end('Raw server error');return;}
   response.setHeader('Content-Type','text/html');response.end('<!doctype html><html lang="en"><h1>Fixture homepage</h1></html>');return;
  }
  // Cloudflare Assets canonicalizes .html URLs. A cached redirected response
  // cannot be returned directly for a navigation with redirect mode manual.
  if(path==='/server-busy.html'){response.writeHead(308,{Location:'/server-busy'}).end();return;}
  const files={'/server-busy':['public/server-busy.html','text/html'],'/sw.js':['public/sw.js','text/javascript'],'/assets/donation-qr.svg':['public/assets/donation-qr.svg','image/svg+xml']};
  const file=files[path];if(!file){response.writeHead(404).end();return;}
  try{response.setHeader('Content-Type',file[1]);response.end(await readFile(file[0]));}catch{response.writeHead(500).end();}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port,context=await browser.newContext(),page=await context.newPage();
 try{
  await page.goto(origin);
  await page.evaluate(async()=>{await navigator.serviceWorker.register('/sw.js');await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));});
  mode='busy';await page.reload();
  assert.match(await page.locator('main').textContent(),/server capacity/);
  assert.equal(await page.locator('a[href="https://ko-fi.com/solh130919"]').count(),1);
  await page.waitForFunction(()=>document.querySelector('img')?.naturalWidth>0);
  mode='normal';await page.locator('a[href="/"]').click();assert.equal(await page.locator('h1').textContent(),'Fixture homepage');
  mode='offline';await page.reload();assert.equal(await page.locator('h1').textContent(),'Noor is offline');
  mode='normal';await page.reload();assert.equal(await page.locator('h1').textContent(),'Fixture homepage');
  console.log('Service-worker fallback passed: canonical HTML redirect, 503 support link and QR, offline distinction and recovery.');
 }finally{await context.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
}
