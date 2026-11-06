import * as THREE from 'three';
const v=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
export const SUJUD=Object.freeze({hipY:.45,hipZ:.30,hipAngle:-1.90,spineAngle:-.14,headAngle:-Math.PI/2+2.04,surfaceY:.067,kneeY:.085});
export function findBodyContacts(geometry){
 const p=geometry.getAttribute('position');let forehead=v(0,1.72,-.08),foreheadIndex=-1,best=Infinity;
 const toes={left:v(-.10,.025,-.14),right:v(.10,.025,-.14)},toeIndices={left:-1,right:-1};
 const feet=Object.fromEntries(['left','right'].map(key=>[key,{min:v(Infinity,Infinity,Infinity),max:v(-Infinity,-Infinity,-Infinity)}]));
 for(let i=0;i<p.count;i++){
  const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
  if(Math.abs(x)<.075&&y>1.69&&y<1.755){const score=z+Math.abs(y-1.72)*.25;if(score<best){best=score;forehead.set(x,y,z);foreheadIndex=i;}}
  if(y<.07&&Math.abs(x)<.24&&Math.abs(x)>.025){const key=x<0?'left':'right';if(toeIndices[key]<0||z<toes[key].z){toes[key].set(x,y,z);toeIndices[key]=i;}}
  if(y<.07&&Math.abs(x)>.025&&Math.abs(x)<.4){const foot=feet[x<0?'left':'right'],point=v(x,y,z);foot.min.min(point);foot.max.max(point);}
 }
 for(const [key,side]of [['left',-1],['right',1]]){
  const foot=feet[key];if(!Number.isFinite(foot.min.x)){foot.min.set(side*.1-.055,0,-.16);foot.max.set(side*.1+.055,.07,.07);}
  foot.center=foot.min.clone().add(foot.max).multiplyScalar(.5);foot.innerX=side<0?foot.max.x:foot.min.x;
  foot.ankleX=foot.center.x+side*.006-foot.innerX;
 }
 return {forehead,foreheadIndex,toes,toeIndices,feet};
}
export function prostrationSpineZ(contacts){
 const a=SUJUD.hipAngle,b=a+SUJUD.spineAngle;
 // The face points straight down; its bind-space Z therefore determines floor contact.
 return THREE.MathUtils.clamp((SUJUD.surfaceY-SUJUD.hipY-.20*Math.cos(a)-.55*Math.cos(b)-contacts.forehead.z)/(-Math.sin(a)),-.25,.25);
}
function setWorldRotation(bone,world,blend=1){
 const parent=bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert(),target=parent.multiply(world);
 bone.quaternion.slerp(target,blend);bone.updateWorldMatrix(false,true);
}
export function palmFacing(bone,side,fingerDirection,palmNormal,blend=1){
 const x=fingerDirection.clone().normalize().multiplyScalar(side),z=palmNormal.clone().negate();
 z.addScaledVector(x,-z.dot(x));if(z.lengthSq()<1e-8)return;z.normalize();
 const y=z.clone().cross(x).normalize();z.copy(x).cross(y).normalize();
 setWorldRotation(bone,new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,y,z)),blend);
}
function aim(bone,direction){
 const local=direction.clone().applyQuaternion(bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert()).normalize();
 bone.quaternion.setFromUnitVectors(v(0,-1,0),local);bone.updateWorldMatrix(false,true);
}
export function plantProstrationLegs(root,bones,contacts){
 for(const [upperId,kneeId,footId,key]of [[12,13,14,'left'],[15,16,17,'right']]){
  const upper=bones[upperId],knee=bones[kneeId],foot=bones[footId],origin=upper.getWorldPosition(v()),local=root.worldToLocal(origin.clone()),thigh=knee.position.length(),shin=foot.position.length();
  const dy=THREE.MathUtils.clamp(SUJUD.kneeY-local.y,-thigh+.001,thigh-.001);
  const kneeLocal=v(local.x,local.y+dy,local.z-Math.sqrt(Math.max(0,thigh*thigh-dy*dy)));
  const footY=SUJUD.surfaceY-contacts.toes[key].z,sy=THREE.MathUtils.clamp(footY-kneeLocal.y,-shin+.001,shin-.001);
  const ankleX=contacts.feet[key].ankleX,dx=ankleX-kneeLocal.x;
  const ankleLocal=v(ankleX,kneeLocal.y+sy,kneeLocal.z+Math.sqrt(Math.max(0,shin*shin-sy*sy-dx*dx)));
  const kneeWorld=root.localToWorld(kneeLocal.clone()),ankleWorld=root.localToWorld(ankleLocal.clone());
  aim(upper,kneeWorld.clone().sub(origin));aim(knee,ankleWorld.sub(kneeWorld));
  setWorldRotation(foot,root.getWorldQuaternion(new THREE.Quaternion()).multiply(new THREE.Quaternion().setFromAxisAngle(v(1,0,0),-Math.PI/2)));
 }
}
export function plantStandingPrayerLegs(root,bones,contacts){
 for(const [upperId,kneeId,footId,key]of [[12,13,14,'left'],[15,16,17,'right']]){
  const upper=bones[upperId],knee=bones[kneeId],foot=bones[footId],origin=upper.getWorldPosition(v());
  const target=root.localToWorld(v(contacts.feet[key].ankleX,.08+SUJUD.surfaceY-contacts.feet[key].min.y,0));
  const dir=target.clone().sub(origin),thigh=knee.position.length(),shin=foot.position.length(),distance=THREE.MathUtils.clamp(dir.length(),.01,thigh+shin-.0001);dir.normalize();
  const along=(thigh*thigh-shin*shin+distance*distance)/(2*distance),height=Math.sqrt(Math.max(0,thigh*thigh-along*along));
  const bend=root.localToWorld(v(contacts.feet[key].center.x,.45,-.25)).sub(origin);bend.addScaledVector(dir,-bend.dot(dir)).normalize();
  const joint=origin.clone().addScaledVector(dir,along).addScaledVector(bend,height);
  aim(upper,joint.clone().sub(origin));aim(knee,target.clone().sub(joint));setWorldRotation(foot,root.getWorldQuaternion(new THREE.Quaternion()));
 }
}
