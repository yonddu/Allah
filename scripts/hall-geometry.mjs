import * as T from 'three';
import {mergeGeometries,mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';

export function buildArchitecture(theme='zayed',tier='low'){
  const high=tier==='high',segments=high?24:12,parts=new Map();
  const materials={
    marble:{name:'Polished ivory marble',color:[.94,.92,.85,1],map:'marble',roughness:.32,metallic:.025},
    plaster:{name:'Carved limestone',color:[.94,.91,.83,1],map:'plaster',roughness:.78},
    gold:{name:'Brushed champagne gold',color:[.67,.46,.19,1],roughness:.3,metallic:.9},
    wall:{name:'Painted vault',color:theme==='blue'?[.48,.65,.74,1]:theme==='nabawi'?[.86,.84,.70,1]:[.94,.92,.83,1],map:'ceiling',roughness:.76,doubleSided:true},
    column:{name:'Floral marble columns',color:[1,1,1,1],map:theme==='zayed'?'column':'marble',roughness:.36},
    carpet:{name:'Woven sanctuary carpet',color:[1,1,1,1],map:theme==='blue'?'red-carpet':'green-carpet',roughness:1},
    ceramic:{name:'Glazed Iznik ceramic',color:[1,1,1,1],map:'tile',roughness:.35},
    niche:{name:'Recess shadow',color:theme==='blue'?[.13,.24,.31,1]:[.12,.25,.20,1],roughness:.95},
    glass:{name:'Daylit patterned windows',color:[.60,.75,.73,1],emissive:[.23,.30,.28],roughness:.55},
    glow:{name:'Warm chandelier lamps',color:[1,.84,.52,1],unlit:true},
    inlay:{name:'Floral floor inlay',color:[1,1,1,1],map:'floor-inlay',roughness:.65,alpha:true},
    ao:{name:'Baked contact shading',color:[1,1,1,1],map:'floor-ao',alpha:true,unlit:true}
  };
  const euler=new T.Euler(),matrix=new T.Matrix4(),quaternion=new T.Quaternion();
  function emit(geometry,material,position=[0,0,0],scale=[1,1,1],rotation=[0,0,0],repeat=[1,1]){
    const g=geometry.index?geometry.toNonIndexed():geometry;
    if(g!==geometry)geometry.dispose();
    euler.set(...rotation);quaternion.setFromEuler(euler);matrix.compose(new T.Vector3(...position),quaternion,new T.Vector3(...scale));g.applyMatrix4(matrix);
    const uv=g.getAttribute('uv');if(uv)for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*repeat[0],uv.getY(i)*repeat[1]);
    if(!parts.has(material))parts.set(material,[]);parts.get(material).push(g);
  }
  const box=(mat,p,s,r=[0,0,0],repeat=[1,1])=>emit(new T.BoxGeometry(1,1,1),mat,p,s,r,repeat);
  const cylinder=(mat,p,top,bottom,height,r=[0,0,0])=>emit(new T.CylinderGeometry(top,bottom,height,segments,1,false),mat,p,[1,1,1],r);
  const ring=(mat,p,radius,tube=.035,rotation=[Math.PI/2,0,0])=>emit(new T.TorusGeometry(radius,tube,5,high?64:32),mat,p,[1,1,1],rotation);
  const plane=(mat,p,w,h,rotation=[-Math.PI/2,0,0],repeat=[1,1])=>emit(new T.PlaneGeometry(w,h),mat,p,[1,1,1],rotation,repeat);
  function archShape(w,h,bottom=0){
    const p=new T.Shape();p.moveTo(-w/2,bottom);const rise=Math.min(w*.6,h*.7),spring=h-rise;p.lineTo(-w/2,spring);
    p.bezierCurveTo(-w/2,spring+rise*.55,-w*.18,h-rise*.20,0,h);
    p.bezierCurveTo(w*.18,h-rise*.20,w/2,spring+rise*.55,w/2,spring);p.lineTo(w/2,bottom);p.closePath();return p;
  }
  function arch(mat,p,w,h,thickness,depth,rotation=[0,0,0]){
    const shape=archShape(w,h);const inside=archShape(w-2*thickness,h-thickness,-.01);
    shape.holes.push(new T.Path(inside.getPoints(high?20:10)));
    emit(new T.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:high?16:8}),mat,p,[1,1,1],rotation);
  }
  function star(mat,p,r,rotation=[0,0,0]){
    const shape=new T.Shape();
    for(let n=0;n<16;n++){const a=n*Math.PI/8,rr=n%2?r*.53:r;n?shape.lineTo(Math.cos(a)*rr,Math.sin(a)*rr):shape.moveTo(Math.cos(a)*rr,Math.sin(a)*rr);}
    shape.closePath();emit(new T.ExtrudeGeometry(shape,{depth:.035,bevelEnabled:false}),mat,p,[1,1,1],rotation);
  }
  function column(x,z){
    cylinder('marble',[x,.16,z],.68,.74,.32);
    cylinder('gold',[x,.36,z],.57,.61,.08);
    cylinder('marble',[x,.57,z],.48,.57,.34);
    cylinder('column',[x,4.45,z],.34,.40,7.45);
    for(const y of [.84,7.91,8.13])cylinder('gold',[x,y,z],.405,.405,.055);
    cylinder('plaster',[x,8.18,z],.64,.39,.45);
    cylinder('gold',[x,8.42,z],.66,.65,.085);
    box('marble',[x,8.62,z],[1.28,.3,1.28]);
    const leaves=high?8:5;
    for(let n=0;n<leaves;n++){
      const a=n*Math.PI*2/leaves;
      const points=[new T.Vector3(x+Math.cos(a)*.33,7.75,z+Math.sin(a)*.33),new T.Vector3(x+Math.cos(a)*.38,8.08,z+Math.sin(a)*.38),new T.Vector3(x+Math.cos(a)*.62,8.30,z+Math.sin(a)*.62)];
      emit(new T.TubeGeometry(new T.CatmullRomCurve3(points),high?12:7,.035,4,false),'gold');
    }
  }
  // Thin slab joints, stone skirting, and floral inlays are authored once at build time.
  box('marble',[0,-.11,0],[30,.22,34],[0,0,0],[12,14]);
  plane('ao',[0,.008,0],29.7,33.7);
  if(theme==='zayed')plane('inlay',[0,.012,0],24,31);
  if(theme!=='zayed')plane('carpet',[0,.019,0],11.6,29.8,[-Math.PI/2,0,0],[2,3]);
  for(const x of [-6.1,6.1,-13.5,13.5])box('gold',[x,.005,0],[.025,.012,32.6]);
  for(const z of [-15.6,15.6])box('gold',[0,.005,z],[27,.012,.025]);
  for(const x of [-8,8])for(const z of [-9,0,9])column(x,z);
  // Deep window bays and relief surrounds replace the flat wall panels.
  for(const side of [-1,1]){
    box('plaster',[side*14.75,.65,0],[.45,1.3,34]);
    box('plaster',[side*14.75,8.6,0],[.5,2.8,34]);
    for(const z of [-16,-8,0,8,16])box('marble',[side*14.7,4.3,z],[.5,7.4,.75],[0,0,0],[1,3]);
    for(const z of [-12,-4,4,12]){
      const angle=-side*Math.PI/2;
      arch('marble',[side*14.40,1.1,z],6.35,6.5,.32,.33,[0,angle,0]);
      arch('gold',[side*14.17,1.2,z],5.62,6.0,.055,.08,[0,angle,0]);
      const shape=archShape(5.4,5.88);
      emit(new T.ShapeGeometry(shape,high?16:8),'glass',[side*14.50,1.2,z],[1,1,1],[0,angle,0]);
      // A narrow lattice has real depth; all strips share one merged draw.
      for(let n=-3;n<=3;n++){
        box('gold',[side*14.10,3.75,z+n*.64],[.035,4.0,.026]);
        if(n%2===0)star('gold',[side*14.06,4.0,z+n*.64],.16,[0,angle,0]);
      }
      for(const y of [2.05,3.55,5.05])box('gold',[side*14.08,y,z],[.035,.025,4.7]);
      if(theme==='blue')plane('ceramic',[side*14.48,1.45,z],6.7,1.5,[0,angle,0],[2,1]);
    }
    for(const y of [.25,1.20,7.45,9.4])box(y===1.20?'gold':'marble',[side*14.45,y,0],[.15,.09,33.8]);
  }
  for(const z of [-16.8,16.8]){
    box('plaster',[0,4.9,z],[30,9.8,.42]);
    for(const y of [.25,1.25,8.45,9.35])box(y===1.25?'gold':'marble',[0,y,z+(z<0?.28:-.28)],[29,.10,.14]);
  }
  // A recessed mihrab with nested stone mouldings and an ornamental medallion.
  box('niche',[0,3.6,-16.51],[5.5,7.2,.05]);
  arch('marble',[0,0,-16.28],7.1,8.15,.44,.32);
  arch('gold',[0,.12,-15.90],6.1,7.55,.075,.10);
  arch('marble',[0,.22,-15.79],5.7,7.2,.14,.10);
  for(const x of [-2.4,2.4]){
    cylinder('marble',[x,2.6,-15.57],.12,.17,5.0);
    cylinder('gold',[x,5.15,-15.57],.19,.17,.18);
  }
  box('marble',[0,.11,-15.33],[7.4,.22,2.35]);
  star('gold',[0,5.15,-16.01],1.07);
  ring('gold',[0,5.15,-15.99],1.42,.035,[0,0,0]);
  ring('gold',[0,5.15,-15.99],1.58,.02,[0,0,0]);
  for(const x of [-10.8,10.8]){
    arch('marble',[x,.1,-16.42],4.8,6.75,.24,.18);
    arch('gold',[x,.18,-16.18],4.15,6.27,.05,.08);
    plane(theme==='blue'?'ceramic':'column',[x,3.0,-16.17],3.8,5.2,[0,0,0],[1,1]);
  }
  // Different ceiling forms distinguish the mosques rather than changing only their colors.
  if(theme==='nabawi'){
    box('plaster',[0,9.64,0],[30,.25,34]);
    for(let x=-12;x<=12;x+=4)for(let z=-14;z<=14;z+=4){
      box('wall',[x,9.40,z],[3.65,.14,3.65]);
      for(const dx of [-1.82,1.82])box('gold',[x+dx,9.26,z],[.065,.12,3.7]);
      for(const dz of [-1.82,1.82])box('gold',[x,9.26,z+dz],[3.7,.12,.065]);
      star('gold',[x,9.18,z],.22,[-Math.PI/2,0,0]);
    }
    for(const z of [-9,0,9])arch('marble',[0,8.68,z],16,2.3,.23,.48);
  }else{
    const radius=theme==='blue'?12.0:14.1,base=9.1;
    emit(new T.SphereGeometry(radius,high?48:24,high?24:12,0,Math.PI*2,0,Math.PI/2),'wall',[0,base,0],[1,1,1],[0,0,0],[4,1]);
    for(const theta of [.22,.5,.84,1.15,1.52])ring('gold',[0,base+Math.cos(theta)*radius,0],Math.sin(theta)*radius,.024);
    for(let n=0;n<(high?20:12);n++){
      const a=n*Math.PI*2/(high?20:12),points=[];
      for(let j=0;j<=16;j++){const th=j*Math.PI/32;points.push(new T.Vector3(Math.sin(th)*radius*Math.cos(a),base+Math.cos(th)*radius,Math.sin(th)*radius*Math.sin(a)));}
      emit(new T.TubeGeometry(new T.CatmullRomCurve3(points),high?24:12,.022,4,false),'gold');
    }
    for(const z of [-9,0,9])arch('marble',[0,8.65,z],16,9.0,.43,.4);
    if(theme==='blue')for(const x of [-10.2,10.2])for(const z of [-10,10])emit(new T.SphereGeometry(6.5,high?32:16,high?16:8,0,Math.PI*2,0,Math.PI/2),'wall',[x,8.3,z],[1,1,1],[0,0,0],[2,1]);
  }
  function chandelier(z,r,y){
    cylinder('gold',[0,(y+13)/2,z],.025,.025,13-y);
    for(const [radius,offset,count]of [[r,0,high?18:12],[r*.67,-.55,high?12:8]]){
      ring('gold',[0,y+offset,z],radius,.045);
      for(let n=0;n<count;n++){
        const a=n*Math.PI*2/count,x=Math.cos(a)*radius,zz=z+Math.sin(a)*radius;
        cylinder('gold',[x,y+offset-.20,zz],.055,.07,.5);
        emit(new T.SphereGeometry(.15,high?12:8,high?8:5),'glow',[x,y+offset-.48,zz],[.7,1.5,.7]);
      }
    }
  }
  if(theme==='nabawi')for(const z of [-9,0,9])chandelier(z,1.8,7.3);
  else chandelier(0,3.15,8.8);
  const batches=[];
  for(const [material,geometries]of parts){
    const merged=mergeGeometries(geometries,false);
    if(!merged)throw new Error('Cannot merge '+material);
    const indexed=mergeVertices(merged,1e-5);indexed.computeBoundingBox();
    batches.push({material,geometry:indexed});
    geometries.forEach(g=>g.dispose());merged.dispose();
  }
  return {materials,batches};
}
