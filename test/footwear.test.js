import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from '../public/vendor/GLTFLoader.js';
import {makeHumanAvatar} from '../public/avatars.js';
import {USER_MODELS} from '../public/user-model-catalog.js';
import {SOCK_TOP,SOCK_HALF_WIDTH,sockColorFor,thumbnailName} from '../public/footwear.js';
import {inspectGLB,renderThumbnail} from '../scripts/prepare-user-models.mjs';
import {createCanvas,loadImage} from '@napi-rs/canvas';

test('Female feet are covered immediately, in T pose, in all actions and at both visitor detail levels',async()=>{
 const oldFetch=globalThis.fetch,oldLoad=GLTFLoader.prototype.loadAsync;
 const runtime=JSON.parse(await readFile('public/user-models/runtime.json','utf8'));
 try{
  globalThis.fetch=async()=>Response.json(runtime);
  GLTFLoader.prototype.loadAsync=async url=>{
   const raw=inspectGLB(new Uint8Array(await readFile('public/user-models/'+url.split('/').at(-1))));
   const g=new THREE.BufferGeometry().setAttribute('position',new THREE.BufferAttribute(raw.positions,3)).setAttribute('normal',new THREE.BufferAttribute(raw.normals,3)).setIndex(new THREE.BufferAttribute(raw.indices,1));
   return {scene:new THREE.Mesh(g,new THREE.MeshStandardMaterial())};
  };
  for(const model of USER_MODELS)for(const local of [true,false]){
   const a=makeHumanAvatar(model,'low',local);await a.human.ready;let time=0;
   const check=label=>{
    const female=model.gender==='female';assert.equal(a.human.socks.enabled,female,label+' policy');
    if(!female){assert.equal(a.human.socks.mesh,null);return;}
    assert.equal(a.human.socks.mesh.visible,true,label+' shell');assert.equal(a.human.socks.asset.material.transparent,false);
    let source;a.root.traverse(n=>{if(n.userData.userModel)source=n;});
    for(const material of [source.material].flat()){
     const shader={uniforms:{},vertexShader:'#include <common>\n#include <begin_vertex>',fragmentShader:'#include <common>\n#include <map_fragment>'};material.onBeforeCompile(shader);
     assert.equal(shader.uniforms.noorSocks.value,1,label+' original feet stay covered at this LOD');
    }
   };
   check(model.id+' creation');
   for(const bone of a.human.bones)bone.quaternion.identity();check(model.id+' T pose');
   for(const detail of [true,false]){
    a.human.setDetail(detail);
    for(const [name,pose,praying,moving,greeting]of [
     ['idle','standing',false,false,-1],['walking','standing',false,true,-1],['greeting','standing',false,false,.4],
     ...['standing','bowing','rising','sitting','qaadah','prostrating'].map(p=>[p,p,true,false,-1]),
     ['after prayer','standing',false,false,-1]
    ]){for(let f=0;f<150;f++)a.human.update(pose,praying,time+=1/60,moving,1/60,greeting);check(model.id+' '+name+' '+detail);}
   }
   a.human.dispose();
  }
 }finally{globalThis.fetch=oldFetch;GLTFLoader.prototype.loadAsync=oldLoad;}
});

test('Female selection PNGs use covered URLs and render opaque sock color across front and rear foot pixels',async()=>{
 const manifest=JSON.parse(await readFile('public/user-models/manifest.json','utf8'));
 for(const model of USER_MODELS.filter(m=>m.gender==='female')){
  const entry=manifest.models.find(m=>m.id===model.id);assert.equal(entry.thumbnail,thumbnailName(model));assert.equal(entry.footwear,'opaque socks');
  assert.deepEqual(await readFile('public/user-models/'+thumbnailName(model)),await readFile('public/user-models/'+model.id+'.png'),'Legacy image URLs must be covered too');
  const raw=inspectGLB(new Uint8Array(await readFile('public/user-models/'+model.id+'-full.glb'))),p=raw.positions,min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(let i=0;i<p.length;i++){min[i%3]=Math.min(min[i%3],p[i]);max[i%3]=Math.max(max[i%3],p[i]);}
  const size=640,scale=size*.86/Math.max(max[0]-min[0],max[1]-min[1]),cx=(min[0]+max[0])/2,cy=(min[1]+max[1])/2;
  const rgb=[1,3,5].map(i=>parseInt(sockColorFor(model.id).slice(i,i+2),16));
  for(const back of [false,true]){
   const png=await renderThumbnail(raw,{size,back,footwear:sockColorFor(model.id)}),image=await loadImage(png),canvas=createCanvas(size,size),ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);const data=ctx.getImageData(0,0,size,size).data;let pixels=0;
   for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const restY=cy+(size/2-y-.5)/scale,restX=cx+(x+.5-size/2)/scale*(back?1:-1),i=(y*size+x)*4;
    if(restY>=SOCK_TOP-.002||Math.abs(restX)>=SOCK_HALF_WIDTH-.002||!data[i+3])continue;
    assert.equal(data[i+3],255);for(let c=0;c<3;c++)assert.ok(data[i+c]>=rgb[c]*.82&&data[i+c]<=rgb[c]+1,model.id+' raw skin color in foot image');pixels++;
   }
   assert.ok(pixels>30,model.id+' actual foot pixels must be tested');
  }
 }
});
