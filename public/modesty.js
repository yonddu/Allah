import * as THREE from 'three';
import {mergeGeometries} from './utils/BufferGeometryUtils.js';
const FALLBACK=['#e6e2d8','#e9e5dd','#262b30','#56483b','#3d5175','#b8d1d8','#3e4653','#202226','#c5bdae','#687b56'];
function clothColor(source,id){
 const fallback=new THREE.Color(FALLBACK[Number(id.slice(-2))-1]||'#464d48'),image=[source.material].flat()[0]?.map?.image;
 if(typeof document==='undefined'||!image||Number(id.slice(-2))>=3&&Number(id.slice(-2))<=7)return fallback;
 try{
  const p=source.geometry.attributes.position,uv=source.geometry.attributes.uv,samples=[];
  if(!uv)return fallback;let front=Infinity;
  for(let i=0;i<p.count;i++)if(p.getY(i)>.98&&p.getY(i)<1.18&&Math.abs(p.getX(i))<.28)front=Math.min(front,p.getZ(i));
  const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const c=canvas.getContext('2d',{willReadFrequently:true});c.drawImage(image,0,0);const data=c.getImageData(0,0,canvas.width,canvas.height).data;
  for(let i=0;i<p.count;i++)if(p.getY(i)>.99&&p.getY(i)<1.16&&Math.abs(p.getX(i))>.05&&Math.abs(p.getX(i))<.25&&p.getZ(i)<front+.025){
   const x=Math.max(0,Math.min(canvas.width-1,Math.round(uv.getX(i)*(canvas.width-1)))),y=Math.max(0,Math.min(canvas.height-1,Math.round(uv.getY(i)*(canvas.height-1)))),offset=(y*canvas.width+x)*4;
   samples.push([data[offset],data[offset+1],data[offset+2]]);
  }
  if(samples.length<4)return fallback;
  const rgb=[0,1,2].map(k=>samples.map(x=>x[k]).sort((a,b)=>a-b)[Math.floor(samples.length/2)]/255);
  return new THREE.Color().setRGB(...rgb,THREE.SRGBColorSpace);
 }catch{return fallback;}
}
export function modestyAsset(source,id){
 if(source.userData.modesty)return source.userData.modesty;
 const parts=[],solids=[];
 const add=(bone,center,radii)=>{
  const g=new THREE.SphereGeometry(1,12,8);g.scale(...radii);g.translate(...center);
  const count=g.attributes.position.count,joints=new Uint16Array(count*4),weights=new Float32Array(count*4);
  for(let i=0;i<count;i++){joints[i*4]=bone;weights[i*4]=1;}
  g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(joints,4));g.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));parts.push(g);solids.push({bone,center,radii});
 };
 // Every piece is closed and overlaps its neighbour, including the crotch and waist.
 add(1,[0,.94,0],[.20,.19,.145]);add(2,[0,1.10,0],[.18,.13,.12]);
 for(const [side,upper,lower]of [[-1,12,13],[1,15,16]]){add(upper,[side*.10,.70,0],[.13,.245,.14]);add(lower,[side*.10,.285,0],[.105,.23,.12]);}
 const geometry=mergeGeometries(parts,false);parts.forEach(g=>g.dispose());geometry.userData.shared=true;
 const color=clothColor(source,id),material=new THREE.MeshStandardMaterial({color,roughness:1,metalness:0,side:THREE.DoubleSide});
 source.userData.modesty={geometry,material,color,solids};return source.userData.modesty;
}
export function coveredMaterial(base,active,color){
 if(Array.isArray(base))return base.map(m=>coveredMaterial(m,active,color));
 const material=base.clone();material.userData.noorBodyCoverage=true;
 material.onBeforeCompile=shader=>{
  shader.uniforms.noorCovered=active;shader.uniforms.noorCloth={value:color};
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 vNoorRestBody;').replace('#include <begin_vertex>','#include <begin_vertex>\nvNoorRestBody=vec2(position.x,position.y);');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 vNoorRestBody;uniform float noorCovered;uniform vec3 noorCloth;').replace('#include <map_fragment>','#include <map_fragment>\nif(noorCovered>.5 && vNoorRestBody.y>.52 && vNoorRestBody.y<1.23 && abs(vNoorRestBody.x)<.46 && diffuseColor.r>diffuseColor.g*1.04 && diffuseColor.g>diffuseColor.b*.98 && diffuseColor.r-diffuseColor.b>.008){diffuseColor.rgb=noorCloth;diffuseColor.a=1.;}');
 };
 material.customProgramCacheKey=()=> 'noor-modest-cloth-v1';return material;
}
