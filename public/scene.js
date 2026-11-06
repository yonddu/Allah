import * as THREE from 'three';
import {CSS2DRenderer,CSS2DObject} from './vendor/CSS2DRenderer.js';
import {PLAY_CAMERA,avatarFocus} from './camera.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {mergeGeometries} from './utils/BufferGeometryUtils.js';
import {QUALITY_BUDGETS,chooseQuality,pixelRatioFor,nextResolutionScale} from './performance.js';
import {COLORS,constrainedMove,MAPS,fenceAllows,joystickVector,prayerYaw} from './core.js';
import {makeHumanAvatar} from './avatars.js';
import {setAnisotropy,weaveTexture,metalTexture,rugTexture,robeTexture} from './textures.js';
const GOLD=0xc4a36a;
export class Sanctuary {
  constructor(container,profile,onError,mapId='mecca'){
    this.mapId=mapId;this.theme=MAPS[mapId]||MAPS.mecca;
    this.onModelError=e=>onError(e.message);this.container=container;this.profile=profile;this.remote=new Map();this.keys=new Set();this.direction=new Set();this.moving=false;this.joystickAxis={x:0,y:0};
    this.position={...this.theme.spawn};this.yaw=Math.PI;this.praying=false;this.pose='standing';this.fencePreview=false;
    this.cameraAngle=this.theme.cameraAngle;this.cameraHeight=PLAY_CAMERA.height;this.cameraDistance=PLAY_CAMERA.distance;this.last=performance.now();
    const mobile=matchMedia('(max-width:900px)').matches||matchMedia('(pointer:coarse)').matches;
    this.device={mobile,memory:navigator.deviceMemory||(mobile?4:8),cores:navigator.hardwareConcurrency||(mobile?4:8)};
    this.qualityMode='auto';this.qualityTier=chooseQuality('auto',this.device);this.resolutionScale=1;this.renderedAt=0;this.performanceWindow=performance.now();this.performanceFrames=0;
    this.loader=new GLTFLoader();this.hallGeneration=0;this.hallReady=false;
    this.cameraTarget=new THREE.Vector3();this.desiredCamera=new THREE.Vector3();
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:this.qualityTier==='low'?'low-power':'high-performance'});
    this.renderer.setClearColor(0x24483e);this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=.95;
    this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.renderer.domElement.setAttribute('aria-hidden','true');
    container.appendChild(this.renderer.domElement);
    this.labels=new CSS2DRenderer();this.labels.domElement.className='scene-labels';container.appendChild(this.labels.domElement);
    this.renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();onError('그래픽 메모리가 부족하거나 연결이 끊어졌습니다. 화면 품질을 낮춘 뒤 다시 열어주세요.');});
    this.scene=new THREE.Scene();this.scene.environmentIntensity=.5;this.scene.fog=new THREE.FogExp2(0xc5dce1,.0027);
    this.camera=new THREE.PerspectiveCamera(80,1,.1,360);
    setAnisotropy(this.renderer.capabilities.getMaxAnisotropy());
    // A small, pre-authored reflection map avoids rendering a temporary 3D room at startup.
    this.environmentReady=new THREE.TextureLoader().loadAsync('/assets/textures/low/environment.png').then(texture=>{
      texture.mapping=THREE.EquirectangularReflectionMapping;texture.colorSpace=THREE.SRGBColorSpace;this.scene.environment=texture;this.scene.background=texture;this.environment=texture;
    }).catch(()=>{});
    this.materials={
      stone:new THREE.MeshStandardMaterial({color:this.theme.stone,roughness:.38,metalness:.06}),
      green:new THREE.MeshStandardMaterial({color:this.theme.green,roughness:.46,metalness:.05}),
      gold:new THREE.MeshStandardMaterial({color:GOLD,metalness:.88,roughness:.28,roughnessMap:metalTexture()}),
      dark:new THREE.MeshStandardMaterial({color:0x173b32,roughness:.66}),
      light:new THREE.MeshBasicMaterial({color:0xffe3a6}),
    };
    this.geometry={box:new THREE.BoxGeometry(1,1,1),sphere:new THREE.SphereGeometry(1,20,14),cylinder:new THREE.CylinderGeometry(1,1,1,24),torus:new THREE.TorusGeometry(1,.04,8,48)};
    this.setupLights();this.ready=this.loadHall(mapId);
    this.local=this.makeAvatar(profile,true);this.scene.add(this.local.root);
    this.fence=this.makeFence();this.scene.add(this.fence);this.fence.visible=false;
    const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=64;const sc=shadowCanvas.getContext('2d'),shade=sc.createRadialGradient(32,32,2,32,32,32);shade.addColorStop(0,'rgba(0,0,0,.24)');shade.addColorStop(1,'rgba(0,0,0,0)');sc.fillStyle=shade;sc.fillRect(0,0,64,64);
    const shadowTexture=new THREE.CanvasTexture(shadowCanvas),shadowMaterial=new THREE.MeshBasicMaterial({map:shadowTexture,transparent:true,depthWrite:false});
    this.avatarShadows=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2),shadowMaterial,100);this.avatarShadows.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.avatarShadows.frustumCulled=false;this.avatarShadows.count=0;this.scene.add(this.avatarShadows);this.shadowTransform=new THREE.Object3D();
    this.raycaster=new THREE.Raycaster();
    this.bindControls();
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(container);
    this.quality('auto');this.resize();
    this.animateFrame=()=>this.frame();
    this.renderer.setAnimationLoop(this.animateFrame);
    document.addEventListener('visibilitychange',()=>{
      if(document.hidden){this.renderer.setAnimationLoop(null);this.resetJoystick?.();this.keys.clear();}
      else{this.last=this.renderedAt=performance.now();this.performanceWindow=this.last;this.performanceFrames=0;this.renderer.setAnimationLoop(this.animateFrame);}
    });
  }
  mesh(geo,mat,parent,pos=[0,0,0],scale=[1,1,1]){
    const m=new THREE.Mesh(geo,mat);m.position.set(...pos);m.scale.set(...scale);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
  }
  box(mat,parent,pos,scale){return this.mesh(this.geometry.box,mat,parent,pos,scale);}
  setupLights(){
    this.scene.add(new THREE.HemisphereLight(0xe1ece5,0x77705c,.85));
    this.scene.add(new THREE.AmbientLight(0xb0a68b,.08));
    this.sun=new THREE.DirectionalLight(0xffe6be,2.2);this.sun.position.set(-12,18,-10);this.sun.castShadow=true;
    this.sun.shadow.mapSize.set(1024,1024);Object.assign(this.sun.shadow.camera,{left:-18,right:18,top:18,bottom:-18,near:1,far:60});
    this.sun.shadow.bias=-.00025;this.sun.shadow.normalBias=.025;this.scene.add(this.sun);
    const fill=new THREE.DirectionalLight(0xd4e7df,.35);fill.position.set(8,6,10);this.scene.add(fill);
  }
  disposeHall(hall){
    if(!hall)return;this.scene.remove(hall);const geometries=new Set(),materials=new Set(),textures=new Set();
    hall.traverse(node=>{
      if(node.geometry)geometries.add(node.geometry);
      for(const material of [node.material].flat())if(material){materials.add(material);for(const value of Object.values(material))if(value?.isTexture)textures.add(value);}
    });
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());
  }
  async loadHall(mapId){
    const generation=++this.hallGeneration,asset=QUALITY_BUDGETS[this.qualityTier].asset;this.hallReady=false;
    const gltf=await this.loader.loadAsync('/assets/halls/'+mapId+'-'+asset+'.glb');
    if(generation!==this.hallGeneration){this.disposeHall(gltf.scene);return;}
    const old=this.hall;this.hall=gltf.scene;this.hall.name=mapId+'-'+asset;this.loadedAsset=asset;
    this.hall.traverse(node=>{if(node.isMesh){node.castShadow=!node.material?.transparent;node.receiveShadow=true;node.frustumCulled=true;}});
    this.scene.add(this.hall);this.disposeHall(old);this.hallReady=true;this.renderer.shadowMap.needsUpdate=true;
  }
  async setMap(mapId){
    if(!MAPS[mapId])return;
    if(mapId===this.mapId&&this.hallReady&&this.loadedAsset===QUALITY_BUDGETS[this.qualityTier].asset)return this.ready;
    this.mapId=mapId;this.theme=MAPS[mapId];
    this.ready=this.loadHall(mapId);return this.ready;
  }
  makeAvatar(profile,local=false){
    const {root,hips,torso,arms,legs,head,materials,simple,human}=makeHumanAvatar(profile,this.qualityTier,local);
    human.ready.catch(e=>{console.error(e);if(local)this.onModelError?.(e);});
    const high=local&&this.qualityTier!=='low';
    const rugMat=new THREE.MeshStandardMaterial({map:rugTexture(profile.rug,profile.pattern,high),roughness:1,bumpMap:weaveTexture(),bumpScale:.013,side:THREE.DoubleSide});materials.push(rugMat);
    const rug=new THREE.Mesh(new THREE.PlaneGeometry(1.35,2.7),rugMat);rug.rotation.x=-Math.PI/2;rug.position.set(0,.055,-.45);rug.receiveShadow=true;root.add(rug);
    // Fringes are instanced so woven detail does not increase draw calls.
    const fringe=new THREE.InstancedMesh(new THREE.BoxGeometry(.012,.008,.11),this.materials.stone,66),d=new THREE.Object3D();
    for(let n=0;n<66;n++){d.position.set(-.64+(n%33)*.04,.06,n<33?.95:-1.86);d.updateMatrix();fringe.setMatrixAt(n,d.matrix);}root.add(fringe);
    const nameElement=document.createElement('div');nameElement.className='avatar-name';nameElement.textContent=profile.name;nameElement.dir='auto';nameElement.dataset.noI18n='';
    const label=new CSS2DObject(nameElement);label.position.y=1.96;label.center.set(.5,1);root.add(label);
    const avatar={root,hips,torso,arms,legs,head,rug,fringe,profile,materials,label,labelAnchor:new THREE.Vector3(),simple,human,pose:'standing',praying:false};
    avatar.protection=this.makeFence();avatar.protection.visible=false;root.add(avatar.protection);
    avatar.target=new THREE.Vector3();
    return avatar;
  }
  disposeAvatar(a){
    this.scene.remove(a.root);
    a.root.traverse(m=>{if(m.isMesh&&m.geometry&&!m.geometry.userData.shared&&!Object.values(this.geometry).includes(m.geometry))m.geometry.dispose();});
    a.materials.forEach(m=>m.dispose());a.label.element.remove();a.human?.dispose();
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
    a.human.update(pose,praying,time,moving,dt);a.rug.visible=a.fringe.visible=praying;
    a.human.bones[5].getWorldPosition(a.labelAnchor);a.root.worldToLocal(a.labelAnchor);a.label.position.copy(a.labelAnchor);a.label.position.y+=.23;
  }

  bindControls(){
    window.addEventListener('keydown',e=>{
      if(e.target.closest('input,textarea,select,dialog')||document.querySelector('dialog[open]'))return;
      if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d','W','A','S','D'].includes(e.key)){e.preventDefault();this.keys.add(e.key.toLowerCase());}
    });
    window.addEventListener('keyup',e=>this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur',()=>{this.keys.clear();this.direction.clear();});
    const stick=document.getElementById('joystick'),thumb=document.getElementById('joystickThumb');
    let stickPointer=null;
    this.resetJoystick=()=>{
      this.joystickAxis={x:0,y:0};stick.style.setProperty('--stick-x','0px');stick.style.setProperty('--stick-y','0px');stick.classList.remove('dragging');
      if(stickPointer!==null&&stick.hasPointerCapture(stickPointer))stick.releasePointerCapture(stickPointer);
      stickPointer=null;
    };
    const moveStick=e=>{
      if(this.praying){this.resetJoystick();return;}
      const rect=stick.getBoundingClientRect(),radius=(rect.width-thumb.offsetWidth)/2-5;
      const vector=joystickVector(e.clientX-rect.left-rect.width/2,e.clientY-rect.top-rect.height/2,radius);
      this.joystickAxis={x:vector.x,y:vector.y};stick.style.setProperty('--stick-x',vector.pixelX+'px');stick.style.setProperty('--stick-y',vector.pixelY+'px');
    };
    stick.addEventListener('pointerdown',e=>{
      if(e.button!==0||this.praying||stickPointer!==null)return;
      e.preventDefault();stickPointer=e.pointerId;stick.setPointerCapture(e.pointerId);stick.classList.add('dragging');moveStick(e);
    });
    stick.addEventListener('pointermove',e=>{if(e.pointerId===stickPointer){e.preventDefault();moveStick(e);}});
    for(const event of ['pointerup','pointercancel','lostpointercapture'])stick.addEventListener(event,e=>{if(e.pointerId===stickPointer)this.resetJoystick();});
    window.addEventListener('blur',this.resetJoystick);
    const el=this.renderer.domElement,pointers=new Map();let drag=null,pinch=0;
    el.addEventListener('pointerdown',e=>{el.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});drag={x:e.clientX,y:e.clientY};});
    el.addEventListener('pointermove',e=>{
      if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(pointers.size===2){const [a,b]=[...pointers.values()],dist=Math.hypot(a.x-b.x,a.y-b.y);if(pinch)this.cameraDistance=THREE.MathUtils.clamp(this.cameraDistance+(pinch-dist)*.03,3,40);pinch=dist;drag=null;return;}
      if(drag){this.cameraAngle-=(e.clientX-drag.x)*.006;this.cameraHeight=THREE.MathUtils.clamp(this.cameraHeight+(e.clientY-drag.y)*.022,1.1,12);}
      drag={x:e.clientX,y:e.clientY};
    });
    const up=e=>{pointers.delete(e.pointerId);drag=null;pinch=0;};
    el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up);
    el.addEventListener('wheel',e=>{e.preventDefault();this.cameraDistance=THREE.MathUtils.clamp(this.cameraDistance+e.deltaY*.008,3,40);},{passive:false});
  }
  quality(value){
    const previousAsset=QUALITY_BUDGETS[this.qualityTier].asset;
    this.qualityMode=value;this.qualityTier=chooseQuality(value,this.device);this.resolutionScale=1;this.visitorDetailLimit=QUALITY_BUDGETS[this.qualityTier].detailedVisitors;
    this.local?.human.setQuality(this.qualityTier);for(const a of this.remote.values())a.human.setQuality(this.qualityTier);
    this.renderer.shadowMap.enabled=QUALITY_BUDGETS[this.qualityTier].shadows;this.renderer.shadowMap.autoUpdate=this.renderer.shadowMap.enabled;this.renderer.shadowMap.needsUpdate=true;
    this.resize();
    if(this.hallGeneration>0&&previousAsset!==QUALITY_BUDGETS[this.qualityTier].asset)this.ready=this.loadHall(this.mapId).catch(console.error);
  }
  resize(){
    const w=this.container.clientWidth,h=this.container.clientHeight,budget=QUALITY_BUDGETS[this.qualityTier];
    this.renderer.setPixelRatio(pixelRatioFor(w,h,devicePixelRatio,budget,this.resolutionScale));this.renderer.setSize(w,h,false);
    this.labels.setSize(w,h);this.camera.aspect=w/Math.max(h,1);this.camera.updateProjectionMatrix();
  }
  diagnostics(){
    return {tier:this.qualityTier,asset:this.hall?.name||null,ready:this.hallReady,drawCalls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,textures:this.renderer.info.memory.textures,pixelRatio:this.renderer.getPixelRatio(),position:{...this.position},joystick:{...this.joystickAxis},remoteVisitors:this.remote.size,userModel:this.local.human.assetId,userModelReady:this.local.human.loaded,userModelsReady:[this.local,...this.remote.values()].filter(a=>a.human.loaded).length};
  }
  frame(){
    const now=performance.now(),budget=QUALITY_BUDGETS[this.qualityTier];
    if(now-this.renderedAt<1000/budget.fps-.8)return;
    const dt=Math.min((now-this.last)/1000,.05),time=now/1000;this.last=now;this.renderedAt=now;
    if(this.qualityMode==='auto'&&this.hallReady){
      this.performanceFrames++;
      if(now-this.performanceWindow>4000){
        const average=(now-this.performanceWindow)/this.performanceFrames,next=nextResolutionScale(this.resolutionScale,average);
        if(next<this.resolutionScale){this.resolutionScale=next;this.resize();}
        if(average>47)this.visitorDetailLimit=Math.max(2,(this.visitorDetailLimit||budget.detailedVisitors)-1);
        this.performanceWindow=now;this.performanceFrames=0;
      }
    }
    let x=0,z=0;
    if(!this.praying&&!document.querySelector('dialog[open]')){
      x=(this.keys.has('d')||this.keys.has('arrowright')||this.direction.has('right')?1:0)-(this.keys.has('a')||this.keys.has('arrowleft')||this.direction.has('left')?1:0);
      z=(this.keys.has('s')||this.keys.has('arrowdown')||this.direction.has('down')?1:0)-(this.keys.has('w')||this.keys.has('arrowup')||this.direction.has('up')?1:0);
    }
    if(!this.praying&&!document.querySelector('dialog[open]')&&!x&&!z){x=this.joystickAxis.x;z=this.joystickAxis.y;}
    const strength=Math.min(1,Math.hypot(x,z));
    this.moving=strength>.001;
    if(this.moving){
      this.portraitMode=false;
      const l=Math.hypot(x,z);x/=l;z/=l;
      const dx=x*Math.cos(this.cameraAngle)+z*Math.sin(this.cameraAngle),dz=-x*Math.sin(this.cameraAngle)+z*Math.cos(this.cameraAngle);
      const next=constrainedMove(this.position,{x:this.position.x+dx*4*dt*strength,z:this.position.z+dz*4*dt*strength},dt,this.mapId);
      const allowed=[...this.remote.values()].every(a=>!a.protected||fenceAllows(this.position,next,{x:a.target.x,z:a.target.z,yaw:a.targetYaw,accountId:a.accountId},this.accountId,(this.friendIds||[]).includes(a.accountId)?[this.accountId]:[]));
      if(allowed)this.position=next;
      this.yaw=Math.atan2(-dx,-dz);
    }
    if(this.praying)this.yaw=prayerYaw(this.mapId,this.position);
    this.local.root.position.set(this.position.x,0,this.position.z);
    this.local.root.rotation.y=this.yaw;
    this.applyPose(this.local,this.pose,this.praying,time,this.moving,dt);
    const nearby=[...this.remote.values()].filter(a=>!this.blockedIds?.has(a.accountId)).sort((a,b)=>a.target.distanceToSquared(this.local.root.position)-b.target.distanceToSquared(this.local.root.position)).slice(0,this.visitorDetailLimit||budget.detailedVisitors);
    for(const a of this.remote.values()){
      const detailed=nearby.includes(a)&&a.target.distanceToSquared(this.local.root.position)<144;
      a.human.setDetail(detailed);a.hips.visible=true;a.simple.visible=false;a.label.visible=(detailed||this.friendIds?.includes(a.accountId))&&a.target.distanceToSquared(this.local.root.position)<144;
      const moving=a.root.position.distanceTo(a.target)>.03;
      a.root.position.lerp(a.target,1-Math.exp(-dt*12));
      const delta=Math.atan2(Math.sin(a.targetYaw-a.root.rotation.y),Math.cos(a.targetYaw-a.root.rotation.y));a.root.rotation.y+=delta*(1-Math.exp(-dt*12));
      this.applyPose(a,a.pose,a.praying,time,moving,dt);
      a.rug.visible=a.praying&&a.target.distanceToSquared(this.local.root.position)<225;a.fringe.visible=a.praying&&detailed;
      a.protection.visible=!!a.protected&&a.praying;
      // Preserve an occupied fence boundary while hiding this visitor's appearance.
      if(this.blockedIds?.has(a.accountId)){a.hips.visible=a.simple.visible=a.label.visible=a.rug.visible=a.fringe.visible=false;}
    }
    let shadowIndex=0;for(const a of [this.local,...this.remote.values()]){if(shadowIndex>=100)break;if(a!==this.local&&this.blockedIds?.has(a.accountId))continue;this.shadowTransform.position.set(a.root.position.x,.035,a.root.position.z);this.shadowTransform.rotation.set(0,a.root.rotation.y,0);this.shadowTransform.scale.set(.85,1,.55);this.shadowTransform.updateMatrix();this.avatarShadows.setMatrixAt(shadowIndex++,this.shadowTransform.matrix);}this.avatarShadows.count=shadowIndex;this.avatarShadows.instanceMatrix.needsUpdate=true;
    this.fence.visible=(this.fencePreview||this.protected)&&this.praying;this.fence.position.set(this.position.x,0,this.position.z);this.fence.rotation.y=this.yaw;
    const focus=this.portraitMode&&!this.praying?{height:.94,forward:0}:avatarFocus(this.pose,this.praying);
    const target=this.cameraTarget.set(this.position.x-Math.sin(this.yaw)*focus.forward,focus.height,this.position.z-Math.cos(this.yaw)*focus.forward);
    const cam=this.desiredCamera.set(target.x+Math.sin(this.cameraAngle)*this.cameraDistance,this.cameraHeight,target.z+Math.cos(this.cameraAngle)*this.cameraDistance);
    this.camera.position.lerp(cam,1-Math.exp(-dt*4));this.camera.lookAt(target);

    const fov=this.portraitMode?56:80;if(this.camera.fov!==fov){this.camera.fov=fov;this.camera.updateProjectionMatrix();}
    this.renderer.render(this.scene,this.camera);this.labels.render(this.scene,this.camera);
  }
}

