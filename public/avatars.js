import * as THREE from 'three';
import {CHARACTERS,WARDROBE} from './avatar-catalog.js';
const cache=new Map(),materialCache=new Map();
const v=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const I={root:0,hips:1,spine:2,chest:3,neck:4,head:5,la:6,le:7,lh:8,ra:9,re:10,rh:11,ll:12,lk:13,lf:14,rl:15,rk:16,rf:17};
function materials(tier){
 const key=tier==='low'?'low':'high';if(materialCache.has(key))return materialCache.get(key);
 const loader=new THREE.TextureLoader(),face=loader.load('/reference-assets/faces-'+key+'.webp'),cloth=loader.load('/reference-assets/clothes-'+key+'.webp');
 for(const tex of [face,cloth]){tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=2;}
 const result={skin:new THREE.MeshStandardMaterial({map:face,roughness:.78}),cloth:new THREE.MeshStandardMaterial({map:cloth,roughness:.90,side:THREE.DoubleSide})};materialCache.set(key,result);return result;
}
class Builder{
 constructor(){this.positions=[];this.uv=[];this.joints=[];this.weights=[];this.indices=[];}
 vertex(p,uv,weights){const n=this.positions.length/3;this.positions.push(...p);this.uv.push(...uv);this.joints.push(...weights.map(a=>a[0]),...Array(4-weights.length).fill(0));this.weights.push(...weights.map(a=>a[1]),...Array(4-weights.length).fill(0));return n;}
 surface(rows,columns,point,uv,weights,accept=()=>true){
  const base=this.positions.length/3;
  for(let j=0;j<=rows;j++)for(let i=0;i<=columns;i++){const p=point(i/columns,j/rows);this.vertex(p,uv(p,i/columns,j/rows),weights(p));}
  for(let j=0;j<rows;j++)for(let i=0;i<columns;i++){
   const a=base+j*(columns+1)+i,b=a+1,c=a+columns+1,d=c+1;
   const p=point((i+.5)/columns,(j+.5)/rows);if(accept(p))this.indices.push(a,c,b,b,c,d);
  }
 }
 geometry(){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(this.positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(this.uv,2));g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(this.joints,4));g.setAttribute('skinWeight',new THREE.Float32BufferAttribute(this.weights,4));g.setIndex(this.indices);g.computeVertexNormals();g.computeBoundingSphere();g.userData.shared=true;return g;}
}
function build(profile,low){
 const face=CHARACTERS.find(c=>c.id===profile.character)||CHARACTERS[0],look=WARDROBE.find(c=>c.id===profile.wardrobe)||WARDROBE[0];
 const key=face.id+look.id+(low?'low':'high');if(cache.has(key))return cache.get(key);
 const skin=new Builder(),cloth=new Builder(),segments=low?8:16;
 const skinUV=[((face.index%4)*256+64)/1024,1-(Math.floor(face.index/4)*256+248)/512];
 const hairUV=[((face.index%4)*256+192)/1024,skinUV[1]],constant=()=>skinUV;
 const clothUV=p=>{let u=THREE.MathUtils.clamp(.5-p[0]/1.18,.025,.975),w=THREE.MathUtils.clamp((1.85-p[1])/1.80,.02,.98);if(p[2]>.03)u=.26+(u-.5)*.22;return [(look.index%5+u)/5,1-(Math.floor(look.index/5)+w)/3];};
 const sleeveUV=p=>{
  const x=Math.abs(p[0]),u=THREE.MathUtils.clamp(.5-Math.sign(p[0])*(.18+(x-.19)/.49*.26),.065,.935),w=THREE.MathUtils.clamp(.16-(p[1]-1.435)*.45,.12,.20);
  return [(look.index%5+u)/5,1-(Math.floor(look.index/5)+w)/3];
 };
 const bone=id=>()=>[[id,1]],body=p=>{
  const y=p[1];if(y>1.32)return [[I.chest,1]];if(y>1.12){const t=(y-1.12)/.2;return [[I.spine,1-t],[I.chest,t]];}if(y>.94){const t=(y-.94)/.18;return [[I.hips,1-t],[I.spine,t]];}return [[I.hips,1]];
 };
 const legWeights=side=>p=>{const y=p[1],thigh=side<0?I.ll:I.rl,knee=side<0?I.lk:I.rk;if(y>.56)return [[thigh,1]];if(y>.43){const t=(.56-y)/.13;return [[thigh,1-t],[knee,t]];}return [[knee,1]];};
 const skirt=p=>{if(p[1]>.90)return body(p);const leg=legWeights(p[0]<0?-1:1)(p),t=THREE.MathUtils.clamp((.96-p[1])/.58,0,.9);return [[I.hips,1-t],...leg.map(([id,w])=>[id,w*t])];};
 function ellipsoid(b,c,r,uv,weights,accept=()=>true,detail=segments){
  b.surface(low?6:12,detail,(u,w)=>{const t=w*Math.PI,a=u*Math.PI*2;return [c[0]+Math.sin(t)*Math.sin(a)*r[0],c[1]+Math.cos(t)*r[1],c[2]+Math.sin(t)*Math.cos(a)*r[2]];},uv,weights,accept);
 }
 function sweep(b,rows,uv,weights,s=segments){
  b.surface(rows.length-1,s,(u,w)=>{const n=w*(rows.length-1),a=Math.min(rows.length-2,Math.floor(n)),t=n-a,r=rows[a].map((v,k)=>THREE.MathUtils.lerp(v,rows[a+1][k],t));return [Math.sin(u*Math.PI*2)*r[1],r[0],Math.cos(u*Math.PI*2)*r[2]];},uv,weights);
 }
 function tube(b,a,end,r1,r2,uv,weights,s=segments,steps=3){
  const start=v(...a),axis=v(...end).sub(start),unit=axis.clone().normalize(),normal=v(0,0,1),cross=new THREE.Vector3().crossVectors(normal,unit).normalize();
  b.surface(steps,s,(u,w)=>{const radius=THREE.MathUtils.lerp(r1,r2,w),p=start.clone().addScaledVector(axis,w).addScaledVector(normal,Math.cos(u*Math.PI*2)*radius).addScaledVector(cross,Math.sin(u*Math.PI*2)*radius);return p.toArray();},uv,weights);
 }
 // The front texture is projected onto an anatomical volume with actual nose and cheek relief.
 skin.surface(low?10:20,low?16:32,(u,w)=>{
  const a=u*Math.PI*2,t=w*Math.PI,x=Math.sin(t)*Math.sin(a)*.096,y=Math.cos(t)*.136,z=Math.sin(t)*Math.cos(a)*.092;
  const front=z<0?Math.min(1,-z/.07):0,nose=Math.exp(-x*x/.00012-(y+.005)**2/.00040)*.029;
  return [x,1.67+y,z-front*nose];
 },p=>{
  const [x,y,z]=p;if(z>=-.005)return y>1.715?hairUV:skinUV;
  return [(face.index%4+THREE.MathUtils.clamp(.5-x/.205,.01,.99))/4,1-(Math.floor(face.index/4)*256+THREE.MathUtils.clamp((1.808-y)/.277,0,1)*239)/512];
 },bone(I.head));
 tube(skin,[0,1.46,0],[0,1.56,0],.055,.045,constant,bone(I.neck));
 for(const side of [-1,1]){
  const arm=side<0?I.la:I.ra,elbow=side<0?I.le:I.re,hand=side<0?I.lh:I.rh,foot=side<0?I.lf:I.rf;
  const armWeights=p=>{const x=Math.abs(p[0]);if(x<.42)return [[arm,1]];if(x<.49){const t=(x-.42)/.07;return [[arm,1-t],[elbow,t]];}return [[elbow,1]];};
  ellipsoid(skin,[side*.097,1.663,0],[.015,.027,.012],constant,bone(I.head),()=>true,low?6:10);
  tube(cloth,[side*.19,1.435,0],[side*.45,1.435,0],profile.gender==='female'?.078:.083,.069,sleeveUV,armWeights);
  tube(cloth,[side*.45,1.435,0],[side*(look.cut==='batik'?.50:.68),1.435,0],.068,.047,sleeveUV,armWeights);
  if(look.cut==='batik')tube(skin,[side*.48,1.435,0],[side*.70,1.435,0],.052,.034,constant,armWeights);
  ellipsoid(skin,[side*.723,1.435,0],[.050,.044,.024],constant,bone(hand),()=>true,low?6:10);
  for(let f=0;f<4;f++){
   const y=1.465-f*.020,len=[.064,.082,.076,.057][f];
   tube(skin,[side*.753,y,0],[side*(.753+len),y+(1.5-f)*.006,-.003],.009,.006,constant,bone(hand),low?4:6,1);
  }
  tube(skin,[side*.71,1.404,0],[side*.764,1.365,-.008],.013,.008,constant,bone(hand),low?4:7,2);
  ellipsoid(skin,[side*.105,.049,-.064],[.052,.049,.115],constant,bone(foot),()=>true,low?8:14);
  // Trousers remain under tunics and long robes, avoiding open or exposed undersides.
  const a=side*.10,rows=[[.94,.105,.105],[.77,look.cut==='shalwar'?.13:.095,.105],[.50,.081,.085],[.30,.074,.073],[.10,.061,.060]];
  const before=cloth.positions.length;
  sweep(cloth,rows,clothUV,legWeights(side),low?7:12);
  for(let n=before;n<cloth.positions.length;n+=3)cloth.positions[n]+=a;
 }
 const long=['thobe','sarong','djellaba','abaya','sage','coat'].includes(look.cut),hem=long?.09:look.cut==='batik'?.91:.47;
 const female=profile.gender==='female',bottom=female?.31:look.cut==='djellaba'?.28:.235;
 sweep(cloth,[[1.49,.17,.095],[1.42,.219,.12],[1.26,female?.18:.188,.117],[1.04,.178,.115],[.92,.196,.129],[hem,(long?bottom:.22),long?.17:.14]],clothUV,p=>p[1]>.94?body(p):skirt(p));
 // Caps, headscarves and a modest shoulder drape belong to the outfit, not a removable toggle.
 if(look.cover==='hijab'||look.cover==='ghutra'){
  const hijab=look.cover==='hijab',rx=hijab?.116:.13,ry=hijab?.155:.17;
  ellipsoid(cloth,[0,1.68,.006],[rx,ry,.111],clothUV,bone(I.head),p=>!(p[2]<-.038&&Math.abs(p[0])<.086&&p[1]>1.565&&p[1]<(hijab?1.715:1.78)),low?16:28);
  sweep(cloth,[[1.585,.075,.076],[1.49,.115,.10],[1.34,hijab?.19:.16,.13],[1.22,hijab?.225:.18,.145]],clothUV,p=>p[1]>1.51?[[I.head,1]]:body(p),low?12:24);
 }else if(look.cover!=='hood'){
  const songkok=look.cover==='songkok',pakol=look.cover==='pakol';
  sweep(cloth,[[1.77,.098,.088],[songkok?1.89:1.845,pakol?.115:.094,pakol?.105:.085],[songkok?1.892:1.847,.001,.001]],clothUV,bone(I.head),low?12:24);
  if(pakol)sweep(cloth,[[1.77,.103,.095],[1.79,.125,.115],[1.81,.117,.106]],clothUV,bone(I.head),low?12:24);
 }
 const result={skin:skin.geometry(),cloth:cloth.geometry()};cache.set(key,result);return result;
}
function rig(){
 const bones=[],add=(name,parent,pos)=>{const b=new THREE.Bone();b.name=name;b.position.set(...pos);if(parent!==null)bones[parent].add(b);bones.push(b);};
 add('root',null,[0,0,0]);add('hips',0,[0,.92,0]);add('spine',1,[0,.20,0]);add('chest',2,[0,.27,0]);add('neck',3,[0,.13,0]);add('head',4,[0,.15,0]);
 for(const side of [-1,1]){const start=bones.length;add(side<0?'leftShoulder':'rightShoulder',3,[side*.205,.045,0]);add('elbow',start,[side*.245,0,0]);add('wrist',start+1,[side*.23,0,0]);}
 for(const side of [-1,1]){const start=bones.length;add(side<0?'leftHip':'rightHip',1,[side*.10,-.01,0]);add('knee',start,[0,-.42,0]);add('ankle',start+1,[0,-.41,0]);}
 return bones;
}
const qa=new THREE.Quaternion();
function rotateToward(bone,rest,direction){const parent=bone.parent.getWorldQuaternion(qa).invert(),local=direction.clone().applyQuaternion(parent).normalize();bone.quaternion.setFromUnitVectors(rest,local);bone.updateWorldMatrix(false,true);}
function armIK(bones,side,target,hint){
 const shoulder=bones[side<0?I.la:I.ra],elbow=bones[side<0?I.le:I.re],a=shoulder.getWorldPosition(v()),dir=target.clone().sub(a),distance=THREE.MathUtils.clamp(dir.length(),.025,.474);dir.normalize();
 const along=(.245**2-.23**2+distance**2)/(2*distance),height=Math.sqrt(Math.max(0,.245**2-along**2));
 const bend=hint.clone().sub(a);bend.addScaledVector(dir,-bend.dot(dir));if(bend.lengthSq()<.0001)bend.set(side,-1,0);bend.normalize();
 const knee=a.clone().addScaledVector(dir,along).addScaledVector(bend,height),rest=v(side,0,0);
 rotateToward(shoulder,rest,knee.clone().sub(a));rotateToward(elbow,rest,target.clone().sub(knee));
}
export function makeHumanAvatar(profile,tier='low'){
 const root=new THREE.Group(),hips=new THREE.Group(),simple=new THREE.Group(),bones=rig();root.add(hips,simple);hips.add(bones[0]);root.updateMatrixWorld(true);
 const skeleton=new THREE.Skeleton(bones),m=materials(tier),full=build(profile,false),low=build(profile,true),meshes=[];
 for(const type of ['skin','cloth']){const mesh=new THREE.SkinnedMesh(full[type],m[type]);mesh.bind(skeleton);mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;hips.add(mesh);meshes.push(mesh);}
 let detail=true;
 const human={
  skeleton,bones,setQuality(tier){const m=materials(tier);meshes[0].material=m.skin;meshes[1].material=m.cloth;},setDetail(value){if(value===detail)return;detail=value;meshes[0].geometry=(value?full:low).skin;meshes[1].geometry=(value?full:low).cloth;},
  update(pose,praying,time,moving,dt){
   const kneeling=pose==='sitting'||pose==='prostrating',prostrating=pose==='prostrating',bowing=pose==='bowing',s=1-Math.exp(-dt*10),hip=prostrating?.54:kneeling?.39:.92;
   bones[I.hips].position.y=THREE.MathUtils.lerp(bones[I.hips].position.y,hip+(moving?Math.sin(time*10)*.016:0),s);
   bones[I.spine].position.y=THREE.MathUtils.lerp(bones[I.spine].position.y,prostrating?.045:.20,s);
   bones[I.spine].rotation.x=THREE.MathUtils.lerp(bones[I.spine].rotation.x,prostrating?-2.45:bowing?-1.04:0,s);
   for(const side of [-1,1]){
    const leg=bones[side<0?I.ll:I.rl],knee=bones[side<0?I.lk:I.rk];
    leg.rotation.x=THREE.MathUtils.lerp(leg.rotation.x,kneeling?(prostrating?.85:1.0):moving?Math.sin(time*8+side)*.30:0,s);
    knee.rotation.x=THREE.MathUtils.lerp(knee.rotation.x,kneeling?(prostrating?-1.9:-2.2):moving?Math.max(0,-Math.sin(time*8+side))*.30:0,s);
   }
   root.updateMatrixWorld(true);
   for(const side of [-1,1]){
    let target,hint;
    if(prostrating){target=v(side*.22,.075,-.65).applyMatrix4(root.matrixWorld);hint=v(side*.40,.26,-.40).applyMatrix4(root.matrixWorld);}
    else if(bowing){target=v(side*.115,.53,-.10).applyMatrix4(root.matrixWorld);hint=v(side*.31,.80,-.20).applyMatrix4(root.matrixWorld);}
    else if(kneeling){target=v(side*.13,.43,-.34).applyMatrix4(root.matrixWorld);hint=v(side*.32,.64,-.12).applyMatrix4(root.matrixWorld);}
    else if(praying){target=v(side*-.025,-.22,-.20).applyMatrix4(bones[I.chest].matrixWorld);hint=v(side*.32,-.30,-.06).applyMatrix4(bones[I.chest].matrixWorld);}
    else{target=v(side*.24,-.41,moving?Math.sin(time*8+side)*.10:0).applyMatrix4(bones[I.chest].matrixWorld);hint=v(side*.29,-.22,-.04).applyMatrix4(bones[I.chest].matrixWorld);}
    armIK(bones,side,target,hint);const hand=bones[side<0?I.lh:I.rh];hand.rotation.x=prostrating?Math.PI/2:0;
   }
  }
 };
 human.update('standing',false,0,false,1);
 return {root,hips,simple,human,head:bones[I.head],torso:bones[I.spine],arms:[bones[I.la],bones[I.ra]],legs:[bones[I.ll],bones[I.rl]],materials:[]};
}
export {build as buildAvatarGeometry};
