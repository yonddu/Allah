import * as THREE from 'three';
import {skySchedule,skyState} from './sky-core.js';
import {congregationDay} from './congregation-core.js';
// One low-poly background draw: no ray marching, extra render targets or downloaded sky textures.
export class VenueSky{
 constructor(world){
  this.world=world;this.last=-Infinity;this.now=()=>Date.now();
  this.uniforms={daylight:{value:1},twilight:{value:0},sunDir:{value:new THREE.Vector3()},moonDir:{value:new THREE.Vector3()},drift:{value:0}};
  this.material=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,depthTest:false,uniforms:this.uniforms,vertexShader:`varying vec3 direction;void main(){direction=position;vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position=p.xyww;}`,fragmentShader:`
   varying vec3 direction;uniform float daylight,twilight,drift;uniform vec3 sunDir,moonDir;
   float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
   float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
   void main(){vec3 v=normalize(direction);float h=max(v.y,0.);vec3 horizon=mix(vec3(.025,.045,.09),vec3(.65,.79,.85),daylight);horizon=mix(horizon,vec3(.8,.36,.16),twilight*.55);
    vec3 zenith=mix(vec3(.008,.017,.05),vec3(.13,.43,.72),daylight);vec3 color=mix(horizon,zenith,smoothstep(0.,.8,h));
    float sun=distance(v,sunDir),moon=distance(v,moonDir);color+=vec3(1.,.75,.36)*(1.-smoothstep(.025,.035,sun))*step(0.,v.y);color+=vec3(1.,.5,.14)*exp(-sun*18.)*.35*daylight;
    float disk=1.-smoothstep(.026,.031,moon);color+=vec3(.8,.86,1.)*disk*step(0.,v.y)*(1.-daylight);color+=vec3(.16,.2,.3)*exp(-moon*24.)*(1.-daylight);
    vec2 starUv=vec2(atan(v.z,v.x),asin(clamp(v.y,-1.,1.)))*150.;vec2 cell=floor(starUv);float star=step(.987,hash(cell))*(1.-smoothstep(.02,.13,length(fract(starUv)-vec2(.5))));color+=vec3(star)*pow(1.-daylight,3.)*smoothstep(.02,.25,h);
    vec2 uv=v.xz/max(.15,v.y)*2.3+vec2(drift,.17*drift);float cloud=noise(uv)*.6+noise(uv*2.1)*.28+noise(uv*4.2)*.12;float mask=smoothstep(.51,.76,cloud)*smoothstep(.02,.2,v.y);
    color=mix(color,mix(vec3(.10,.14,.22),vec3(.95,.94,.89),daylight),mask*.85);gl_FragColor=vec4(color,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }`});
  this.mesh=new THREE.Mesh(new THREE.SphereGeometry(200,24,12),this.material);this.mesh.renderOrder=-1000;this.mesh.frustumCulled=false;world.scene.add(this.mesh);world.scene.background=null;
 }
 update(camera,time){
  this.mesh.position.copy(camera.position);const now=this.now(),w=this.world;
  if(time-this.last<.25&&this.schedule?.map===w.mapId)return;this.last=time;
  if(!this.schedule||this.schedule.map!==w.mapId||this.schedule.day!==congregationDay(w.mapId,now))this.schedule=skySchedule(w.mapId,now);
  const state=this.state=skyState(this.schedule,now),u=this.uniforms;u.daylight.value=state.daylight;u.twilight.value=state.twilight;u.sunDir.value.fromArray(state.sun);u.moonDir.value.fromArray(state.moon);u.drift.value=(now%86400000)/1000000;
  const light=state.daylight;w.sun.intensity=.12+light*2.08;w.sun.position.fromArray(state.day?state.sun:state.moon).multiplyScalar(24);w.hemi.intensity=.32+light*.53;w.scene.environmentIntensity=.16+light*.34;
  w.scene.fog.color.setRGB(.025+light*.58,.045+light*.68,.09+light*.67);w.renderer.toneMappingExposure=.85+light*.1;
  if(this.hall!==w.hall){this.hall=w.hall;this.hallMaterials=new Set();w.hall?.traverse(n=>{for(const m of [n.material].flat())if(m?.color){m.userData.skyBase??=m.color.clone();this.hallMaterials.add(m);}});}
  for(const m of this.hallMaterials||[]){m.color.copy(m.userData.skyBase);m.color.multiply(new THREE.Color(.30+.70*light,.37+.63*light,.53+.47*light));}
 }
}
