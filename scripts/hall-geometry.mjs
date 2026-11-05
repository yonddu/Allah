import * as T from 'three';
import {mergeGeometries,mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';

// Large outdoor courtyards, authored once and merged by material for mobile rendering.
export function buildArchitecture(theme='mecca',tier='low'){
 const high=tier==='high',segments=high?24:12,parts=new Map();
 const materials={
  marble:{name:'Courtyard ivory marble',color:[.94,.94,.91,1],map:'marble',roughness:.42},
  plaster:{name:'Carved white stone',color:[.95,.93,.87,1],map:'plaster',roughness:.76},
  inlay:{name:'Dark marble borders',color:[.20,.27,.25,1],roughness:.5},
  gold:{name:'Brushed gold ornament',color:[.72,.52,.21,1],roughness:.36,metallic:.82},
  shadow:{name:'Recessed arch shadows',color:[.12,.19,.19,1],roughness:.9},
  cloth:{name:'Kaaba woven black kiswa',color:[1,1,1,1],map:'kaaba-cloth',roughness:.94},
  brocade:{name:'Gold geometric brocade (no invented sacred text)',color:[1,1,1,1],map:'kaaba-band',roughness:.52,metallic:.3},
  city:{name:'Distant Makkah skyline',color:[.61,.59,.52,1],map:'city',roughness:.83},
  lawn:{name:'Garden lawn',color:[1,1,1,1],map:'grass',roughness:1},
  trees:{name:'Garden cypress foliage',color:[.14,.29,.16,1],roughness:1},
  water:{name:'Reflecting pool',color:[.24,.60,.63,1],roughness:.14,metallic:.42},
  sandstone:{name:'Warm red sandstone',color:[.60,.28,.19,1],map:'plaster',roughness:.9}
 };
 const matrix=new T.Matrix4(),q=new T.Quaternion(),e=new T.Euler();
 function emit(geometry,mat,p=[0,0,0],scale=[1,1,1],r=[0,0,0],repeat=[1,1]){
  const g=geometry.index?geometry.toNonIndexed():geometry;if(g!==geometry)geometry.dispose();q.setFromEuler(e.set(...r));matrix.compose(new T.Vector3(...p),q,new T.Vector3(...scale));g.applyMatrix4(matrix);
  const uv=g.getAttribute('uv');for(let n=0;n<uv.count;n++)uv.setXY(n,uv.getX(n)*repeat[0],uv.getY(n)*repeat[1]);
  if(!parts.has(mat))parts.set(mat,[]);parts.get(mat).push(g);
 }
 const box=(m,p,s,r=[0,0,0],repeat=[1,1])=>emit(new T.BoxGeometry(1,1,1),m,p,s,r,repeat);
 const cyl=(m,p,top,bottom,height,s=segments)=>emit(new T.CylinderGeometry(top,bottom,height,s,1,false),m,p);
 const plane=(m,p,w,h,r=[-Math.PI/2,0,0],repeat=[1,1])=>emit(new T.PlaneGeometry(w,h),m,p,[1,1,1],r,repeat);
 function archShape(w,h){const s=new T.Shape();s.moveTo(-w/2,0);s.lineTo(-w/2,h*.52);s.bezierCurveTo(-w/2,h*.82,-w*.20,h*.92,0,h);s.bezierCurveTo(w*.20,h*.92,w/2,h*.82,w/2,h*.52);s.lineTo(w/2,0);s.closePath();return s;}
 function arch(m,p,w,h,border=.35,depth=.35,r=[0,0,0]){const s=archShape(w,h),inner=archShape(w-2*border,h-border);s.holes.push(new T.Path(inner.getPoints(high?14:8)));emit(new T.ExtrudeGeometry(s,{depth,bevelEnabled:false,curveSegments:high?10:6}),m,p,[1,1,1],r);}
 function recess(p,w,h,r=[0,0,0]){emit(new T.ShapeGeometry(archShape(w,h),high?10:6),'shadow',p,[1,1,1],r);arch('plaster',p,w+1,h+.7,.35,.35,r);}
 function column(x,z,h=10){cyl('marble',[x,.25,z],.82,.95,.5);cyl('plaster',[x,h/2,z],.40,.50,h);cyl('marble',[x,h-.3,z],.75,.42,.5);box('plaster',[x,h,z],[1.7,.35,1.7]);}
 function dome(x,y,z,r,height=r*1.3){
  const profile=[[0,0],[.78,.02],[.85,.12],[.98,.34],[1,.52],[.87,.72],[.58,.88],[.20,1.04],[.03,1.18]].map(([xx,yy])=>new T.Vector2(xx*r,yy*height));
  emit(new T.LatheGeometry(profile,high?40:24),'marble',[x,y,z]);cyl('gold',[x,y+height*1.29,z],.04,.10,height*.24,8);cyl('gold',[x,y+height*1.42,z],.16,.16,.14,8);
 }
 function minaret(x,z,h,base=2.4){
  cyl('marble',[x,h*.42,z],base*.65,base,h*.84);
  for(const y of [h*.3,h*.58,h*.84]){cyl('plaster',[x,y,z],base*1.08,base*1.08,.6);cyl('inlay',[x,y+.35,z],base*.93,base*.93,.16);}
  for(let n=0;n<6;n++){const a=n*Math.PI/3;cyl('marble',[x+Math.cos(a)*base*.66,h*.9,z+Math.sin(a)*base*.66],.13,.16,h*.14,8);}
  dome(x,h*.97,z,base*.95,base*1.1);
 }
 // 168 x 188 metre paved court; open sky, all wall/roof geometry stays at its edges.
 box('marble',[0,-.22,0],[168,.44,188],[0,0,0],[42,47]);
 for(const x of [-76,76])box('inlay',[x,.012,0],[.18,.024,174]);
 for(const z of [-86,86])box('inlay',[0,.012,z],[152,.024,.18]);
 if(theme==='mecca'){
  // Two-tier arcade galleries around the perimeter, with no roof above the central court.
  for(const side of [-1,1]){
   box('plaster',[side*83,9,0],[3,18,188]);
   for(const y of [9,18])box('marble',[side*78,y,0],[11,.6,188]);
   for(let z=-84;z<=84;z+=12){column(side*76,z,9);column(side*76,z,18);for(const y of [0,9])arch('plaster',[side*76,y,z+6],10,8,.45,.7,[0,-side*Math.PI/2,0]);}
  }
  for(const side of [-1,1]){
   box('plaster',[0,9,side*93],[168,18,3]);
   for(const y of [9,18])box('marble',[0,y,side*88],[168,.6,11]);
   for(let x=-72;x<=72;x+=12){column(x,side*86,18);for(const y of [0,9])arch('plaster',[x+6,y,side*86],10,8,.45,.7,[0,side<0?0:Math.PI,0]);}
  }
  for(const x of [-72,72])for(const z of [-82,82])minaret(x,z,40,2.2);
  for(let n=0;n<15;n++){const x=(n-7)*17,h=24+((n*17)%23);box('city',[x,h/2,-111],[13,h,15],[0,0,0],[1,4]);}
  // The Kaaba is a physical 3D landmark and a collision obstacle at the court centre.
  box('plaster',[0,.16,-18],[13,.32,14]);box('cloth',[0,6.65,-18],[11.6,13,12.2],[0,0,0],[3,3]);
  box('brocade',[0,10.15,-18],[11.68,.95,12.28],[0,0,0],[4,1]);
  box('gold',[2.3,4,-11.84],[1.75,3.5,.10]);box('brocade',[2.3,4,-11.77],[1.55,3.24,.035]);
  for(const x of [-5.84,5.84])box('gold',[x,6.6,-11.82],[.055,12.7,.035]);
  for(let n=0;n<4;n++){const a=n*Math.PI/2;box('brocade',[Math.sin(a)*5.85,8.4,-18+Math.cos(a)*6.15],[1.3,1.7,.05],[0,a,0]);}
  for(const r of [18,26,40,58])emit(new T.RingGeometry(r,r+.13,high?128:80),'inlay',[0,.022,-18],[1,1,1],[-Math.PI/2,0,0]);
 }else{
  // Taj Mahal-inspired forecourt: monumental marble building, four minarets, gardens and reflecting pool.
  box('plaster',[0,.55,-52],[76,1.1,47]);box('inlay',[0,1.12,-52],[72,.08,44]);
  box('marble',[0,12.2,-52],[46,22,31],[0,0,0],[8,4]);
  const front=-36.32;
  recess([0,1.3,front],13,18);arch('inlay',[0,1.3,front+.4],14.2,19,.2,.10);
  for(const side of [-1,1]){
   for(const x of [side*16])for(const y of [1.4,12.0])recess([x,y,front+.05],7.2,8.2);
   for(const x of [side*23])recess([x,1.4,-50],10,15,[0,side*Math.PI/2,0]);
   box('marble',[side*23,12.4,-52],[1,24,32]);
  }
  for(const x of [-23,-12,12,23])cyl('marble',[x,13,-35.9],.35,.4,25,high?16:8);
  box('plaster',[0,23.5,-52],[48,.75,33]);
  cyl('marble',[0,26.3,-52],9.3,9.3,5);dome(0,28.8,-52,11,12);
  for(const x of [-17,17])for(const z of [-41,-63]){cyl('marble',[x,24.8,z],3.2,3.2,2.4);for(let n=0;n<6;n++){const a=n*Math.PI/3;cyl('marble',[x+Math.cos(a)*2.5,27.5,z+Math.sin(a)*2.5],.17,.2,3.5,8);}dome(x,29,z,3.2,3.4);}
  for(const x of [-35,35])for(const z of [-32,-72])minaret(x,z,36,2.2);
  for(let n=0;n<5;n++)box('marble',[0,.12+n*.1,-26-n*.85],[20,.24+n*.2,1]);
  // Garden paths are broad and level; the pool is excluded from the walking surface.
  plane('water',[0,.025,30],10,70);for(const x of [-5.6,5.6])box('marble',[x,.16,30],[1.1,.32,72]);for(const z of [-5.6,65.6])box('marble',[0,.16,z],[12.2,.32,1.1]);
  for(const side of [-1,1]){
   plane('lawn',[side*29,.025,30],30,71,[-Math.PI/2,0,0],[10,20]);
   for(const z of [12,47])box('marble',[side*29,.05,z],[31,.10,2.4]);
   for(let z=0;z<=70;z+=10)for(const x of [side*13,side*46]){cyl('sandstone',[x,.9,z],.20,.23,1.8,7);for(let k=0;k<3;k++)emit(new T.ConeGeometry(1.15-k*.17,4.2-k*.5,high?12:7),'trees',[x,2.9+k*1.0,z]);}
   box('sandstone',[side*68,5,-53],[20,10,47]);recess([side*68,0,-29.4],9,8);dome(side*68,10,-53,5,4);
  }
  for(let z=2;z<65;z+=9){cyl('water',[0,.75,z],.035,.075,1.45,6);emit(new T.SphereGeometry(.11,6,4),'water',[0,1.5,z]);}
 }
 const batches=[];
 for(const [material,geometries]of parts){const merged=mergeGeometries(geometries,false);if(!merged)throw new Error('Cannot merge '+material);const indexed=mergeVertices(merged,1e-5);indexed.computeBoundingBox();batches.push({material,geometry:indexed});geometries.forEach(g=>g.dispose());merged.dispose();}
 return {materials,batches};
}
