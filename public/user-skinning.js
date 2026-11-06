import * as THREE from 'three';
const clamp=THREE.MathUtils.clamp;
export function userRigConfig(geometry){
 const p=geometry.getAttribute('position');let span=0;const heights=[];
 for(let i=0;i<p.count;i++)span=Math.max(span,Math.abs(p.getX(i)));
 for(let i=0;i<p.count;i++)if(Math.abs(p.getX(i))>span*.55&&p.getY(i)>1)heights.push(p.getY(i));
 heights.sort((a,b)=>a-b);
 const armY=clamp(heights[Math.floor(heights.length/2)]||1.42,1.25,1.52),shoulder=clamp(span*.23,.18,.24),wrist=Math.max(shoulder+.36,span-.11),elbow=shoulder+(wrist-shoulder)*.52;
 return {armY,shoulder,elbow,wrist,upper:elbow-shoulder,lower:wrist-elbow};
}
export function skinUserGeometry(geometry,c){
 const p=geometry.getAttribute('position'),joints=new Uint16Array(p.count*4),weights=new Float32Array(p.count*4);
 const blend=(a,b,t)=>[[a,1-clamp(t,0,1)],[b,clamp(t,0,1)]];
 for(let i=0;i<p.count;i++){
  const x=p.getX(i),a=Math.abs(x),y=p.getY(i),left=x<0;let w;
  if(y>1.58)w=[[5,1]];
  else if(y>1.51)w=blend(4,5,(y-1.51)/.07);
  else if(y>c.armY-.02)w=blend(3,4,(y-c.armY+.02)/Math.max(.03,1.51-c.armY+.02));
  else if(y>1.12)w=blend(2,3,(y-1.12)/Math.max(.1,c.armY-.065-1.12));
  else if(y>.92)w=blend(1,2,(y-.92)/.20);
  else if(y>.80)w=blend(left?12:15,1,(y-.80)/.12);
  else if(y>.57)w=[[left?12:15,1]];
  else if(y>.41)w=blend(left?13:16,left?12:15,(y-.41)/.16);
  else if(y>.15)w=[[left?13:16,1]];
  else w=blend(left?14:17,left?13:16,(y-.07)/.08);
  const armFactor=THREE.MathUtils.smoothstep(a,c.shoulder*.95,c.shoulder+.14)*(1-THREE.MathUtils.smoothstep(Math.abs(y-c.armY),.10,.20));
  if(armFactor>0){
   const upper=left?6:9,lower=upper+1,hand=upper+2;
   const arm=a<c.elbow-.07?[[upper,1]]:a<c.elbow+.07?blend(upper,lower,(a-c.elbow+.07)/.14):a<c.wrist-.045?[[lower,1]]:blend(lower,hand,(a-c.wrist+.045)/.09);
   w=[...w.map(([id,v])=>[id,v*(1-armFactor)]),...arm.map(([id,v])=>[id,v*armFactor])].filter(([,v])=>v>0);
   // Two shared knuckle rows softly curl the supplied fingers; keep thumb web/palm stable.
   if(a>c.wrist+.045&&Math.abs(y-c.armY)<.085&&y<c.armY+.018){
    const knuckle=left?18:20,t=clamp((a-c.wrist-.045)/.025,0,1),tip=clamp((a-c.wrist-.078)/.028,0,1);
    w=[[hand,1-t],[knuckle,t*(1-tip)],[knuckle+1,t*tip]];
   }
  }
  for(let k=0;k<w.length;k++){joints[i*4+k]=w[k][0];weights[i*4+k]=w[k][1];}
 }
 geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(joints,4));geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));geometry.userData.shared=true;return geometry;
}
