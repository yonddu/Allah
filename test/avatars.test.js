import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {USER_MODELS} from '../public/user-model-catalog.js';
import {skinUserGeometry,userRigConfig} from '../public/user-skinning.js';
test('Supplied avatars retain embedded textures, stable LOD bounds and normalized prayer-rig weights',async()=>{
 const manifest=JSON.parse(await readFile('public/user-models/manifest.json','utf8'));
 assert.equal(manifest.models.length,10);
 for(const model of USER_MODELS){
  let config,fullBounds;
  for(const [lod,limit]of [['full',13000],['near',7000],['far',7000]]){
   const bytes=await readFile('public/user-models/'+model.id+'-'+lod+'.glb');
   assert.equal(bytes.readUInt32LE(0),0x46546c67);const length=bytes.readUInt32LE(12),j=JSON.parse(bytes.subarray(20,20+length).toString()),bin=bytes.subarray(28+length);
   const primitives=j.meshes.flatMap(m=>m.primitives);assert.equal(primitives.length,1);
   const primitive=primitives[0],position=j.accessors[primitive.attributes.POSITION],view=j.bufferViews[position.bufferView];
   assert.ok(j.accessors[primitive.indices].count/3<=limit);assert.equal(position.type,'VEC3');assert.equal(position.componentType,5126);
   assert.ok(Math.abs(position.min[1])<.001&&Math.abs(position.max[1]-1.8)<.001);
   const bounds=[...position.min,...position.max];if(fullBounds)bounds.forEach((v,i)=>assert.ok(Math.abs(v-fullBounds[i])<.005,model.id+' '+lod+' silhouette'));else fullBounds=bounds;
   for(const image of j.images){assert.equal(image.uri,undefined);assert.ok(Number.isInteger(image.bufferView));}
   const array=new Float32Array(position.count*3),stride=view.byteStride||12,offset=(view.byteOffset||0)+(position.byteOffset||0);
   for(let i=0;i<position.count;i++)for(let k=0;k<3;k++)array[i*3+k]=bin.readFloatLE(offset+i*stride+k*4);
   const geometry=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(array,3));config||=userRigConfig(geometry);skinUserGeometry(geometry,config);
   const weights=geometry.getAttribute('skinWeight').array,joints=geometry.getAttribute('skinIndex').array;
   for(let i=0;i<position.count;i++){let sum=0;for(let k=0;k<4;k++){const w=weights[i*4+k];assert.ok(Number.isFinite(w)&&w>=0&&w<=1);assert.ok(joints[i*4+k]<18);sum+=w;}assert.ok(Math.abs(sum-1)<1e-5);}
   geometry.dispose();
  }
 }
});
