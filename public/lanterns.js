import * as THREE from 'three';
import {mergeGeometries} from './utils/BufferGeometryUtils.js';
import {LANTERN_LAYOUT,lanternBrightness} from './lantern-layout.js';
export class CourtyardLanterns{
 constructor(world){
  this.world=world;this.group=new THREE.Group();this.group.name='Courtyard night lanterns';world.scene.add(this.group);this.transform=new THREE.Object3D();
  const parts=[];const part=(g,y)=>{g.translate(0,y,0);parts.push(g);};
  part(new THREE.CylinderGeometry(.09,.14,2.7,6),1.35);part(new THREE.CylinderGeometry(.32,.38,.20,6),.1);part(new THREE.ConeGeometry(.43,.34,6),3.64);part(new THREE.CylinderGeometry(.38,.38,.12,6),2.77);
  for(let i=0;i<6;i++){const a=i*Math.PI/3,g=new THREE.CylinderGeometry(.025,.025,.72,4);g.translate(Math.cos(a)*.30,3.16,Math.sin(a)*.30);parts.push(g);}
  const frameGeo=mergeGeometries(parts);parts.forEach(g=>g.dispose());this.frames=new THREE.InstancedMesh(frameGeo,new THREE.MeshStandardMaterial({color:0x796044,metalness:.55,roughness:.48}),12);this.group.add(this.frames);
  this.glass=new THREE.InstancedMesh(new THREE.CylinderGeometry(.29,.29,.67,6).translate(0,3.16,0),new THREE.MeshBasicMaterial({color:0x93794e,toneMapped:false}),12);this.group.add(this.glass);
  const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const ctx=canvas.getContext('2d'),gradient=ctx.createRadialGradient(32,32,0,32,32,32);gradient.addColorStop(0,'rgba(255,207,130,1)');gradient.addColorStop(.25,'rgba(255,194,99,.50)');gradient.addColorStop(1,'rgba(255,177,72,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);const texture=new THREE.CanvasTexture(canvas);
  const glowMaterial=new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false});
  this.halos=new THREE.InstancedMesh(new THREE.PlaneGeometry(1.6,1.6),glowMaterial,12);this.pools=new THREE.InstancedMesh(new THREE.PlaneGeometry(12,12).rotateX(-Math.PI/2),glowMaterial.clone(),12);this.group.add(this.halos,this.pools);
  for(const mesh of [this.frames,this.glass,this.halos,this.pools])mesh.frustumCulled=false;
  // Two shared local lights, never one shadow-casting light per lamp or visitor.
  this.lights=Array.from({length:2},()=>{const light=new THREE.PointLight(0xffcb83,0,15,2);light.castShadow=false;this.group.add(light);return light;});
 }
 update(map,daylight,camera){
  const locations=LANTERN_LAYOUT[map]||LANTERN_LAYOUT.mecca,brightness=this.brightness=lanternBrightness(daylight),t=this.transform;
  if(this.map!==map){this.map=map;for(let i=0;i<locations.length;i++){const p=locations[i];t.position.set(p.x,0,p.z);t.rotation.set(0,0,0);t.scale.set(1,1,1);t.updateMatrix();this.frames.setMatrixAt(i,t.matrix);this.glass.setMatrixAt(i,t.matrix);t.position.y=.035;t.updateMatrix();this.pools.setMatrixAt(i,t.matrix);}for(const m of [this.frames,this.glass,this.pools]){m.count=locations.length;m.instanceMatrix.needsUpdate=true;}}
  this.glass.material.color.setRGB(.30+.70*brightness,.24+.49*brightness,.15+.22*brightness);this.halos.visible=this.pools.visible=brightness>.001;this.halos.material.opacity=brightness*.48;this.pools.material.opacity=brightness*.24;
  if(brightness>.001){for(let i=0;i<locations.length;i++){const p=locations[i];t.position.set(p.x,3.16,p.z);t.quaternion.copy(camera.quaternion);t.updateMatrix();this.halos.setMatrixAt(i,t.matrix);}this.halos.count=locations.length;this.halos.instanceMatrix.needsUpdate=true;}
  const position=this.world.position,near=[...locations].sort((a,b)=>(a.x-position.x)**2+(a.z-position.z)**2-((b.x-position.x)**2+(b.z-position.z)**2));this.lights.forEach((light,i)=>{light.position.set(near[i].x,2.9,near[i].z);light.intensity=brightness*18;});
 }
}
