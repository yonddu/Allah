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
   let mesh;a.root.traverse(node=>{if(node.isSkinnedMesh)mesh=node;});
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
   a.human.dispose();
  }
 }finally{globalThis.fetch=oldFetch;GLTFLoader.prototype.loadAsync=oldLoad;}
});
