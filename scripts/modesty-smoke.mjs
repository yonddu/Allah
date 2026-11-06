import {spawn} from 'node:child_process';import {mkdir,writeFile,mkdtemp} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {setTimeout as delay} from 'node:timers/promises';import assert from 'node:assert/strict';import {chromium} from 'playwright';import {createCanvas,loadImage} from '@napi-rs/canvas';
await mkdir('artifacts/modesty',{recursive:true});const state=await mkdtemp(join(tmpdir(),'noor-modesty-')),origin='http://127.0.0.1:8792';let log='',browser,page;const errors=[];
const server=spawn(process.execPath,['node_modules/wrangler/bin/wrangler.js','dev','--local','--ip','127.0.0.1','--port','8792','--persist-to',state],{stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',b=>log=(log+b).slice(-16000));
try{
 let healthy=false;for(let n=0;n<120;n++){try{if((await fetch(origin+'/api/health')).ok){healthy=true;break;}}catch{}await delay(250);}assert.ok(healthy,log);
 browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});const context=await browser.newContext({viewport:{width:480,height:360},deviceScaleFactor:1});await context.addInitScript(()=>{localStorage.setItem('noor-language','ko');localStorage.setItem('noor-onboarded','1');localStorage.setItem('noor-room','mecca:1');localStorage.setItem('noor-profile',JSON.stringify({name:'Clothing QA',model:'model01',gender:'male'}));});page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());await page.goto(origin+'/?qa=1',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__noorScene?.selfId,null,{timeout:60000});
 await page.evaluate(async()=>{
  const {Color}=await import('/vendor/three.module.js'),s=window.__noorScene;s.renderer.setAnimationLoop(null);s.clearPlayers();s.hall.visible=false;s.scene.background=new Color('#b9c5c1');s.scene.fog=null;s.position={x:0,z:0};s.yaw=0;s.renderer.setPixelRatio(1);s.renderer.setSize(480,360,false);s.camera.aspect=480/360;s.camera.fov=45;s.camera.updateProjectionMatrix();window.qaTime=0;
 });
 const views=['front','back','left','right','top'],poses=['prostrating','sitting','bowing'],sheets=new Map(),report=[];
 for(const pose of poses){const canvas=createCanvas(1200,10*210),g=canvas.getContext('2d');g.fillStyle='#eff2ef';g.fillRect(0,0,canvas.width,canvas.height);sheets.set(pose,{canvas,g});}
 for(let n=1;n<=10;n++){
  const id='model'+String(n).padStart(2,'0');
  await page.evaluate(async({id,n})=>{const s=window.__noorScene;s.updateProfile({...s.profile,model:id,gender:n>=8?'female':'male'});await s.local.human.ready;s.local.root.position.set(0,0,0);s.local.root.rotation.y=0;},{id,n});
  for(const pose of poses)for(let view=0;view<views.length;view++){
   const result=await page.evaluate(({pose,view})=>{
    const s=window.__noorScene,a=s.local;for(let frame=0;frame<180;frame++)a.human.update(pose,true,window.qaTime+=1/60,false,1/60);a.rug.visible=a.fringe.visible=true;a.root.updateMatrixWorld(true);
    const cameras=[[0,1.25,-2.8],[0,1.25,2.8],[-2.8,1.25,0],[2.8,1.25,0],[0,3,.10]];s.camera.up.set(...(view===4?[0,0,-1]:[0,1,0]));s.camera.position.set(...cameras[view]);s.camera.lookAt(0,pose==='bowing'?.75:.35,.08);s.camera.updateMatrixWorld();s.renderer.render(s.scene,s.camera);
    return {image:s.renderer.domElement.toDataURL('image/png'),enabled:a.human.modesty.enabled,visible:a.human.modesty.mesh.visible,triangles:s.renderer.info.render.triangles,draws:s.renderer.info.render.calls};
   },{pose,view});
   assert.ok(result.enabled&&result.visible,id+' '+pose+' '+views[view]+' clothing must remain covered');const bytes=Buffer.from(result.image.split(',')[1],'base64');await writeFile('artifacts/modesty/'+id+'-'+pose+'-'+views[view]+'.png',bytes);
   const {g}=sheets.get(pose);g.drawImage(await loadImage(bytes),view*240,(n-1)*210+22,240,188);g.fillStyle='#18392f';g.font='bold 12px sans-serif';g.fillText(id+' · '+pose+' · '+views[view],view*240+6,(n-1)*210+16);report.push({id,pose,view:views[view],covered:true});
  }
 }
 for(const pose of poses){const {canvas}=sheets.get(pose),bytes=canvas.toBuffer('image/jpeg',50);await writeFile('artifacts/modesty-'+pose+'-all-10.jpg',bytes);const encoded=bytes.toString('base64');for(let offset=0;offset<encoded.length;offset+=40000)console.log('NOOR_MODESTY_'+pose.toUpperCase()+'_CHUNK_'+(offset/40000)+':'+encoded.slice(offset,offset+40000));}
 assert.equal(report.length,150);assert.deepEqual(errors,[]);await writeFile('artifacts/modesty-report.json',JSON.stringify({views:150,characters:10,poses:3,covered:true,errors},null,2));console.log(JSON.stringify({modesty:'passed',characters:10,poses:3,views:150,errors}));
}finally{await browser?.close();server.kill('SIGTERM');await writeFile('artifacts/modesty-worker.log',log);}
