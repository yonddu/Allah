import * as THREE from 'three';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {selectedModel} from './user-model-catalog.js';
import {skinUserGeometry} from './user-skinning.js';
const v=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const I={root:0,hips:1,spine:2,chest:3,neck:4,head:5,la:6,le:7,lh:8,ra:9,re:10,rh:11,ll:12,lk:13,lf:14,rl:15,rk:16,rf:17};
const cache=new Map(),fileCache=new Map();let catalogReady;
function template(file,config){
 if(!fileCache.has(file))fileCache.set(file,new GLTFLoader().loadAsync('/user-models/'+file).then(gltf=>{
  let mesh;gltf.scene.traverse(n=>{if(n.isMesh)mesh=n;});if(!mesh)throw new Error('Empty character model');
  skinUserGeometry(mesh.geometry,config);for(const m of [mesh.material].flat())if(m.map)m.map.anisotropy=2;return mesh;
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
 return bones;
}
const qa=new THREE.Quaternion();
function rotateToward(bone,rest,direction){const parent=bone.parent.getWorldQuaternion(qa).invert(),local=direction.clone().applyQuaternion(parent).normalize();bone.quaternion.setFromUnitVectors(rest,local);bone.updateWorldMatrix(false,true);}
function armIK(bones,side,target,hint){
 const shoulder=bones[side<0?I.la:I.ra],elbow=bones[side<0?I.le:I.re],a=shoulder.getWorldPosition(v()),dir=target.clone().sub(a),l1=elbow.position.length(),l2=bones[side<0?I.lh:I.rh].position.length(),distance=THREE.MathUtils.clamp(dir.length(),.025,l1+l2-.001);dir.normalize();
 const along=(l1*l1-l2*l2+distance**2)/(2*distance),height=Math.sqrt(Math.max(0,l1*l1-along**2));
 const bend=hint.clone().sub(a);bend.addScaledVector(dir,-bend.dot(dir));if(bend.lengthSq()<.0001)bend.set(side,-1,0);bend.normalize();
 const knee=a.clone().addScaledVector(dir,along).addScaledVector(bend,height),rest=v(side,0,0);
 rotateToward(shoulder,rest,knee.clone().sub(a));rotateToward(elbow,rest,target.clone().sub(knee));
}
export function makeHumanAvatar(profile,tier='low',local=false){
 const root=new THREE.Group(),hips=new THREE.Group(),simple=new THREE.Group(),bones=rig({armY:1.42,shoulder:.21,upper:.25,lower:.24});root.add(hips,simple);hips.add(bones[0]);
 let poseAt=-Infinity,poseState=null,armReach=.49;
 let skeleton=new THREE.Skeleton(bones),mesh=null,stages=null,detailed=true,disposed=false;
 const human={
  skeleton,bones,assetId:selectedModel(profile).id,loaded:false,
  setQuality(){},
  setDetail(value){detailed=value;if(mesh&&stages){const source=stages[local?0:(detailed?1:2)];mesh.geometry=source.geometry;mesh.material=source.material;}},
  dispose(){disposed=true;skeleton.dispose();},
  update(pose,praying,time,moving,dt){
   const state=pose+praying+moving;if(!local&&!detailed&&state===poseState&&time-poseAt<1/12)return;
   if(!local&&!detailed)dt=Math.min(.25,Math.max(dt,time-poseAt));poseAt=time;poseState=state;
   const kneeling=pose==='sitting'||pose==='prostrating',prostrating=pose==='prostrating',bowing=pose==='bowing',s=1-Math.exp(-dt*10),hip=prostrating?.54:kneeling?.39:.92;
   bones[I.hips].position.y=THREE.MathUtils.lerp(bones[I.hips].position.y,hip+(moving?Math.sin(time*10)*.016:0),s);
   bones[I.spine].position.y=THREE.MathUtils.lerp(bones[I.spine].position.y,prostrating?.045:.20,s);
   bones[I.spine].rotation.x=THREE.MathUtils.lerp(bones[I.spine].rotation.x,prostrating?-2.45:bowing?-1.04:0,s);
   for(const side of [-1,1]){
    const leg=bones[side<0?I.ll:I.rl],knee=bones[side<0?I.lk:I.rk];
    leg.rotation.x=THREE.MathUtils.lerp(leg.rotation.x,kneeling?(prostrating?.85:1.0):moving?Math.sin(time*8+side)*.30:0,s);
    knee.rotation.x=THREE.MathUtils.lerp(knee.rotation.x,kneeling?(prostrating?-1.9:-2.2):moving?Math.max(0,-Math.sin(time*8+side))*.30:0,s);
   }
   root.updateMatrixWorld(true);
   for(const side of [-1,1]){
    let target,hint;
    if(prostrating){target=v(side*.22,.075,-.65).applyMatrix4(root.matrixWorld);hint=v(side*.40,.26,-.40).applyMatrix4(root.matrixWorld);}
    else if(bowing){target=v(side*.115,.53,-.10).applyMatrix4(root.matrixWorld);hint=v(side*.31,.80,-.20).applyMatrix4(root.matrixWorld);}
    else if(kneeling){target=v(side*.13,.43,-.34).applyMatrix4(root.matrixWorld);hint=v(side*.32,.64,-.12).applyMatrix4(root.matrixWorld);}
    else if(praying){target=v(side*-.025,-.22,-.20).applyMatrix4(bones[I.chest].matrixWorld);hint=v(side*.32,-.30,-.06).applyMatrix4(bones[I.chest].matrixWorld);}
    else{target=v(side*.24,.045-armReach*.96,moving?Math.sin(time*8+side)*.10:0).applyMatrix4(bones[I.chest].matrixWorld);hint=v(side*.27,-armReach*.48,-.04).applyMatrix4(bones[I.chest].matrixWorld);}
    armIK(bones,side,target,hint);const hand=bones[side<0?I.lh:I.rh];hand.rotation.x=prostrating?Math.PI/2:0;
   }
  }
 };
 human.ready=userAsset(human.assetId,local).then(asset=>{
  if(disposed)return;
  const c=asset.config;armReach=c.upper+c.lower;bones[I.chest].position.y=c.armY-.045-1.12;
  bones[I.neck].position.y=1.52-(c.armY-.045);
  for(const side of [-1,1]){bones[side<0?I.la:I.ra].position.x=side*c.shoulder;bones[side<0?I.le:I.re].position.x=side*c.upper;bones[side<0?I.lh:I.rh].position.x=side*c.lower;}
  // Bind the supplied mesh in its untouched T-pose before applying animation.
  for(const bone of bones)bone.quaternion.identity();bones[I.hips].position.y=.92;bones[I.spine].position.y=.20;root.updateMatrixWorld(true);
  skeleton.dispose();skeleton=new THREE.Skeleton(bones);human.skeleton=skeleton;stages=asset.meshes;
  const source=stages[local?0:(detailed?1:2)];mesh=new THREE.SkinnedMesh(source.geometry,source.material);mesh.frustumCulled=true;mesh.boundingSphere=new THREE.Sphere(new THREE.Vector3(0,.9,0),1.8);mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.userModel=human.assetId;hips.add(mesh);mesh.bind(skeleton);human.loaded=true;
  human.update('standing',false,0,false,1);
 });
 return {root,hips,simple,human,head:bones[I.head],torso:bones[I.spine],arms:[bones[I.la],bones[I.ra]],legs:[bones[I.ll],bones[I.rl]],materials:[]};
}
