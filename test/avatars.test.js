import test from 'node:test';
import assert from 'node:assert/strict';
import {buildAvatarGeometry} from '../public/avatars.js';
import {sanitizeProfile} from '../public/core.js';
import {WARDROBE} from '../public/avatar-catalog.js';
test('Every reference outfit has bounded 3D meshes and valid normalized skeletal weights in both LODs',()=>{
 for(const look of WARDROBE)for(const low of [false,true]){
  const profile=sanitizeProfile({gender:look.gender,wardrobe:look.id}),meshes=buildAvatarGeometry(profile,low);let triangles=0;
  for(const g of Object.values(meshes)){
   triangles+=g.index.count/3;
   for(const name of ['position','normal','uv','skinWeight'])for(const value of g.getAttribute(name).array)assert.ok(Number.isFinite(value),look.id+': '+name);
   const weights=g.getAttribute('skinWeight'),indices=g.getAttribute('skinIndex');
   for(let n=0;n<weights.count;n++){let sum=0;for(let k=0;k<4;k++){sum+=weights.array[n*4+k];assert.ok(indices.array[n*4+k]<18);}assert.ok(Math.abs(sum-1)<.0001);}
   for(const value of g.getAttribute('uv').array)assert.ok(value>=0&&value<=1);
  }
  assert.ok(triangles<(low?1800:6000),look.id+': '+triangles);
 }
});
