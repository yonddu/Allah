import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {GLTFLoader} from '../public/vendor/GLTFLoader.js';
import {makeHumanAvatar} from '../public/avatars.js';

test('Greeting uses right hand on chest and slight nod; walking relaxes palms and curls fingers without changing prayer poses',async()=>{
 const originalFetch=globalThis.fetch,originalLoad=GLTFLoader.prototype.loadAsync;
 const c={armY:1.45,shoulder:.207,upper:.303,lower:.280};
 try{
  globalThis.fetch=async()=>Response.json({model01:{full:'gesture-test',near:'gesture-test',far:'gesture-test',rig:c}});
  GLTFLoader.prototype.loadAsync=async()=>({scene:new THREE.Mesh(new THREE.BoxGeometry(1,1.8,.25).translate(0,.9,0),new THREE.MeshStandardMaterial())});
  const a=makeHumanAvatar({model:'model01',gender:'male'},'low',true);await a.human.ready;
  assert.equal(a.human.bones.length,22);
  for(let n=0;n<20;n++)a.human.update('prostrating',false,n/30,true,1/30);
  assert.equal(a.human.bones[2].rotation.x,0,'Prayer poses cannot be used while walking');
  assert.ok(a.human.bones[20].rotation.y>.6);
  assert.ok(a.human.bones[18].rotation.y<-.6,'Fingers curl toward the palm, never backward');
  for(const yaw of [0,Math.PI/2,-Math.PI/3]){
   a.root.rotation.y=yaw;
   for(let n=0;n<90;n++)a.human.update('standing',false,n/30,true,1/30);
   for(const [id,side]of [[8,-1],[11,1]]){
    const normal=new THREE.Vector3(0,0,-1).applyQuaternion(a.human.bones[id].getWorldQuaternion(new THREE.Quaternion()));
    const inward=new THREE.Vector3(-side,0,0).applyQuaternion(a.root.getWorldQuaternion(new THREE.Quaternion()));
    assert.ok(normal.dot(inward)>.94,'Palm must face its thigh at every avatar yaw');
   }
  }
  a.root.rotation.y=0;
  for(let n=0;n<20;n++)a.human.update('standing',false,1+n/30,false,1/30,.5);
  const chest=a.human.bones[3].getWorldPosition(new THREE.Vector3()),hand=a.human.bones[11].getWorldPosition(new THREE.Vector3());
  assert.ok(hand.distanceTo(chest)<.28,'Right hand must rest on chest');
  assert.ok(a.human.bones[5].rotation.x<-.1&&a.human.bones[5].rotation.x>-.2);
  assert.equal(a.human.bones[2].rotation.x,0,'Greeting must not become a prayer bow');
  for(let n=0;n<20;n++)a.human.update('prostrating',true,2+n/30,false,1/30);
  a.root.updateMatrixWorld(true);
  const facing=new THREE.Vector3(0,0,-1).applyQuaternion(a.human.bones[5].getWorldQuaternion(new THREE.Quaternion()));
  assert.ok(facing.y<-.99,'Face points at the floor rather than at the knees');
  assert.ok(Math.abs(a.human.bones[20].rotation.y)<.01,'Prayer hands stay open');
  a.human.dispose();
 }finally{globalThis.fetch=originalFetch;GLTFLoader.prototype.loadAsync=originalLoad;}
});
