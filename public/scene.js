import * as THREE from 'three';
import {RoomEnvironment} from './vendor/RoomEnvironment.js';
import {COLORS,PILLARS,constrainedMove,MAPS,fenceAllows} from './core.js';
import {setAnisotropy,marbleTexture,weaveTexture,metalTexture,rugTexture,robeTexture,tileTexture} from './textures.js';
const GOLD=0xc4a36a;
export class Sanctuary {
  constructor(container,profile,onError,mapId='zayed'){
    this.mapId=mapId;this.theme=MAPS[mapId]||MAPS.zayed;
    this.container=container;this.profile=profile;this.remote=new Map();this.keys=new Set();this.direction=new Set();this.moving=false;
    this.position={x:0,z:7};this.yaw=Math.PI;this.praying=false;this.pose='standing';this.fencePreview=false;
    this.cameraAngle=.42;this.cameraHeight=6.3;this.cameraDistance=11.6;this.last=performance.now();
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
    this.renderer.setClearColor(0x24483e);this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.12;
    this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.renderer.domElement.setAttribute('aria-hidden','true');
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();onError('그래픽 메모리가 부족하거나 연결이 끊어졌습니다. 화면 품질을 낮춘 뒤 다시 열어주세요.');});
    this.scene=new THREE.Scene();this.scene.fog=new THREE.FogExp2(this.theme.fog,.018);
    this.camera=new THREE.PerspectiveCamera(48,1,.1,100);
    setAnisotropy(this.renderer.capabilities.getMaxAnisotropy());
    const pmrem=new THREE.PMREMGenerator(this.renderer),room=new RoomEnvironment();
    this.environment=pmrem.fromScene(room,.04);this.scene.environment=this.environment.texture;
    room.dispose();pmrem.dispose();
    this.materials={
      stone:new THREE.MeshStandardMaterial({color:this.theme.stone,map:marbleTexture(),roughness:.28,metalness:.06}),
      green:new THREE.MeshStandardMaterial({color:this.theme.green,roughness:.46,metalness:.05}),
      gold:new THREE.MeshStandardMaterial({color:GOLD,metalness:.88,roughness:.28,roughnessMap:metalTexture()}),
      dark:new THREE.MeshStandardMaterial({color:0x173b32,roughness:.66}),
      light:new THREE.MeshBasicMaterial({color:0xffe3a6}),
    };
    this.geometry={box:new THREE.BoxGeometry(1,1,1),sphere:new THREE.SphereGeometry(1,20,14),cylinder:new THREE.CylinderGeometry(1,1,1,24),torus:new THREE.TorusGeometry(1,.04,8,48)};
    this.buildHall();
    this.local=this.makeAvatar(profile,true);this.scene.add(this.local.root);
    this.fence=this.makeFence();this.scene.add(this.fence);this.fence.visible=false;
    this.raycaster=new THREE.Raycaster();
    this.bindControls();
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(container);
    this.quality('auto');this.resize();
    this.renderer.setAnimationLoop(()=>this.frame());
  }
  mesh(geo,mat,parent,pos=[0,0,0],scale=[1,1,1]){
    const m=new THREE.Mesh(geo,mat);m.position.set(...pos);m.scale.set(...scale);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
  }
  box(mat,parent,pos,scale){return this.mesh(this.geometry.box,mat,parent,pos,scale);}
  column(x,z){
    const {stone,gold}=this.materials,g=new THREE.Group();g.position.set(x,0,z);this.hall.add(g);
    this.mesh(this.geometry.cylinder,stone,g,[0,.2,0],[.7,.4,.7]);
    this.mesh(this.geometry.cylinder,gold,g,[0,.43,0],[.57,.08,.57]);
    this.mesh(this.geometry.cylinder,stone,g,[0,4.6,0],[.38,8.3,.38]);
    this.mesh(this.geometry.cylinder,gold,g,[0,8.6,0],[.56,.2,.56]);
    this.mesh(this.geometry.cylinder,stone,g,[0,8.85,0],[.65,.3,.65]);
  }
  arch(w,h,t,depth,mat){
    const outline=(path,width,height,bottom=0)=>{
      path.moveTo(-width/2,bottom);path.lineTo(-width/2,height-width*.6);
      path.bezierCurveTo(-width/2,height-width*.22,-width*.18,height-width*.2,0,height);
      path.bezierCurveTo(width*.18,height-width*.2,width/2,height-width*.22,width/2,height-width*.6);
      path.lineTo(width/2,bottom);path.closePath();return path;
    };
    const shape=outline(new THREE.Shape(),w,h),hole=outline(new THREE.Path(),w-2*t,h-t,-.05);shape.holes.push(hole);
    const m=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:20}),mat);m.castShadow=true;m.receiveShadow=true;return m;
  }
  buildHall(){
    this.hall=new THREE.Group();this.scene.add(this.hall);const scene=this.hall;
    const {stone,green,gold,dark,light}=this.materials;
    scene.add(new THREE.HemisphereLight(0xe4f0e6,0x4d4830,2));
    const sun=new THREE.DirectionalLight(0xffdfad,2.8);sun.position.set(-12,16,-7);scene.add(sun);
    this.keylight=new THREE.SpotLight(0xffe4b0,950,48,.8,.7,1.2);this.keylight.position.set(-3,13,5);this.keylight.target.position.set(0,0,2);
    this.keylight.castShadow=true;this.keylight.shadow.mapSize.set(1024,1024);this.keylight.shadow.bias=-.0002;this.keylight.shadow.normalBias=.035;scene.add(this.keylight,this.keylight.target);
    const fill=new THREE.PointLight(0xd5e9d7,75,25,1.6);fill.position.set(6,5,-7);scene.add(fill);
    this.box(dark,scene,[0,-.16,0],[31,.3,37]);
    const geo=new THREE.BoxGeometry(1.98,.06,1.98),tiles=new THREE.InstancedMesh(geo,stone,15*18),dummy=new THREE.Object3D();
    let i=0;
    for(let x=0;x<15;x++)for(let z=0;z<18;z++){
      dummy.position.set((x-7)*2,-.015,(z-8.5)*2);dummy.rotation.y=((x*7+z*13)%4)*Math.PI/2;dummy.updateMatrix();tiles.setMatrixAt(i,dummy.matrix);
      tiles.setColorAt(i,new THREE.Color((x+z)%2?0xf4f0e6:0xe4e3d6));i++;
    }
    tiles.receiveShadow=true;scene.add(tiles);
    // Polished stone inlays and a dedicated circulation aisle.
    for(const x of [-6,6])this.box(gold,scene,[x,.024,0],[.028,.012,34]);
    for(const z of [-12,12])this.box(gold,scene,[0,.024,z],[24,.012,.028]);
    this.box(green,scene,[0,4.5,-17],[30,9,.45]);
    this.box(green,scene,[-15,4.5,0],[.5,9,34]);this.box(green,scene,[15,4.5,0],[.5,9,34]);
    for(const side of [-1,1]){
      this.box(gold,scene,[side*14.72,.65,0],[.08,.055,34]);this.box(gold,scene,[side*14.72,7.6,0],[.08,.06,34]);
      for(const z of [-12,-4,4,12]){
        const a=this.arch(5.8,7.4,.3,.18,stone);a.rotation.y=side*Math.PI/2;a.position.set(side*14.6,0,z);scene.add(a);
        const inner=this.arch(5.2,6.95,.065,.1,gold);inner.rotation.y=side*Math.PI/2;inner.position.set(side*14.4,.1,z);scene.add(inner);
        const window=this.box(new THREE.MeshBasicMaterial({color:0x87ad99}),scene,[side*14.78,4.2,z],[.03,4.4,2.1]);
        for(let k=-1;k<=1;k++)this.box(gold,scene,[side*14.55,4.2,z+k*.62],[.05,4.45,.025]);
        this.box(gold,scene,[side*14.5,4.2,z],[.05,.028,2.15]);
        window.castShadow=false;
      }
    }
    for(const p of PILLARS)this.column(p.x,p.z);
    for(const z of [-9,0,9]){
      const a=this.arch(16,10,.5,.5,stone);a.position.set(0,8.8,z);scene.add(a);
      const g=this.arch(14.9,9.3,.065,.52,gold);g.position.set(0,9,z-.01);scene.add(g);
    }
    const dome=new THREE.Mesh(new THREE.SphereGeometry(14.2,48,24,0,Math.PI*2,0,Math.PI/2),new THREE.MeshStandardMaterial({color:0x336356,side:THREE.BackSide,roughness:.6}));
    dome.position.set(0,9,0);scene.add(dome);
    for(let n=0;n<16;n++){
      const curve=new THREE.EllipseCurve(0,0,14.13,14.13,0,Math.PI/2,false,0);
      const points=curve.getPoints(36).map(p=>new THREE.Vector3(p.x*Math.cos(n*Math.PI/8),p.y+9,p.x*Math.sin(n*Math.PI/8)));
      const line=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),36,.025,5,false),gold);scene.add(line);
    }
    if(this.theme.carpet){
      const rug=new THREE.Mesh(new THREE.PlaneGeometry(11.2,29),new THREE.MeshStandardMaterial({map:rugTexture(this.mapId==='blue'?1:0,'geometry',true),roughness:1,bumpMap:weaveTexture(),bumpScale:.018}));
      rug.rotation.x=-Math.PI/2;rug.position.set(0,.045,0);rug.receiveShadow=true;scene.add(rug);
    }
    if(this.mapId==='blue'){
      const tiles=new THREE.MeshStandardMaterial({map:tileTexture(),roughness:.32,metalness:.04});
      this.box(tiles,scene,[0,2.4,-16.72],[29,2.8,.03]);
      for(const side of [-1,1])this.box(tiles,scene,[side*14.69,2.4,0],[.03,2.8,33]);
    }
    if(this.mapId==='nabawi'){
      for(const x of [-8,8])for(const z of [-9,0,9]){
        this.mesh(this.geometry.cylinder,gold,scene,[x,5.2,z],[.39,.08,.39]);
        this.mesh(this.geometry.cylinder,gold,scene,[x,7.1,z],[.39,.08,.39]);
      }
    }
    // Central niche, ornamental star and stepped stone plinth.
    this.box(dark,scene,[0,3.9,-16.7],[7.4,7.8,.35]);
    const niche=this.arch(7.2,8,.42,.36,stone);niche.position.set(0,0,-16.35);scene.add(niche);
    const nicheGold=this.arch(6.2,7.45,.09,.15,gold);nicheGold.position.set(0,.1,-16.1);scene.add(nicheGold);
    this.box(stone,scene,[0,.16,-15.2],[7,.3,2.3]);
    const star=new THREE.Shape();
    for(let n=0;n<16;n++){const a=n*Math.PI/8,r=n%2?.65:1.15;const x=Math.cos(a)*r,y=Math.sin(a)*r;n?star.lineTo(x,y):star.moveTo(x,y);}
    star.closePath();const medallion=new THREE.Mesh(new THREE.ExtrudeGeometry(star,{depth:.06,bevelEnabled:false}),gold);medallion.position.set(0,5,-16);scene.add(medallion);
    this.mesh(this.geometry.torus,gold,scene,[0,5,-15.94],[1.5,1.5,1.5]);
    for(const x of [-10.8,10.8]){
      const a=this.arch(4.4,6.5,.16,.15,gold);a.position.set(x,.4,-16.7);scene.add(a);
      for(let n=0;n<7;n++)this.box(gold,scene,[x+(n-3)*.36,3.1,-16.5],[.025,3.4,.035]);
    }
    // Two tiers of brushed-gold chandelier rings and warm lanterns.
    for(const [y,r,count]of [[9.3,3.5,14],[8.7,2.4,10]]){
      const ring=this.mesh(this.geometry.torus,gold,scene,[0,y,0],[r,r,r]);ring.rotation.x=Math.PI/2;
      for(let n=0;n<count;n++){
        const a=n*Math.PI*2/count,x=Math.cos(a)*r,z=Math.sin(a)*r;
        this.mesh(this.geometry.cylinder,gold,scene,[x,y-.26,z],[.13,.65,.13]);
        const lamp=this.mesh(this.geometry.sphere,light,scene,[x,y-.34,z],[.17,.25,.17]);lamp.castShadow=false;
      }
    }
    this.mesh(this.geometry.cylinder,gold,scene,[0,15,0],[.035,10,.035]);
    const chandelierLight=new THREE.PointLight(0xffd494,190,22,1.5);chandelierLight.position.set(0,8,0);scene.add(chandelierLight);
    // Airborne dust catches the light without a postprocessing pass.
    const positions=new Float32Array(180*3);
    for(let n=0;n<180;n++){positions[n*3]=Math.sin(n*42.3)*12;positions[n*3+1]=1+(n*.381%8);positions[n*3+2]=Math.cos(n*72.1)*15;}
    const particles=new THREE.BufferGeometry();particles.setAttribute('position',new THREE.BufferAttribute(positions,3));
    this.dust=new THREE.Points(particles,new THREE.PointsMaterial({color:0xffdf9a,size:.025,transparent:true,opacity:.4,depthWrite:false}));scene.add(this.dust);
    scene.add(new THREE.AmbientLight(0xb4a879,.5));
  }
  setMap(mapId){
    if(!MAPS[mapId]||mapId===this.mapId)return;
    this.scene.remove(this.hall);
    const geos=new Set(),mats=new Set();
    this.hall.traverse(m=>{
      if(m.geometry&&!Object.values(this.geometry).includes(m.geometry))geos.add(m.geometry);
      for(const mat of [m.material].flat())if(mat&&!Object.values(this.materials).includes(mat))mats.add(mat);
    });
    geos.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());
    this.mapId=mapId;this.theme=MAPS[mapId];this.scene.fog.color.set(this.theme.fog);
    this.materials.stone.color.set(this.theme.stone);this.materials.green.color.set(this.theme.green);this.buildHall();this.renderer.shadowMap.needsUpdate=true;
  }
  makeAvatar(profile,local=false){
    const root=new THREE.Group(),hips=new THREE.Group(),torso=new THREE.Group();
    root.add(hips);hips.position.y=.6;hips.add(torso);
    const skin=new THREE.MeshStandardMaterial({color:COLORS.skin[profile.skin],roughness:.72});
    const cloth=new THREE.MeshStandardMaterial({color:COLORS.robe[profile.color],map:robeTexture(),bumpMap:weaveTexture(),bumpScale:.012,roughness:.84});
    const trim=this.materials.gold,dark=this.materials.dark;
    const materials=[skin,cloth];
    const width=profile.outfit==='abaya'?.39:profile.outfit==='tunic'?.30:.34;
    const robe=this.mesh(new THREE.CylinderGeometry(width*.78,width,1.05,24),cloth,torso,[0,.20,0]);robe.castShadow=true;
    this.mesh(this.geometry.cylinder,trim,torso,[0,-.3,0],[width*1.008,.028,width*1.008]);
    this.box(trim,torso,[0,.47,-width*.8],[.023,.40,.018]);
    const head=new THREE.Group();head.position.set(0,.98,0);torso.add(head);
    const face=this.mesh(this.geometry.sphere,skin,head,[0,0,0],profile.face==='round'?[.235,.245,.22]:profile.face==='square'?[.245,.25,.195]:[.205,.28,.20]);
    for(const x of [-.075,.075])this.mesh(this.geometry.sphere,dark,head,[x,.035,-.181],[.018,.023,.012]);
    this.mesh(this.geometry.sphere,skin,head,[0,-.02,-.206],[.035,.05,.045]);
    const mouthMat=new THREE.MeshStandardMaterial({color:0x986c56,roughness:.8});materials.push(mouthMat);
    this.box(mouthMat,head,[0,-.11,-.185],[.065,.008,.012]);
    if(profile.beard!=='none'){
      const b=new THREE.MeshStandardMaterial({color:0x292722,roughness:1});materials.push(b);
      this.mesh(this.geometry.sphere,b,head,[0,profile.beard==='full'?-.19:-.135,-.07],[.18,profile.beard==='full'?.19:.09,.15]);
    }
    if(profile.cover==='kufi'){
      this.mesh(this.geometry.cylinder,cloth,head,[0,.24,0],[.215,.14,.215]);
      this.mesh(this.geometry.cylinder,trim,head,[0,.19,0],[.217,.022,.217]);
    }else if(profile.cover==='hijab'){
      const h=new THREE.Mesh(new THREE.SphereGeometry(.275,24,16,0,Math.PI*2,0,Math.PI*.80),cloth);
      h.position.set(0,.035,.055);head.add(h);
      this.mesh(new THREE.ConeGeometry(.37,.62,24,1,true),cloth,torso,[0,.68,.10]);
    }
    const arms=[];
    for(const side of [-1,1]){
      const arm=new THREE.Group();arm.position.set(side*(width+.035),.56,0);torso.add(arm);
      const sleeve=this.mesh(this.geometry.cylinder,cloth,arm,[0,-.24,0],[.09,.5,.09]);sleeve.rotation.z=side*.08;
      this.mesh(this.geometry.sphere,skin,arm,[side*.02,-.52,0],[.065,.095,.07]);arms.push(arm);
    }
    const legs=[];
    for(const side of [-1,1]){
      const leg=new THREE.Group();leg.position.set(side*.13,-.28,0);hips.add(leg);
      this.mesh(this.geometry.cylinder,cloth,leg,[0,-.15,0],[.10,.34,.10]);
      this.mesh(this.geometry.sphere,skin,leg,[0,-.27,-.07],[.1,.06,.17]);legs.push(leg);
    }
    const high=local&&!matchMedia('(max-width:900px)').matches;
    const rugMat=new THREE.MeshStandardMaterial({map:rugTexture(profile.rug,profile.pattern,high),roughness:1,bumpMap:weaveTexture(),bumpScale:.013,side:THREE.DoubleSide});materials.push(rugMat);
    const rug=new THREE.Mesh(new THREE.PlaneGeometry(1.35,2.7),rugMat);rug.rotation.x=-Math.PI/2;rug.position.set(0,.055,-.45);rug.receiveShadow=true;root.add(rug);
    // Fringes are instanced so woven detail does not increase draw calls.
    const fringe=new THREE.InstancedMesh(new THREE.BoxGeometry(.012,.008,.11),this.materials.stone,66),d=new THREE.Object3D();
    for(let n=0;n<66;n++){d.position.set(-.64+(n%33)*.04,.06,n<33?.95:-1.86);d.updateMatrix();fringe.setMatrixAt(n,d.matrix);}root.add(fringe);
    const labelCanvas=document.createElement('canvas');labelCanvas.width=512;labelCanvas.height=96;
    const ctx=labelCanvas.getContext('2d');ctx.fillStyle='rgba(15,42,31,.82)';ctx.beginPath();ctx.roundRect(16,13,480,70,28);ctx.fill();
    ctx.fillStyle='#f2e7c7';ctx.font='500 30px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(profile.name,256,48,440);
    const labelTexture=new THREE.CanvasTexture(labelCanvas);labelTexture.colorSpace=THREE.SRGBColorSpace;
    const label=new THREE.Sprite(new THREE.SpriteMaterial({map:labelTexture,depthTest:false,transparent:true}));label.position.y=2.05;label.scale.set(1.3,.244,1);root.add(label);
    const avatar={root,hips,torso,arms,legs,head,rug,fringe,profile,materials,labelTexture,label,pose:'standing',praying:false};
    avatar.target=new THREE.Vector3();
    return avatar;
  }
  disposeAvatar(a){
    this.scene.remove(a.root);
    a.root.traverse(m=>{if(m.isMesh&&m.geometry&&!Object.values(this.geometry).includes(m.geometry))m.geometry.dispose();});
    a.materials.forEach(m=>m.dispose());a.label.material.dispose();a.labelTexture.dispose();
  }
  updateProfile(profile){const old=this.local;this.local=this.makeAvatar(profile,true);this.scene.add(this.local.root);this.disposeAvatar(old);this.profile=profile;}
  makeFence(){
    const group=new THREE.Group(),gold=this.materials.gold,d=new THREE.Object3D();
    const poles=new THREE.InstancedMesh(new THREE.CylinderGeometry(.025,.04,.65,10),gold,18);
    const beads=new THREE.InstancedMesh(new THREE.SphereGeometry(.065,10,8),gold,18);
    const points=[];
    for(let n=0;n<18;n++){const a=n*Math.PI*2/18;points.push(new THREE.Vector3(Math.cos(a)*1.55,.52,Math.sin(a)*2.05-.35));d.position.copy(points[n]);d.position.y=.38;d.updateMatrix();poles.setMatrixAt(n,d.matrix);d.position.y=.74;d.updateMatrix();beads.setMatrixAt(n,d.matrix);}
    group.add(poles,beads);
    for(const y of [.3,.58]){const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(p.x,y,p.z)),true);group.add(new THREE.Mesh(new THREE.TubeGeometry(curve,72,.017,6,true),gold));}
    return group;
  }
  syncPlayer(p){
    if(!this.remote.has(p.id)){const a=this.makeAvatar(p.profile);a.root.position.set(p.x,0,p.z);a.root.rotation.y=p.yaw;this.remote.set(p.id,a);this.scene.add(a.root);}
    let a=this.remote.get(p.id);
    if(JSON.stringify(a.profile)!==JSON.stringify(p.profile)){
      const old=a;a=this.makeAvatar(p.profile);a.root.position.copy(old.root.position);a.root.rotation.y=old.root.rotation.y;this.disposeAvatar(old);this.remote.set(p.id,a);this.scene.add(a.root);
    }
    a.target.set(p.x,0,p.z);a.targetYaw=p.yaw;a.praying=p.praying;a.pose=p.pose;a.protected=p.protected;a.accountId=p.accountId;
  }
  removePlayer(id){const a=this.remote.get(id);if(a)this.disposeAvatar(a);this.remote.delete(id);}
  clearPlayers(){for(const id of [...this.remote.keys()])this.removePlayer(id);}
  applyPose(a,pose,praying,time,moving,dt){
    const target=pose==='prostrating'?{hip:.29,torso:1.35,arm:2.6,knee:-1.1}:pose==='bowing'?{hip:.6,torso:1.05,arm:1.05,knee:0}:pose==='sitting'?{hip:.28,torso:0,arm:.75,knee:-1.35}:{hip:.6,torso:0,arm:praying?1.0:0,knee:0};
    const s=1-Math.exp(-dt*9);
    a.hips.position.y=THREE.MathUtils.lerp(a.hips.position.y,target.hip+(moving?Math.sin(time*11)*.025:0),s);
    a.torso.rotation.x=THREE.MathUtils.lerp(a.torso.rotation.x,-target.torso,s);
    a.arms.forEach((arm,i)=>arm.rotation.x=THREE.MathUtils.lerp(arm.rotation.x,target.arm+(moving?Math.sin(time*9+i*Math.PI)*.23:0),s));
    a.legs.forEach((leg,i)=>leg.rotation.x=THREE.MathUtils.lerp(leg.rotation.x,target.knee+(moving?Math.sin(time*9+i*Math.PI)*.28:0),s));
    a.rug.visible=a.fringe.visible=praying;
  }
  bindControls(){
    window.addEventListener('keydown',e=>{
      if(e.target.closest('input,textarea,select,dialog')||document.querySelector('dialog[open]'))return;
      if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d','W','A','S','D'].includes(e.key)){e.preventDefault();this.keys.add(e.key.toLowerCase());}
    });
    window.addEventListener('keyup',e=>this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur',()=>{this.keys.clear();this.direction.clear();});
    for(const button of document.querySelectorAll('[data-direction]')){
      const stop=e=>{this.direction.delete(button.dataset.direction);if(e?.pointerId!==undefined&&button.hasPointerCapture(e.pointerId))button.releasePointerCapture(e.pointerId);};
      button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture(e.pointerId);this.direction.add(button.dataset.direction);});
      button.addEventListener('pointerup',stop);button.addEventListener('pointercancel',stop);button.addEventListener('lostpointercapture',stop);
    }
    const el=this.renderer.domElement,pointers=new Map();let drag=null,pinch=0;
    el.addEventListener('pointerdown',e=>{el.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});drag={x:e.clientX,y:e.clientY};});
    el.addEventListener('pointermove',e=>{
      if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(pointers.size===2){const [a,b]=[...pointers.values()],dist=Math.hypot(a.x-b.x,a.y-b.y);if(pinch)this.cameraDistance=THREE.MathUtils.clamp(this.cameraDistance+(pinch-dist)*.03,4,20);pinch=dist;drag=null;return;}
      if(drag){this.cameraAngle-=(e.clientX-drag.x)*.006;this.cameraHeight=THREE.MathUtils.clamp(this.cameraHeight+(e.clientY-drag.y)*.022,2.5,12);}
      drag={x:e.clientX,y:e.clientY};
    });
    const up=e=>{pointers.delete(e.pointerId);drag=null;pinch=0;};
    el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up);
    el.addEventListener('wheel',e=>{e.preventDefault();this.cameraDistance=THREE.MathUtils.clamp(this.cameraDistance+e.deltaY*.008,4,20);},{passive:false});
  }
  quality(value){
    const mobile=matchMedia('(max-width:900px)').matches,low=value==='low'||(value==='auto'&&mobile);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,low?1:1.75));
    this.renderer.shadowMap.enabled=!low;this.resize();
  }
  resize(){const w=this.container.clientWidth,h=this.container.clientHeight;this.renderer.setSize(w,h,false);this.camera.aspect=w/Math.max(h,1);this.camera.updateProjectionMatrix();}
  frame(){
    const now=performance.now(),dt=Math.min((now-this.last)/1000,.05),time=now/1000;this.last=now;
    let x=0,z=0;
    if(!this.praying&&!document.querySelector('dialog[open]')){
      x=(this.keys.has('d')||this.keys.has('arrowright')||this.direction.has('right')?1:0)-(this.keys.has('a')||this.keys.has('arrowleft')||this.direction.has('left')?1:0);
      z=(this.keys.has('s')||this.keys.has('arrowdown')||this.direction.has('down')?1:0)-(this.keys.has('w')||this.keys.has('arrowup')||this.direction.has('up')?1:0);
    }
    this.moving=!!(x||z);
    if(this.moving){
      const l=Math.hypot(x,z);x/=l;z/=l;
      const dx=x*Math.cos(this.cameraAngle)+z*Math.sin(this.cameraAngle),dz=-x*Math.sin(this.cameraAngle)+z*Math.cos(this.cameraAngle);
      const next=constrainedMove(this.position,{x:this.position.x+dx*4*dt,z:this.position.z+dz*4*dt},dt);
      const allowed=[...this.remote.values()].every(a=>!a.protected||fenceAllows(this.position,next,{x:a.target.x,z:a.target.z,accountId:a.accountId},this.accountId,(this.friendIds||[]).includes(a.accountId)?[this.accountId]:[]));
      if(allowed)this.position=next;
      this.yaw=Math.atan2(-dx,-dz);
    }
    if(this.praying)this.yaw=0;
    this.local.root.position.set(this.position.x,0,this.position.z);
    this.local.root.rotation.y=this.yaw;
    this.applyPose(this.local,this.pose,this.praying,time,this.moving,dt);
    for(const a of this.remote.values()){
      const moving=a.root.position.distanceTo(a.target)>.03;
      a.root.position.lerp(a.target,1-Math.exp(-dt*12));
      const delta=Math.atan2(Math.sin(a.targetYaw-a.root.rotation.y),Math.cos(a.targetYaw-a.root.rotation.y));a.root.rotation.y+=delta*(1-Math.exp(-dt*12));
      this.applyPose(a,a.pose,a.praying,time,moving,dt);a.protection.visible=!!a.protected&&a.praying;
    }
    this.fence.visible=(this.fencePreview||this.protected)&&this.praying;this.fence.position.set(this.position.x,0,this.position.z);
    const mobile=innerWidth<=900,target=new THREE.Vector3(this.position.x-(mobile?0:1.5),.9,this.position.z-1.5);
    const cam=new THREE.Vector3(target.x+Math.sin(this.cameraAngle)*this.cameraDistance,this.cameraHeight,target.z+Math.cos(this.cameraAngle)*this.cameraDistance);
    this.camera.position.lerp(cam,1-Math.exp(-dt*4));this.camera.lookAt(target);
    this.dust.rotation.y=time*.003;
    this.renderer.render(this.scene,this.camera);
  }
}
