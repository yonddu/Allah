import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from '../public/vendor/GLTFLoader.js';
import {makeHumanAvatar} from '../public/avatars.js';
import {SUJUD} from '../public/avatar-kinematics.js';
import {inspectGLB} from '../scripts/prepare-user-models.mjs';
test('All ten supplied meshes plant forehead, knees and toes on the mat with head clear of knees',async()=>{
 const oldFetch=globalThis.fetch,oldLoad=GLTFLoader.prototype.loadAsync;
 const runtime=JSON.parse(await readFile('public/user-models/runtime.json','utf8'));
 try{
  globalThis.fetch=async()=>Response.json(runtime);
  GLTFLoader.prototype.loadAsync=async url=>{
   const raw=inspectGLB(new Uint8Array(await readFile('public/user-models/'+url.split('/').at(-1))));
   const geometry=new THREE.BufferGeometry().setAttribute('position',new THREE.BufferAttribute(raw.positions,3)).setAttribute('normal',new THREE.BufferAttribute(raw.normals,3)).setIndex(new THREE.BufferAttribute(raw.indices,1));
   return {scene:new THREE.Mesh(geometry,new THREE.MeshStandardMaterial())};
  };
  for(let n=1;n<=10;n++){
   const id='model'+String(n).padStart(2,'0'),a=makeHumanAvatar({model:id,gender:n>=8?'female':'male'},'low',true);
   await a.human.ready;for(let frame=0;frame<240;frame++)a.human.update('prostrating',true,frame/60,false,1/60);
   a.root.updateMatrixWorld(true);a.human.skeleton.update();
   let mesh;a.root.traverse(node=>{if(node.isSkinnedMesh&&node.userData.userModel)mesh=node;});
   assert.ok(a.human.modesty.enabled,id+' closed cloth must be active for prostration');
   assert.ok(a.human.modesty.mesh.visible,id+' opaque cloth must be rendered');
   assert.ok([mesh.material].flat().every(m=>m.userData.noorBodyCoverage),id+' hip texture protection');
   assert.equal(a.human.modesty.asset.solids.length,6,id+' closed overlapping waist/hip/leg layers');
   const c=a.human.contacts,p=mesh.geometry.attributes.position;
   assert.ok(c.foreheadIndex>=0,id+' forehead landmark must come from actual geometry');
   const forehead=mesh.applyBoneTransform(c.foreheadIndex,new THREE.Vector3().fromBufferAttribute(p,c.foreheadIndex));
   assert.ok(Math.abs(forehead.y-SUJUD.surfaceY)<.008,id+' forehead height '+forehead.y);
   for(const [kneeId,key]of [[13,'left'],[16,'right']]){
    const knee=a.human.bones[kneeId].getWorldPosition(new THREE.Vector3());
    assert.ok(Math.abs(knee.y-SUJUD.kneeY)<.008,id+' knee height '+knee.y);
    assert.ok(knee.z-forehead.z>.40,id+' forehead must be forward of knees');
    const toeIndex=c.toeIndices[key];assert.ok(toeIndex>=0,id+' actual toe contact');
    const toe=mesh.applyBoneTransform(toeIndex,new THREE.Vector3().fromBufferAttribute(p,toeIndex));
    assert.ok(Math.abs(toe.y-SUJUD.surfaceY)<.008,id+' toe height '+toe.y);
   }
   const face=new THREE.Vector3(0,0,-1).applyQuaternion(a.human.bones[5].getWorldQuaternion(new THREE.Quaternion()));
   assert.ok(face.y<-.995,id+' forehead points down');
   for(const handId of [8,11]){
    const palm=new THREE.Vector3(0,0,-1).applyQuaternion(a.human.bones[handId].getWorldQuaternion(new THREE.Quaternion()));
    assert.ok(palm.y<-.98,id+' palms face the mat');
   }
   let time=4;
   for(const pose of ['standing','bowing','prostrating','sitting']){
    for(let frame=0;frame<180;frame++)a.human.update(pose,true,time+=1/60,false,1/60);
    a.root.updateMatrixWorld(true);a.human.skeleton.update();
    let leftInner=-Infinity,rightInner=Infinity,floor=Infinity;
    for(let i=0;i<p.count;i++)if(p.getY(i)<.07&&Math.abs(p.getX(i))>.025&&Math.abs(p.getX(i))<.4){
     const point=mesh.applyBoneTransform(i,new THREE.Vector3().fromBufferAttribute(p,i));
     if(p.getX(i)<0)leftInner=Math.max(leftInner,point.x);else rightInner=Math.min(rightInner,point.x);floor=Math.min(floor,point.y);
    }
    const gap=rightInner-leftInner;
    assert.ok(gap>=.003&&gap<.025,id+' '+pose+' actual feet must be together without intersecting: '+gap);
    assert.ok(Math.abs(floor-SUJUD.surfaceY)<.012,id+' '+pose+' soles/toes stay on the mat: '+floor);
    assert.equal(a.human.socks.enabled,n>=8,id+' '+pose+' female prayer socks');
    if(n>=8){assert.equal(a.human.socks.mesh.visible,true);assert.equal(a.human.socks.asset.material.transparent,false);assert.equal(a.human.socks.asset.material.opacity,1);}
   }
   // Leaving prayer must release foot placement and restore walking, including the lateral knee rotation.
   a.human.update('standing',false,time+=.1,false,.1);if(n>=8)assert.equal(a.human.socks.enabled,true,'Keep covered while getting up');
   for(let frame=0;frame<180;frame++)a.human.update('standing',false,time+=1/60,false,1/60);
   assert.equal(a.human.socks.enabled,false);if(n>=8)assert.equal(a.human.socks.mesh.visible,false);
   for(const boneId of [12,13,15,16])assert.ok(a.human.bones[boneId].quaternion.angleTo(new THREE.Quaternion())<.0001,id+' natural non-prayer stance');
   a.human.dispose();
  }
 }finally{globalThis.fetch=oldFetch;GLTFLoader.prototype.loadAsync=oldLoad;}
});
