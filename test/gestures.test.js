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
  assert.ok(a.human.bones[20].rotation.y>.7);
  assert.ok(a.human.bones[18].rotation.y<-.7,'Fingers curl toward the palm, never backward');
  assert.ok(Math.abs(a.human.bones[11].rotation.x)>1);
  for(let n=0;n<20;n++)a.human.update('standing',false,1+n/30,false,1/30,.5);
  const chest=a.human.bones[3].getWorldPosition(new THREE.Vector3()),hand=a.human.bones[11].getWorldPosition(new THREE.Vector3());
  assert.ok(hand.distanceTo(chest)<.28,'Right hand must rest on chest');
  assert.ok(a.human.bones[5].rotation.x<-.1&&a.human.bones[5].rotation.x>-.2);
  assert.equal(a.human.bones[2].rotation.x,0,'Greeting must not become a prayer bow');
  for(let n=0;n<20;n++)a.human.update('prostrating',true,2+n/30,false,1/30);
  assert.ok(a.human.bones[2].rotation.x< -2);
  assert.ok(Math.abs(a.human.bones[20].rotation.y)<.01,'Prayer hands stay open');
  a.human.dispose();
 }finally{globalThis.fetch=originalFetch;GLTFLoader.prototype.loadAsync=originalLoad;}
});
