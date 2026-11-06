import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from '../public/vendor/GLTFLoader.js';
import {makeHumanAvatar} from '../public/avatars.js';
import {inspectGLB} from '../scripts/prepare-user-models.mjs';
const v=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);

test('All supplied arms carry palm orientation through the sleeves without twisting the wrists',async()=>{
 const oldFetch=globalThis.fetch,oldLoad=GLTFLoader.prototype.loadAsync;
 const runtime=JSON.parse(await readFile('public/user-models/runtime.json','utf8'));
 try{
  globalThis.fetch=async()=>Response.json(runtime);
  GLTFLoader.prototype.loadAsync=async url=>{
   const raw=inspectGLB(new Uint8Array(await readFile('public/user-models/'+url.split('/').at(-1))));
   return {scene:new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position',new THREE.BufferAttribute(raw.positions,3)).setAttribute('normal',new THREE.BufferAttribute(raw.normals,3)).setIndex(new THREE.BufferAttribute(raw.indices,1)),new THREE.MeshStandardMaterial())};
  };
  for(let n=1;n<=10;n++)for(const local of [true,false]){
   const id='model'+String(n).padStart(2,'0'),a=makeHumanAvatar({model:id,gender:n>=8?'female':'male'},'low',local);
   await a.human.ready;if(!local)a.human.setDetail(false);
   let mesh;a.root.traverse(node=>{if(node.isSkinnedMesh&&node.userData.userModel)mesh=node;});
   let time=0;
   for(const yaw of [0,.83])for(const pose of ['idle','walking','standing','bowing','sitting','prostrating','greeting']){
    a.root.rotation.y=yaw;const praying=!['idle','walking','greeting'].includes(pose),kneeling=['sitting','prostrating'].includes(pose);
    for(let frame=0;frame<180;frame++)a.human.update(praying?pose:'standing',praying,time+=1/60,pose==='walking',1/60,pose==='greeting'?.5:-1);
    a.root.updateMatrixWorld(true);a.human.skeleton.update();const rotation=a.root.getWorldQuaternion(new THREE.Quaternion());
    for(const [side,upperId,elbowId,handId]of [[-1,6,7,8],[1,9,10,11]]){
     const upper=a.human.bones[upperId],elbow=a.human.bones[elbowId],hand=a.human.bones[handId],label=id+' '+local+' '+yaw+' '+pose+' '+side;
     const palm=v(0,0,-1).applyQuaternion(hand.getWorldQuaternion(new THREE.Quaternion()));
     const normal=(kneeling?v(0,-1,0):praying||pose==='greeting'&&side>0?v(0,0,1):v(-side,0,0)).applyQuaternion(rotation);
     assert.ok(palm.dot(normal)>(pose==='standing'?.85:.90),label+' palm faces the correct surface');
     if(!kneeling){
      assert.ok(hand.quaternion.angleTo(new THREE.Quaternion())<.005,label+' wrist does not absorb arm roll');
      const forearmPalm=v(0,0,-1).applyQuaternion(elbow.getWorldQuaternion(new THREE.Quaternion()));assert.ok(palm.dot(forearmPalm)>.999,label+' sleeve and palm share their roll');
     }else{
      assert.ok(v(side,0,0).applyQuaternion(hand.getWorldQuaternion(new THREE.Quaternion())).dot(v(0,0,-1).applyQuaternion(rotation))>.999,label+' fingers point forward');
      assert.ok(hand.quaternion.angleTo(new THREE.Quaternion())<1.3,label+' wrist flexion remains bounded');
     }
     assert.ok(Math.abs(upper.getWorldPosition(v()).distanceTo(elbow.getWorldPosition(v()))-runtime[id].rig.upper)<1e-5,label+' upper arm length');
     assert.ok(Math.abs(elbow.getWorldPosition(v()).distanceTo(hand.getWorldPosition(v()))-runtime[id].rig.lower)<1e-5,label+' forearm length');
     // Check the authored palm vertices as skinned, not only the synthetic bone axes.
     const p=mesh.geometry.attributes.position,normals=mesh.geometry.attributes.normal,weights=mesh.geometry.attributes.skinWeight,joints=mesh.geometry.attributes.skinIndex;
     let samples=0,alignment=0;
     for(let i=0;i<p.count;i++){
      if(Math.sign(p.getX(i))!==side||Math.abs(p.getX(i))<runtime[id].rig.wrist+.005||Math.abs(p.getX(i))>runtime[id].rig.wrist+.04||normals.getZ(i)>-.7)continue;
      let weight=0;for(let k=0;k<4;k++)if(joints.getComponent(i,k)===handId)weight+=weights.getComponent(i,k);if(weight<.90)continue;
      const point=v().fromBufferAttribute(p,i),sourceNormal=v().fromBufferAttribute(normals,i);
      const origin=mesh.applyBoneTransform(i,point.clone()),normal=mesh.applyBoneTransform(i,point.clone().addScaledVector(sourceNormal,.01)).sub(origin).normalize().applyQuaternion(rotation);
      alignment+=normal.dot(palm);samples++;
     }
     if(samples)assert.ok(alignment/samples>.65,label+' supplied palm surface follows its bone');
    }
   }
   a.human.dispose();
  }
 }finally{globalThis.fetch=oldFetch;GLTFLoader.prototype.loadAsync=oldLoad;}
});
