export const KAABA = Object.freeze({lat:21.422487, lon:39.826206});
export const COLORS = Object.freeze({
  skin: ['#f1c9a7','#d9a078','#ad7351','#774c38','#473029'],
  robe: ['#e9e2d3','#174e48','#273a59','#753b44','#b28b50','#303338'],
  rug: ['#18554c','#843c46','#243e64','#a27d40','#443d65']
});
export const DEFAULT_PROFILE = Object.freeze({
  name:'방문자', gender:'male', skin:0, face:'oval', beard:'none', outfit:'thobe',
  cover:'kufi', color:0, rug:0, pattern:'mihrab'
});
export const PILLARS = [-8,8].flatMap(x=>[-9,0,9].map(z=>({x,z,r:0.92})));
export const PRAYER_POSES = ['standing','bowing','prostrating','sitting'];
export const clamp = (v,min,max)=>Math.max(min,Math.min(max,v));
const option = (v,allowed,fallback)=>allowed.includes(v)?v:fallback;
const index = (v,max,fallback)=>Number.isInteger(v)&&v>=0&&v<max?v:fallback;
export function sanitizeProfile(raw={}) {
  if (!raw || typeof raw!=='object' || Array.isArray(raw)) raw={};
  const d=DEFAULT_PROFILE;
  const name=typeof raw.name==='string'?raw.name.normalize('NFKC').replace(/[\p{C}<>]/gu,'').trim().slice(0,20):d.name;
  return {
    name:name||d.name, gender:option(raw.gender,['male','female'],d.gender), skin:index(raw.skin,COLORS.skin.length,d.skin),
    face:option(raw.face,['oval','round','square'],d.face),
    beard:option(raw.beard,['none','short','full'],d.beard),
    outfit:option(raw.outfit,['thobe','abaya','tunic'],d.outfit),
    cover:raw.gender==='female'?'hijab':option(raw.cover,['kufi','hijab','none'],d.cover),
    color:index(raw.color,COLORS.robe.length,d.color),
    rug:index(raw.rug,COLORS.rug.length,d.rug),
    pattern:option(raw.pattern,['mihrab','geometry','garden'],d.pattern)
  };
}
const rad=d=>d*Math.PI/180;
export function coordinatesValid(lat,lon) {
  return typeof lat==='number'&&typeof lon==='number'&&Number.isFinite(lat)&&Number.isFinite(lon)&&Math.abs(lat)<=90&&Math.abs(lon)<=180;
}
export function qibla(lat,lon) {
  if(!coordinatesValid(lat,lon))throw new RangeError('유효한 위도·경도를 입력하세요.');
  const p1=rad(lat),p2=rad(KAABA.lat),dl=rad(KAABA.lon-lon);
  const a=Math.sin((p2-p1)/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;
  const distance=6371*2*Math.atan2(Math.sqrt(clamp(a,0,1)),Math.sqrt(1-clamp(a,0,1)));
  const x=Math.cos(p1)*Math.sin(p2)-Math.sin(p1)*Math.cos(p2)*Math.cos(dl);
  const y=Math.sin(dl)*Math.cos(p2);
  const bearing=distance<0.02||Math.hypot(x,y)<1e-10?null:((Math.atan2(y,x)*180/Math.PI)+360)%360;
  return {bearing,distance};
}
export function relativeBearing(bearing,heading) {
  return ((bearing-heading+540)%360)-180;
}
export function legalPosition(x,z) {
  return Number.isFinite(x)&&Number.isFinite(z)&&Math.abs(x)<=12&&Math.abs(z)<=14&&PILLARS.every(p=>Math.hypot(x-p.x,z-p.z)>p.r);
}
export function constrainedMove(current,desired,seconds) {
  if(!desired||!Number.isFinite(desired.x)||!Number.isFinite(desired.z)) return {x:current.x,z:current.z};
  const dx=desired.x-current.x,dz=desired.z-current.z;
  const distance=Math.hypot(dx,dz),max=4.2*clamp(seconds,0,0.25);
  if(distance===0||max===0)return {x:current.x,z:current.z};
  const scale=Math.min(1,max/distance),x=current.x+dx*scale,z=current.z+dz*scale;
  if(legalPosition(x,z))return {x,z};
  if(legalPosition(x,current.z))return {x,z:current.z};
  if(legalPosition(current.x,z))return {x:current.x,z};
  return {x:current.x,z:current.z};
}
export function publicPlayer(p) {
  return {id:p.id,seq:p.seq||0,accountId:p.accountId,protected:!!p.protected,profile:sanitizeProfile(p.profile),x:p.x,z:p.z,yaw:p.yaw,praying:!!p.praying,pose:PRAYER_POSES.includes(p.pose)?p.pose:'standing'};
}

export function fenceAllows(from,to,host,actorId,friends=[]) {
  if(actorId===host.accountId||friends.includes(actorId))return true;
  const center={x:host.x,z:host.z-.35},rx=1.85,rz=2.35;
  const ax=(from.x-center.x)/rx,az=(from.z-center.z)/rz;
  const bx=(to.x-center.x)/rx,bz=(to.z-center.z)/rz;
  const old=ax*ax+az*az,next=bx*bx+bz*bz;
  if(old<1)return next>old; // A revoked guest can always walk outward.
  const dx=bx-ax,dz=bz-az,len=dx*dx+dz*dz;
  const t=len?clamp(-(ax*dx+az*dz)/len,0,1):0;
  return (ax+t*dx)**2+(az+t*dz)**2>=1;
}
export function validatePost(raw) {
  if(!raw||!['suggestion','free'].includes(raw.category))throw new RangeError('게시판을 선택해주세요.');
  const title=typeof raw.title==='string'?raw.title.trim():'',body=typeof raw.body==='string'?raw.body.trim():'';
  if(title.length<2||title.length>80||body.length<2||body.length>4000)throw new RangeError('제목은 2~80자, 내용은 2~4,000자로 입력해주세요.');
  return {category:raw.category,title,body};
}

export const MAPS = Object.freeze({
  zayed:{name:'셰이크 자이드 모스크',city:'아부다비 · UAE',short:'SHEIKH ZAYED',description:'아이보리 대리석과 샴페인 골드, 꽃무늬 장식',stone:0xf4eee1,green:0xc8bda5,fog:0x78877a,carpet:false},
  blue:{name:'술탄 아흐메트 모스크',city:'이스탄불 · 튀르키예',short:'THE BLUE MOSQUE',description:'푸른 이즈니크 타일, 붉은 카펫과 고요한 돔',stone:0xdfd4c0,green:0x315d78,fog:0x314e65,carpet:true},
  nabawi:{name:'예언자 모스크',city:'메디나 · 사우디아라비아',short:'AL-MASJID AN-NABAWI',description:'초록빛 카펫과 밝은 기둥이 이어지는 기도 공간',stone:0xece4d6,green:0x456e58,fog:0x526e56,carpet:true}
});
export function parseRoom(value){
  const match=typeof value==='string'?value.match(/^(zayed|blue|nabawi):([1-3])$/):null;
  return match?{map:match[1],server:Number(match[2]),key:value}:null;
}

export function joystickVector(dx,dy,radius,deadzone=.12){
  if(!Number.isFinite(dx)||!Number.isFinite(dy)||!Number.isFinite(radius)||radius<=0)return {x:0,y:0,pixelX:0,pixelY:0};
  const length=Math.hypot(dx,dy);
  if(!length)return {x:0,y:0,pixelX:0,pixelY:0};
  const limit=clamp(deadzone,0,.9),raw=clamp(length/radius,0,1),strength=raw<=limit?0:(raw-limit)/(1-limit),pixels=Math.min(length,radius);
  return {x:dx/length*strength,y:dy/length*strength,pixelX:dx/length*pixels,pixelY:dy/length*pixels};
}
