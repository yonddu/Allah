import {avatarSelection} from './avatar-catalog.js';
import {LANTERN_LAYOUT} from './lantern-layout.js';
import {ABU_YAW,ABU_QIBLA_BEARING,rotateMapPoint} from './map-frame.js';
export const KAABA = Object.freeze({lat:21.422487, lon:39.826206});
export const COLORS = Object.freeze({
  skin: ['#f1c9a7','#d9a078','#ad7351','#774c38','#473029'],
  robe: ['#e9e2d3','#174e48','#273a59','#753b44','#b28b50','#303338'],
  rug: ['#18554c','#843c46','#243e64','#a27d40','#443d65']
});
export const DEFAULT_PROFILE = Object.freeze({
  model:'model01',name:'방문자', gender:'male', skin:0, face:'oval', beard:'none', outfit:'thobe',
  cover:'kufi', color:0, rug:0, pattern:'mihrab',character:'face01',wardrobe:'look01'
});
export const PRAYER_POSES = ['standing','bowing','prostrating','sitting','qaadah','rising'];
export const GREETING_DURATION=2800;
// Local -Z is forward. The invisible area includes the entire mat and its front.
export const PRAYER_AREA=Object.freeze({halfWidth:1.02,back:1.25,front:2.45});
function prayerLocal(point,host){const c=Math.cos(host.yaw||0),s=Math.sin(host.yaw||0),x=point.x-host.x,z=point.z-host.z;return {x:x*c-z*s,z:x*s+z*c};}
export function inPrayerArea(point,host){const p=prayerLocal(point,host);return Math.abs(p.x)<PRAYER_AREA.halfWidth&&p.z>-PRAYER_AREA.front&&p.z<PRAYER_AREA.back;}
export function prayerAreaAllows(from,to,host){
 const a=prayerLocal(from,host),b=prayerLocal(to,host),w=PRAYER_AREA.halfWidth,f=PRAYER_AREA.front,r=PRAYER_AREA.back;
 // A visitor caught inside an area by reconnection can leave without becoming trapped.
 const depth=p=>Math.min(w-Math.abs(p.x),p.z+f,r-p.z);
 if(depth(a)>0)return depth(b)<depth(a)-1e-7;
 let enter=0,exit=1;
 for(const [start,end,min,max]of [[a.x,b.x,-w,w],[a.z,b.z,-f,r]]){
  const delta=end-start;if(Math.abs(delta)<1e-9){if(start<=min||start>=max)return true;continue;}
  const lo=(min-start)/delta,hi=(max-start)/delta;enter=Math.max(enter,Math.min(lo,hi));exit=Math.min(exit,Math.max(lo,hi));if(enter>=exit)return true;
 }
 return exit<=0||enter>=1;
}
function prayerCorners(host){return [-1,1].flatMap(side=>[-PRAYER_AREA.front,PRAYER_AREA.back].map(z=>({x:host.x+side*PRAYER_AREA.halfWidth*Math.cos(host.yaw)+z*Math.sin(host.yaw),z:host.z-side*PRAYER_AREA.halfWidth*Math.sin(host.yaw)+z*Math.cos(host.yaw)})));}
function areasOverlap(a,b){
 const aa=prayerCorners(a),bb=prayerCorners(b);
 for(const yaw of [a.yaw,b.yaw])for(const axis of [{x:Math.cos(yaw),z:-Math.sin(yaw)},{x:Math.sin(yaw),z:Math.cos(yaw)}]){
  const pa=aa.map(p=>p.x*axis.x+p.z*axis.z),pb=bb.map(p=>p.x*axis.x+p.z*axis.z);
  if(Math.max(...pa)<=Math.min(...pb)||Math.max(...pb)<=Math.min(...pa))return false;
 }return true;
}
export function canBeginPrayer(actor,players,map='mecca'){
 const host={...actor,yaw:prayerYaw(map,actor)};
 return prayerCorners(host).every(p=>legalPosition(p.x,p.z,map))&&players.every(p=>p.id===actor.id||(!inPrayerArea(p,host)&&(!p.praying||!areasOverlap(host,p))));
}
export const clamp = (v,min,max)=>Math.max(min,Math.min(max,v));
const option = (v,allowed,fallback)=>allowed.includes(v)?v:fallback;
const index = (v,max,fallback)=>Number.isInteger(v)&&v>=0&&v<max?v:fallback;
export function sanitizeProfile(raw={}) {
  if (!raw || typeof raw!=='object' || Array.isArray(raw)) raw={};
  const d=DEFAULT_PROFILE;
  const name=typeof raw.name==='string'?raw.name.normalize('NFKC').replace(/[\p{C}<>]/gu,'').trim().slice(0,20):d.name;
  return {
    ...avatarSelection(raw),
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
  if(!coordinatesValid(lat,lon))throw new RangeError('위도 -90~90, 경도 -180~180 범위의 좌표를 입력해주세요.');
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
export function legalPosition(x,z,mapId='mecca') {
  const map=MAPS[mapId]||MAPS.mecca;
  const p=map.rotation?rotateMapPoint({x,z},-map.rotation):{x,z},bounds=map.localBounds||map.bounds;
  return Number.isFinite(x)&&Number.isFinite(z)&&Math.abs(p.x)<=bounds.x&&Math.abs(p.z)<=bounds.z&&(LANTERN_LAYOUT[mapId]||LANTERN_LAYOUT.mecca).every(l=>Math.hypot(x-l.x,z-l.z)>.83)&&map.obstacles.every(o=>o.kind==='circle'?Math.hypot(p.x-o.x,p.z-o.z)>o.r+.45:!(p.x>o.x1-.45&&p.x<o.x2+.45&&p.z>o.z1-.45&&p.z<o.z2+.45));
}
export function constrainedMove(current,desired,seconds,mapId='mecca') {
  if(!desired||!Number.isFinite(desired.x)||!Number.isFinite(desired.z)) return {x:current.x,z:current.z};
  const dx=desired.x-current.x,dz=desired.z-current.z;
  const distance=Math.hypot(dx,dz),max=4.2*clamp(seconds,0,0.25);
  if(distance===0||max===0)return {x:current.x,z:current.z};
  const scale=Math.min(1,max/distance),x=current.x+dx*scale,z=current.z+dz*scale;
  if(legalPosition(x,z,mapId))return {x,z};
  if(legalPosition(x,current.z,mapId))return {x,z:current.z};
  if(legalPosition(current.x,z,mapId))return {x:current.x,z};
  return {x:current.x,z:current.z};
}
export function publicPlayer(p) {
  return {id:p.id,seq:p.seq||0,accountId:p.accountId,protected:!!p.praying,profile:sanitizeProfile(p.profile),x:p.x,z:p.z,yaw:p.yaw,praying:!!p.praying,pose:p.praying&&PRAYER_POSES.includes(p.pose)?p.pose:'standing',congregationId:p.congregationId||null};
}

export function fenceAllows(from,to,host,actorId,friends=[]) {
  if(actorId===host.accountId||friends.includes(actorId))return true;
  const yaw=Number.isFinite(host.yaw)?host.yaw:0,c=Math.cos(yaw),s=Math.sin(yaw),center={x:host.x-.35*s,z:host.z-.35*c},rx=1.85,rz=2.35;
  const ax=((from.x-center.x)*c-(from.z-center.z)*s)/rx,az=((from.x-center.x)*s+(from.z-center.z)*c)/rz;
  const bx=((to.x-center.x)*c-(to.z-center.z)*s)/rx,bz=((to.x-center.x)*s+(to.z-center.z)*c)/rz;
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
 abudhabi:{name:'Sheikh Zayed Grand Mosque',city:'Abu Dhabi · United Arab Emirates',short:'SHEIKH ZAYED',description:'White domes · Floral marble · Qibla-aligned courtyard',stone:0xf3f0e7,green:0x53675a,bounds:{x:110,z:110},localBounds:{x:74,z:84},rotation:ABU_YAW,qiblaBearing:ABU_QIBLA_BEARING,cameraAngle:ABU_YAW,spawn:rotateMapPoint({x:0,z:18}),obstacles:[{kind:'box',x1:-43,x2:43,z1:-83,z2:-31.5},...[-58,58].flatMap(x=>[-76,72].map(z=>({kind:'circle',x,z,r:3.2})))]},
 makkah:{name:'Makkah courtyard',city:'Makkah · Saudi Arabia',short:'MASJID AL-HARAM',description:'Kaaba · marble courtyard · layered arcades',stone:0xf1efdf,green:0x3a5143,bounds:{x:74,z:80},cameraAngle:.12,spawn:{x:0,z:21},sacredCenter:{x:0,z:-12},obstacles:[{kind:'box',x1:-6.1,x2:6.1,z1:-18,z2:-6},{kind:'box',x1:-8.4,x2:8.4,z1:-27,z2:-18},{kind:'circle',x:11,z:-10,r:1.5}]},
 mecca:{name:'누르 대기도원',city:'하늘이 열린 기도 광장',short:'NOOR SANCTUARY',description:'대형 돔 · 아치 회랑 · 대리석 광장',stone:0xf0eee5,green:0x32544b,bounds:{x:74,z:84},cameraAngle:.08,spawn:{x:0,z:18},obstacles:[{kind:'box',x1:-43,x2:43,z1:-83,z2:-31.5},...[-52,52].flatMap(x=>[-76,-35].map(z=>({kind:'circle',x,z,r:3.2})))]},
 taj:{name:'타지마할 광장',city:'아그라 · 인도',short:'TAJ MAHAL',description:'돔 · 정원 · 반사 연못',stone:0xf3f0e6,green:0x3e744b,bounds:{x:74,z:84},cameraAngle:.13,spawn:{x:10,z:24},obstacles:[{kind:'box',x1:-38,x2:38,z1:-77,z2:-26},{kind:'box',x1:-6.2,x2:6.2,z1:-6.2,z2:66.2},...[-1,1].map(side=>({kind:'box',x1:side<0?-80:58,x2:side<0?-58:80,z1:-78,z2:-28})),...[-13,13,-46,46].flatMap(x=>Array.from({length:8},(_,i)=>({kind:'circle',x,z:i*10,r:.35})))]}
});
export function parseRoom(value){
 const match=typeof value==='string'?value.match(/^(mecca|makkah|taj|abudhabi|zayed|blue|nabawi):([1-3])$/):null;
 if(!match)return null;const map=({zayed:'mecca',nabawi:'mecca',blue:'taj'})[match[1]]||match[1],server=Number(match[2]);return {map,server,key:map+':'+server};
}
export function prayerYaw(mapId,position){
 if(mapId==='abudhabi')return ABU_YAW;
 if(mapId==='makkah')return Math.atan2(position.x-MAPS.makkah.sacredCenter.x,position.z-MAPS.makkah.sacredCenter.z);
 if(mapId==='mecca')return 0;
 // Virtual Taj courtyard: along the pool toward its entrance (+Z), as marked by the user.
 return Math.PI;
}

export function joystickVector(dx,dy,radius,deadzone=.12){
  if(!Number.isFinite(dx)||!Number.isFinite(dy)||!Number.isFinite(radius)||radius<=0)return {x:0,y:0,pixelX:0,pixelY:0};
  const length=Math.hypot(dx,dy);
  if(!length)return {x:0,y:0,pixelX:0,pixelY:0};
  const limit=clamp(deadzone,0,.9),raw=clamp(length/radius,0,1),strength=raw<=limit?0:(raw-limit)/(1-limit),pixels=Math.min(length,radius);
  return {x:dx/length*strength,y:dy/length*strength,pixelX:dx/length*pixels,pixelY:dy/length*pixels};
}
