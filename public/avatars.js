import * as THREE from 'three';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {selectedModel} from './user-model-catalog.js';
import {skinUserGeometry} from './user-skinning.js';
import {modestyAsset,prayerSockAsset,coveredMaterial} from './modesty.js';
import {SUJUD,findBodyContacts,prostrationSpineZ,plantProstrationLegs,plantStandingPrayerLegs,palmFacing} from './avatar-kinematics.js';
const v=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const I={root:0,hips:1,spine:2,chest:3,neck:4,head:5,la:6,le:7,lh:8,ra:9,re:10,rh:11,ll:12,lk:13,lf:14,rl:15,rk:16,rf:17};
const cache=new Map(),fileCache=new Map();let catalogReady;
function template(file,config){
 if(!fileCache.has(file))fileCache.set(file,new GLTFLoader().loadAsync('/user-models/'+file).then(gltf=>{
  let mesh;gltf.scene.traverse(n=>{if(n.isMesh)mesh=n;});if(!mesh)throw new Error('Empty character model');
  skinUserGeometry(mesh.geometry,config);mesh.userData.contacts=findBodyContacts(mesh.geometry);for(const m of [mesh.material].flat())if(m.map)m.map.anisotropy=2;return mesh;
 }).catch(error=>{fileCache.delete(file);throw error;}));
 return fileCache.get(file);
}
function userAsset(id,local){
 const key=id+(local?':self':':visitor');
 if(!cache.has(key))cache.set(key,(async()=>{
  catalogReady??=fetch('/user-models/runtime.json').then(r=>{if(!r.ok)throw new Error('Character catalog unavailable');return r.json();});
  const model=(await catalogReady)[id];if(!model)throw new Error('Character unavailable: '+id);
  const files=local?[model.full,model.full,model.full]:[model.far,model.near,model.far];
  return {meshes:await Promise.all(files.map(file=>template(file,model.rig))),config:model.rig};
 })().catch(error=>{cache.delete(key);throw error;}));
 return cache.get(key);
}
function rig(c){
 const bones=[],add=(name,parent,pos)=>{const b=new THREE.Bone();b.name=name;b.position.set(...pos);if(parent!==null)bones[parent].add(b);bones.push(b);};
 add('root',null,[0,0,0]);add('hips',0,[0,.92,0]);add('spine',1,[0,.20,0]);add('chest',2,[0,c.armY-.045-1.12,0]);add('neck',3,[0,1.52-(c.armY-.045),0]);add('head',4,[0,.15,0]);
 for(const side of [-1,1]){const start=bones.length;add(side<0?'leftShoulder':'rightShoulder',3,[side*c.shoulder,.045,0]);add('elbow',start,[side*c.upper,0,0]);add('wrist',start+1,[side*c.lower,0,0]);}
 for(const side of [-1,1]){const start=bones.length;add(side<0?'leftHip':'rightHip',1,[side*.10,-.01,0]);add('knee',start,[0,-.42,0]);add('ankle',start+1,[0,-.41,0]);}
 for(const side of [-1,1]){const start=bones.length;add('fingerKnuckles',side<0?I.lh:I.rh,[side*.045,0,0]);add('fingerTips',start,[side*.033,0,0]);}
 return bones;
}
function armIK(bones,side,target,hint,palmNormal){
 const shoulder=bones[side<0?I.la:I.ra],elbow=bones[side<0?I.le:I.re],a=shoulder.getWorldPosition(v()),dir=target.clone().sub(a),l1=elbow.position.length(),l2=bones[side<0?I.lh:I.rh].position.length(),distance=THREE.MathUtils.clamp(dir.length(),.025,l1+l2-.001);dir.normalize();
 const along=(l1*l1-l2*l2+distance**2)/(2*distance),height=Math.sqrt(Math.max(0,l1*l1-along**2));
 const bend=hint.clone().sub(a);bend.addScaledVector(dir,-bend.dot(dir));if(bend.lengthSq()<.0001)bend.set(side,-1,0);bend.normalize();
 const knee=a.clone().addScaledVector(dir,along).addScaledVector(bend,height);
 // Carry the palm frame through the whole arm instead of correcting its roll only at the wrist.
 palmFacing(shoulder,side,knee.clone().sub(a),palmNormal);palmFacing(elbow,side,target.clone().sub(knee),palmNormal);
}
export function makeHumanAvatar(profile,tier='low',local=false){
 const root=new THREE.Group(),hips=new THREE.Group(),simple=new THREE.Group(),bones=rig({armY:1.42,shoulder:.21,upper:.25,lower:.24});root.add(hips,simple);hips.add(bones[0]);
 let poseAt=-Infinity,poseState=null,armReach=.49,contacts={forehead:v(0,1.72,-.08),toes:{left:v(-.1,.025,-.14),right:v(.1,.025,-.14)}};
 const armNormals={left:v(1,0,0),right:v(-1,0,0)};
 let skeleton=new THREE.Skeleton(bones),mesh=null,cover=null,coverage=null,sockMesh=null,sockAsset=null,stages=null,detailed=true,disposed=false,lastCovered=-Infinity,lastPrayer=-Infinity;
 const female=selectedModel(profile).gender==='female',active={value:0},sockActive={value:0},materialCopies=new Map();
 const materialFor=source=>{if(!materialCopies.has(source.material))materialCopies.set(source.material,coveredMaterial(source.material,active,coverage.color,sockActive,sockAsset?.color));return materialCopies.get(source.material);};
 const human={
  skeleton,bones,assetId:selectedModel(profile).id,loaded:false,
  get contacts(){return contacts;},
  get modesty(){return {enabled:active.value===1,mesh:cover,asset:coverage};},
  get socks(){return {enabled:sockActive.value===1,mesh:sockMesh,asset:sockAsset};},
  setQuality(){},
  setDetail(value){detailed=value;if(mesh&&stages){const source=stages[local?0:(detailed?1:2)];mesh.geometry=source.geometry;mesh.material=materialFor(source);}},
  dispose(){disposed=true;skeleton.dispose();for(const material of materialCopies.values())for(const m of [material].flat())m.dispose();},
  update(pose,praying,time,moving,dt,greeting=-1){
   if(!praying)pose='standing';
   if(praying&&pose!=='standing')lastCovered=time;
   active.value=time-lastCovered<.8?1:0;if(cover)cover.visible=active.value===1;
   if(praying)lastPrayer=time;sockActive.value=female&&time-lastPrayer<.8?1:0;if(sockMesh)sockMesh.visible=sockActive.value===1;
   const greetingWeight=greeting>=0?Math.min(1,greeting/.20,(1-greeting)/.24):0;
   const state=pose+praying+moving+(greetingWeight>0);if(!local&&!detailed&&state===poseState&&time-poseAt<1/12)return;
   if(!local&&!detailed)dt=Math.min(.25,Math.max(dt,time-poseAt));poseAt=time;poseState=state;
   const kneeling=pose==='sitting'||pose==='prostrating',prostrating=pose==='prostrating',bowing=pose==='bowing',s=1-Math.exp(-dt*10),hip=prostrating?SUJUD.hipY:kneeling?.39:praying?.965:.92;
   bones[I.hips].position.y=THREE.MathUtils.lerp(bones[I.hips].position.y,hip+(moving?Math.sin(time*10)*.016:0),s);
   bones[I.hips].position.z=THREE.MathUtils.lerp(bones[I.hips].position.z,prostrating?SUJUD.hipZ:0,s);
   bones[I.hips].rotation.x=THREE.MathUtils.lerp(bones[I.hips].rotation.x,prostrating?SUJUD.hipAngle:0,s);
   bones[I.spine].position.y=THREE.MathUtils.lerp(bones[I.spine].position.y,.20,s);
   bones[I.spine].position.z=THREE.MathUtils.lerp(bones[I.spine].position.z,prostrating?prostrationSpineZ(contacts):0,s);
   bones[I.spine].rotation.x=THREE.MathUtils.lerp(bones[I.spine].rotation.x,prostrating?SUJUD.spineAngle:bowing?-1.04:0,s);
   bones[I.head].rotation.x=THREE.MathUtils.lerp(bones[I.head].rotation.x,prostrating?SUJUD.headAngle:-.13*greetingWeight,s);
   for(const side of [-1,1]){
    const leg=bones[side<0?I.ll:I.rl],knee=bones[side<0?I.lk:I.rk];
    if(praying)continue;
    bones[side<0?I.lf:I.rf].quaternion.identity();
    leg.quaternion.slerp(new THREE.Quaternion().setFromAxisAngle(v(1,0,0),moving?Math.sin(time*8+side)*.30:0),s);
    knee.quaternion.slerp(new THREE.Quaternion().setFromAxisAngle(v(1,0,0),moving?Math.max(0,-Math.sin(time*8+side))*.30:0),s);
   }
   root.updateMatrixWorld(true);
   if(praying&&human.loaded){if(kneeling)plantProstrationLegs(root,bones,contacts);else plantStandingPrayerLegs(root,bones,contacts);}
   for(const side of [-1,1]){
    let target,hint;
    if(prostrating){target=v(side*.24,.085,-.40).applyMatrix4(root.matrixWorld);hint=v(side*.45,.23,-.18).applyMatrix4(root.matrixWorld);}
    else if(bowing){target=v(side*.115,.53,-.10).applyMatrix4(root.matrixWorld);hint=v(side*.31,.80,-.20).applyMatrix4(root.matrixWorld);}
    else if(kneeling){target=v(side*.13,.45,-.23).applyMatrix4(root.matrixWorld);hint=v(side*.25,.68,-.04).applyMatrix4(root.matrixWorld);}
    else if(praying){target=v(side*-.025,-.22,-.20).applyMatrix4(bones[I.chest].matrixWorld);hint=v(side*.32,-.30,-.06).applyMatrix4(bones[I.chest].matrixWorld);}
    else{
     target=v(side*.24,.045-armReach*(moving?.96:.985),-.025+(moving?Math.sin(time*8+side)*.10:0));
     if(side>0&&greetingWeight>0)target.lerp(v(-.045,-.04,-.22),greetingWeight);
     // In -Z-forward space a resting elbow sits behind the wrist, not in front of it.
     target.applyMatrix4(bones[I.chest].matrixWorld);hint=v(bones[side<0?I.la:I.ra].position.x,-armReach*.48,side>0?THREE.MathUtils.lerp(.12,-.12,greetingWeight):.12).applyMatrix4(bones[I.chest].matrixWorld);
    }
    const rootRotation=root.getWorldQuaternion(new THREE.Quaternion());
    const normal=kneeling?v(0,-1,0):praying?v(0,0,1):side>0&&greetingWeight>0?v(0,0,1):v(-side,0,0);
    const palm=armNormals[side<0?'left':'right'].lerp(normal,s).normalize().clone().applyQuaternion(rootRotation);
    armIK(bones,side,target,hint,palm);const hand=bones[side<0?I.lh:I.rh],elbow=bones[side<0?I.le:I.re];
    const direction=kneeling?v(0,0,-1).applyQuaternion(rootRotation):hand.getWorldPosition(v()).sub(elbow.getWorldPosition(v()));
    palmFacing(hand,side,direction,palm,s);
    const curl=praying||greetingWeight>0?0:moving?.70:.48,knuckle=side<0?18:20;
    bones[knuckle].rotation.y=THREE.MathUtils.lerp(bones[knuckle].rotation.y,side*curl,s);
    bones[knuckle+1].rotation.y=THREE.MathUtils.lerp(bones[knuckle+1].rotation.y,side*curl*.75,s);
   }
  }
 };
 human.ready=userAsset(human.assetId,local).then(asset=>{
  if(disposed)return;
  const c=asset.config;contacts=asset.meshes[0].userData.contacts;armReach=c.upper+c.lower;bones[I.chest].position.y=c.armY-.045-1.12;
  bones[I.ll].position.x=contacts.feet.left.center.x;bones[I.rl].position.x=contacts.feet.right.center.x;
  bones[I.neck].position.y=1.52-(c.armY-.045);
  for(const side of [-1,1]){bones[side<0?I.la:I.ra].position.x=side*c.shoulder;bones[side<0?I.le:I.re].position.x=side*c.upper;bones[side<0?I.lh:I.rh].position.x=side*c.lower;}
  // Bind the supplied mesh in its untouched T-pose before applying animation.
  for(const bone of bones)bone.quaternion.identity();bones[I.hips].position.set(0,.92,0);bones[I.spine].position.set(0,.20,0);root.updateMatrixWorld(true);
  skeleton.dispose();skeleton=new THREE.Skeleton(bones);human.skeleton=skeleton;stages=asset.meshes;
  const source=stages[local?0:(detailed?1:2)];coverage=modestyAsset(source,human.assetId);if(female)sockAsset=prayerSockAsset(source,human.assetId,c);mesh=new THREE.SkinnedMesh(source.geometry,materialFor(source));mesh.frustumCulled=true;mesh.boundingSphere=new THREE.Sphere(new THREE.Vector3(0,.9,0),1.8);mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.userModel=human.assetId;hips.add(mesh);mesh.bind(skeleton);
  cover=new THREE.SkinnedMesh(coverage.geometry,coverage.material);cover.name='Closed prayer undergarment';cover.frustumCulled=true;cover.boundingSphere=new THREE.Sphere(v(0,.9,0),1.8);cover.castShadow=true;cover.receiveShadow=true;hips.add(cover);cover.bind(skeleton,mesh.bindMatrix);cover.visible=active.value===1;human.loaded=true;
  if(sockAsset){sockMesh=new THREE.SkinnedMesh(sockAsset.geometry,sockAsset.material);sockMesh.name='Opaque prayer socks';sockMesh.frustumCulled=true;sockMesh.boundingSphere=new THREE.Sphere(v(0,.9,0),1.8);sockMesh.castShadow=true;sockMesh.receiveShadow=true;hips.add(sockMesh);sockMesh.bind(skeleton,mesh.bindMatrix);sockMesh.visible=false;}
  human.update('standing',false,0,false,1);
 });
 return {root,hips,simple,human,head:bones[I.head],torso:bones[I.spine],arms:[bones[I.la],bones[I.ra]],legs:[bones[I.ll],bones[I.rl]],materials:[]};
}
