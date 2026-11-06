import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
import assert from 'node:assert/strict';
import {WebSocket} from 'ws';
import {chromium} from 'playwright';
await mkdir('artifacts',{recursive:true});
const origin='http://127.0.0.1:8788',server=spawn(process.execPath,['node_modules/wrangler/bin/wrangler.js','dev','--local','--ip','127.0.0.1','--port','8788','--var','NOOR_ROOM_CAPACITY:100','--persist-to','work/capacity-state'],{stdio:['ignore','pipe','pipe']});
let log='',browser;const clients=[];
for(const s of [server.stdout,server.stderr])s.on('data',b=>log=(log+b).slice(-14000));
const until=async(fn,limit=20000)=>{const start=Date.now();while(!fn()){if(Date.now()-start>limit)throw new Error('Capacity check timeout');await delay(20);}};
try{
 let healthy=false;for(let i=0;i<180;i++){try{if((await fetch(origin+'/api/health')).ok){healthy=true;break;}}catch{}await delay(500);}if(!healthy)throw new Error(log);
 let received=0,bytes=0;const receipts=new Map(),latencies=[];
 for(let i=0;i<100;i++){
  const r=await fetch(origin+'/api/session',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','CF-Connecting-IP':'198.18.0.'+(i+1)},body:JSON.stringify({name:'Capacity '+i})});
  if(!r.ok)throw new Error('Test identity '+i+': '+r.status+' '+await r.text());
  const identity=await r.json(),cookie=r.headers.get('set-cookie').split(';')[0];
  const client={identity,cookie,latest:0,messages:[],received:0};
  await new Promise((resolve,reject)=>{
   const ws=client.ws=new WebSocket(origin.replace('http:','ws:')+'/api/room?room=mecca:3',{origin,headers:{Cookie:cookie}});
   ws.on('error',reject);ws.on('message',b=>{
    const m=JSON.parse(b);client.received++;received++;bytes+=b.length;
    if(m.type==='welcome'){client.id=m.id;client.x=m.self.x;client.z=m.self.z;resolve();}
    if(m.type==='state'&&m.player.id===client.id){client.latest=m.player.seq;const sent=receipts.get(client.id+':'+m.player.seq);if(sent)latencies.push(performance.now()-sent);}
    if(m.type==='motion')for(const p of m.players)if(p[0]===client.id){client.latest=p[1];const sent=receipts.get(client.id+':'+p[1]);if(sent)latencies.push(performance.now()-sent);}
    if(m.type==='chat'||m.type==='whisper')client.messages.push(m);
   });
  });clients.push(client);client.ws.send(JSON.stringify({type:'profile',motionProtocol:2,profile:{name:'Capacity '+i}}));
 }
 const status=await (await fetch(origin+'/api/rooms?map=mecca')).json();assert.equal(status.rooms[2].count,100);assert.equal(status.rooms[2].capacity,100);
 const overflow=await new Promise((resolve,reject)=>{const ws=new WebSocket(origin.replace('http:','ws:')+'/api/room?room=mecca:3',{origin,headers:{Cookie:clients[0].cookie}});ws.on('unexpected-response',(_,r)=>{resolve(r.statusCode);r.resume();});ws.on('open',()=>{ws.close();reject(new Error('101st client admitted'));});ws.on('error',()=>{});});assert.equal(overflow,503);
 clients[0].ws.send(JSON.stringify({type:'chat',text:'100-client public delivery'}));await until(()=>clients.every(c=>c.messages.some(m=>m.type==='chat')));
 await delay(1250);
 clients[0].ws.send(JSON.stringify({type:'whisper',to:clients[99].identity.id,text:'100-client private delivery'}));await until(()=>clients[99].messages.some(m=>m.type==='whisper'));
 assert.equal(clients.filter(c=>c.messages.some(m=>m.type==='whisper')).length,2);
 received=bytes=0;const start=performance.now();
 for(let seq=1;seq<=20;seq++){
  for(const c of clients){receipts.set(c.id+':'+seq,performance.now());c.ws.send(JSON.stringify({type:'move',x:c.x+Math.sin(seq*.3)*.1,z:c.z,yaw:seq*.02,seq}));}
  await delay(150);
 }
 await until(()=>clients.every(c=>c.latest===20),30000);const elapsed=performance.now()-start;
 latencies.sort((a,b)=>a-b);const network={clients:100,updatesSent:2000,acknowledged:latencies.length,receivedMessages:received,receivedBytes:bytes,elapsedMs:Math.round(elapsed),ackP50Ms:Math.round(latencies[Math.floor(latencies.length*.5)]),ackP95Ms:Math.round(latencies[Math.floor(latencies.length*.95)]),perClientReceiveKBps:Math.round(bytes/100/(elapsed/1000)/1024),overflowStatus:overflow,publicRecipients:100,whisperRecipients:2};assert.ok(network.acknowledged>=1800,JSON.stringify(network));assert.ok(network.ackP95Ms<1500,JSON.stringify(network));
 for(const c of clients)c.ws.close();await until(()=>clients.every(c=>c.ws.readyState===WebSocket.CLOSED));
 // Graphics comparison uses the actual supplied models in a separate local scene.
 browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
 await context.addInitScript(()=>{Object.defineProperty(navigator,'deviceMemory',{get:()=>4});Object.defineProperty(navigator,'hardwareConcurrency',{get:()=>4});});
 const page=await context.newPage();await page.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
 await page.goto(origin+'/?qa=1');await page.waitForFunction(()=>!!window.__noorScene?.local.human.loaded,null,{timeout:60000});
 await page.evaluate(()=>{document.querySelector('#mapDialog').close();document.getElementById('scene').removeAttribute('style');document.getElementById('app').prepend(document.getElementById('scene'));const s=window.__noorScene;s.container=document.getElementById('scene');s.resize();s.portraitMode=false;s.cameraAngle=0;s.cameraHeight=4;s.cameraDistance=13;});
 const rendering=[];
 for(const count of [32,50,100]){
  await page.evaluate(async count=>{const {sanitizeProfile}=await import('/core.js'),s=window.__noorScene;s.clearPlayers();const origin={...s.position};for(let i=0;i<count-1;i++)s.syncPlayer({id:'capacity-'+i,accountId:'test-'+i,profile:sanitizeProfile({name:'Visitor '+i,model:'model02'}),x:origin.x+(i%10-4.5)*.8,z:origin.z-1-Math.floor(i/10)*.8,yaw:0,pose:'standing',praying:false,protected:false});await Promise.all([...s.remote.values()].map(a=>a.human.ready));},count);
  await delay(1500);
  const result=await page.evaluate(async()=>{
   const s=window.__noorScene,samples=[],run=s.renderer.render.bind(s.renderer);s.renderer.render=(...args)=>{const start=performance.now();run(...args);samples.push(performance.now()-start);};
   const start=performance.now();await new Promise(r=>setTimeout(r,3000));s.renderer.render=run;samples.sort((a,b)=>a-b);
   return {...s.diagnostics(),observedSoftwareFps:Math.round(samples.length/(performance.now()-start)*10000)/10,renderP50Ms:Math.round(samples[Math.floor(samples.length*.5)]*10)/10,renderP95Ms:Math.round(samples[Math.floor(samples.length*.95)]*10)/10,jsHeapBytes:performance.memory?.usedJSHeapSize??null};
  });assert.equal(result.userModelsReady,count);assert.ok(result.triangles<750000);assert.ok(result.drawCalls<140);
  rendering.push({count,...result});await page.screenshot({path:'artifacts/capacity-'+count+'.png'});
 }
 const report={note:'Isolated local Worker and desktop software WebGL, not physical 3–4GB Android FPS. Production room capacity is50;100 is an isolated test override.',network,rendering};await writeFile('artifacts/capacity-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{for(const c of clients)c.ws.close();if(browser)await browser.close();server.kill('SIGTERM');await writeFile('artifacts/capacity-worker.log',log);}
