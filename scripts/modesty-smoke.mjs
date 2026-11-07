import {spawn} from 'node:child_process';import {mkdir,writeFile,mkdtemp} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {setTimeout as delay} from 'node:timers/promises';import assert from 'node:assert/strict';import {chromium} from 'playwright';import {createCanvas,loadImage} from '@napi-rs/canvas';
await mkdir('artifacts/modesty',{recursive:true});const state=await mkdtemp(join(tmpdir(),'noor-modesty-')),origin='http://127.0.0.1:8792';let log='',browser,page;const errors=[];
const server=spawn(process.execPath,['node_modules/wrangler/bin/wrangler.js','dev','--local','--ip','127.0.0.1','--port','8792','--persist-to',state],{stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',b=>log=(log+b).slice(-16000));
try{
 let healthy=false;for(let n=0;n<120;n++){try{if((await fetch(origin+'/api/health')).ok){healthy=true;break;}}catch{}await delay(250);}assert.ok(healthy,log);
 browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});const context=await browser.newContext({viewport:{width:480,height:360},deviceScaleFactor:1});await context.addInitScript(()=>{localStorage.setItem('noor-language','ko');localStorage.setItem('noor-room','mecca:1');localStorage.setItem('noor-profile',JSON.stringify({name:'Clothing QA',model:'model01',gender:'male'}));});page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());await page.goto(origin+'/?qa=1',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__noorScene?.hallReady,null,{timeout:60000});await page.waitForFunction(()=>window.__noorScene?.selfId,null,{timeout:60000});
 await page.evaluate(async()=>{
  const {Color}=await import('/vendor/three.module.js'),s=window.__noorScene;s.renderer.setAnimationLoop(null);s.clearPlayers();s.hall.visible=false;s.scene.background=new Color('#b9c5c1');s.scene.fog=null;s.position={x:0,z:0};s.yaw=0;s.renderer.setPixelRatio(1);s.renderer.setSize(480,360,false);s.camera.aspect=480/360;s.camera.fov=45;s.camera.updateProjectionMatrix();window.qaTime=0;
 });
 const lifestyle=createCanvas(900,2160),lg=lifestyle.getContext('2d');lg.fillStyle='#eff2ef';lg.fillRect(0,0,900,2160);let lifestyleViews=0;
 const views=['front','back','left','right','top'],poses=['standing','prostrating','sitting','bowing'],sheets=new Map(),sockSheets=new Map(),report=[],armReport=[];
 const armSheets=[0,1].map(()=>{const canvas=createCanvas(960,1000),g=canvas.getContext('2d');g.fillStyle='#eff2ef';g.fillRect(0,0,960,1000);return {canvas,g};});
 await mkdir('artifacts/resting-arms',{recursive:true});
 for(const pose of poses){const canvas=createCanvas(1200,10*210),g=canvas.getContext('2d');g.fillStyle='#eff2ef';g.fillRect(0,0,canvas.width,canvas.height);sheets.set(pose,{canvas,g});const sc=createCanvas(900,540),sg=sc.getContext('2d');sg.fillStyle='#eff2ef';sg.fillRect(0,0,900,540);sockSheets.set(pose,{canvas:sc,g:sg});}
 for(let n=1;n<=10;n++){
  const id='model'+String(n).padStart(2,'0');
  await page.evaluate(async({id,n})=>{const s=window.__noorScene;s.updateProfile({...s.profile,model:id,gender:n>=8?'female':'male'});await s.local.human.ready;s.local.root.position.set(0,0,0);s.local.root.rotation.y=0;},{id,n});
  for(let view=0;view<4;view++){
   const result=await page.evaluate(view=>{
    const s=window.__noorScene,a=s.local;for(let frame=0;frame<240;frame++)a.human.update('standing',false,window.qaTime+=1/60,false,1/60);a.rug.visible=a.fringe.visible=false;a.root.updateMatrixWorld(true);
    const cameras=[[-1.8,1.3,-1],[1.8,1.3,-1],[-2,1.3,0],[2,1.3,0]];s.camera.up.set(0,1,0);s.camera.position.set(...cameras[view]);s.camera.lookAt(0,1.2,0);s.camera.updateMatrixWorld();s.renderer.render(s.scene,s.camera);
    const b=a.human.bones,positions=[6,7,8,9,10,11].map(i=>{const p=b[i].getWorldPosition(b[i].position.clone());return {x:p.x,y:p.y,z:p.z};});
    return {image:s.renderer.domElement.toDataURL('image/png'),positions};
   },view);
   for(const offset of [0,3]){const [shoulder,elbow,wrist]=result.positions.slice(offset,offset+3);assert.ok(elbow.z>shoulder.z+.015,id+' resting elbow must not bend backward');assert.ok(wrist.z<elbow.z-.025,id+' wrist stays forward of elbow');}
   const bytes=Buffer.from(result.image.split(',')[1],'base64');await writeFile(`artifacts/resting-arms/${id}-${view}.png`,bytes);const {g}=armSheets[Math.floor((n-1)/5)];g.drawImage(await loadImage(bytes),view*240,((n-1)%5)*200+20,240,180);g.fillStyle='#18392f';g.font='12px sans-serif';g.fillText(id+' / '+['left oblique','right oblique','left side','right side'][view],view*240+5,((n-1)%5)*200+15);armReport.push({id,view,positions:result.positions});
  }

  if(n>=8)for(const [stateIndex,state]of ['tpose','idle','walking','greeting'].entries())for(let view=0;view<3;view++){
    const shot=await page.evaluate(({state,view})=>{
      const s=window.__noorScene,a=s.local;
      for(let f=0;f<180;f++)a.human.update('standing',false,window.qaTime+=1/60,state==='walking',1/60,state==='greeting'?.4:-1);
      if(state==='tpose'){for(const b of a.human.bones)b.quaternion.identity();a.human.bones[1].position.set(0,.92,0);a.human.bones[2].position.set(0,.20,0);}
      a.rug.visible=a.fringe.visible=false;a.root.updateMatrixWorld(true);
      const b=a.human.bones,target=b[14].getWorldPosition(s.cameraTarget).add(b[17].getWorldPosition(s.desiredCamera)).multiplyScalar(.5);target.y-=.015;
      const offsets=[[0,.25,-.85],[0,.25,.85],[.85,.25,0]],offset=offsets[view];s.camera.up.set(0,1,0);s.camera.position.copy(target).add({x:offset[0],y:offset[1],z:offset[2]});s.camera.lookAt(target);s.camera.updateMatrixWorld();s.renderer.render(s.scene,s.camera);
      return {image:s.renderer.domElement.toDataURL('image/png'),enabled:a.human.socks.enabled,visible:a.human.socks.mesh.visible};
    },{state,view});
    assert.equal(shot.enabled,true,id+' '+state+' socks enabled');assert.equal(shot.visible,true,id+' '+state+' socks visible');
    const bytes=Buffer.from(shot.image.split(',')[1],'base64');await writeFile('artifacts/modesty/'+id+'-'+state+'-permanent-socks-'+view+'.png',bytes);
    const row=((n-8)*4+stateIndex)*180;lg.drawImage(await loadImage(bytes),view*300,row+20,300,160);lg.fillStyle='#18392f';lg.font='bold 12px sans-serif';lg.fillText(id+' · '+state+' · '+['front','back','side'][view],view*300+5,row+15);lifestyleViews++;
  }
  for(const pose of poses)for(let view=0;view<views.length;view++){
   const result=await page.evaluate(({pose,view})=>{
    const s=window.__noorScene,a=s.local;for(let frame=0;frame<180;frame++)a.human.update(pose,true,window.qaTime+=1/60,false,1/60);a.rug.visible=a.fringe.visible=true;a.root.updateMatrixWorld(true);
    const cameras=[[0,1.25,-2.8],[0,1.25,2.8],[-2.8,1.25,0],[2.8,1.25,0],[0,3,.10]];s.camera.up.set(...(view===4?[0,0,-1]:[0,1,0]));s.camera.position.set(...cameras[view]);s.camera.lookAt(0,pose==='bowing'||pose==='standing'?.80:.35,.08);s.camera.updateMatrixWorld();s.renderer.render(s.scene,s.camera);
    return {image:s.renderer.domElement.toDataURL('image/png'),enabled:a.human.modesty.enabled,visible:a.human.modesty.mesh.visible,socks:a.human.socks.enabled,socksVisible:a.human.socks.mesh?.visible||false,triangles:s.renderer.info.render.triangles,draws:s.renderer.info.render.calls};
   },{pose,view});
   if(pose!=='standing')assert.ok(result.enabled&&result.visible,id+' '+pose+' '+views[view]+' clothing must remain covered');assert.equal(result.socks,n>=8,id+' prayer socks');assert.equal(result.socksVisible,n>=8,id+' visible prayer socks');const bytes=Buffer.from(result.image.split(',')[1],'base64');await writeFile('artifacts/modesty/'+id+'-'+pose+'-'+views[view]+'.png',bytes);
   const {g}=sheets.get(pose);g.drawImage(await loadImage(bytes),view*240,(n-1)*210+22,240,188);g.fillStyle='#18392f';g.font='bold 12px sans-serif';g.fillText(id+' · '+pose+' · '+views[view],view*240+6,(n-1)*210+16);report.push({id,pose,view:views[view],covered:true});
   if(n>=8&&view<3){
    const closeup=await page.evaluate(view=>{const s=window.__noorScene,b=s.local.human.bones,target=b[14].getWorldPosition(s.cameraTarget).add(b[17].getWorldPosition(s.desiredCamera)).multiplyScalar(.5);target.y-=.015;
     const positions=[[0,.25,-.75],[0,.25,.75],[0,.85,.02]],offset=positions[view];s.camera.up.set(...(view===2?[0,0,-1]:[0,1,0]));s.camera.position.copy(target).add({x:offset[0],y:offset[1],z:offset[2]});s.camera.lookAt(target);s.camera.updateMatrixWorld();s.renderer.render(s.scene,s.camera);return s.renderer.domElement.toDataURL('image/png');},view);
    const bytes=Buffer.from(closeup.split(',')[1],'base64');await writeFile('artifacts/modesty/'+id+'-'+pose+'-socks-'+view+'.png',bytes);const {g}=sockSheets.get(pose);g.drawImage(await loadImage(bytes),view*300,(n-8)*180+20,300,160);g.fillStyle='#18392f';g.font='bold 13px sans-serif';g.fillText(id+' · '+pose+' · '+['front','back','top'][view],view*300+6,(n-8)*180+15);
   }

  }
 }
 for(const pose of poses){const {canvas}=sheets.get(pose),bytes=canvas.toBuffer('image/jpeg',50);await writeFile('artifacts/modesty-'+pose+'-all-10.jpg',bytes);const encoded=bytes.toString('base64');for(let offset=0;offset<encoded.length;offset+=40000)console.log('NOOR_MODESTY_'+pose.toUpperCase()+'_CHUNK_'+(offset/40000)+':'+encoded.slice(offset,offset+40000));}
 for(let i=0;i<armSheets.length;i++)await writeFile('artifacts/resting-arms-group-'+i+'.png',armSheets[i].canvas.toBuffer('image/png'));
 assert.equal(armReport.length,40);await writeFile('artifacts/resting-arms-report.json',JSON.stringify(armReport,null,2));
 for(const pose of poses){const bytes=sockSheets.get(pose).canvas.toBuffer('image/jpeg',75);await writeFile('artifacts/prayer-socks-'+pose+'.jpg',bytes);const encoded=bytes.toString('base64');for(let offset=0;offset<encoded.length;offset+=40000)console.log('NOOR_SOCKS_'+pose.toUpperCase()+'_CHUNK_'+(offset/40000)+':'+encoded.slice(offset,offset+40000));}

 const lifestyleJpg=lifestyle.toBuffer('image/jpeg',70);await writeFile('artifacts/permanent-female-socks.jpg',lifestyleJpg);const encodedLifestyle=lifestyleJpg.toString('base64');for(let offset=0;offset<encodedLifestyle.length;offset+=40000)console.log('NOOR_PERMANENT_SOCKS_CHUNK_'+(offset/40000)+':'+encodedLifestyle.slice(offset,offset+40000));assert.equal(lifestyleViews,36);
 const thumbCanvas=createCanvas(1200,400),tg=thumbCanvas.getContext('2d');tg.fillStyle='#b9c5c1';tg.fillRect(0,0,1200,400);for(let i=0;i<3;i++){const id='model'+String(i+8).padStart(2,'0');tg.drawImage(await loadImage('public/user-models/'+id+'-covered.png'),i*400,0,400,400);}const thumbJpg=thumbCanvas.toBuffer('image/jpeg',80);await writeFile('artifacts/covered-selection-thumbnails.jpg',thumbJpg);console.log('NOOR_COVERED_THUMBNAILS:'+thumbJpg.toString('base64'));
 assert.equal(report.length,200);assert.deepEqual(errors,[]);await writeFile('artifacts/modesty-report.json',JSON.stringify({views:200,characters:10,poses:4,covered:true,permanentSockViews:lifestyleViews,errors},null,2));console.log(JSON.stringify({modesty:'passed',characters:10,poses:4,views:200,permanentSockViews:lifestyleViews,errors}));
}finally{await browser?.close();server.kill('SIGTERM');await writeFile('artifacts/modesty-worker.log',log);}
