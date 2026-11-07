import {prayerSchedule,dateAt} from './prayer-times-core.js';
import {legalPosition,prayerYaw} from './core.js';
import {ABU_DHABI,ABU_YAW,rotateMapPoint} from './map-frame.js';

export const PRAYER_RAKAHS=Object.freeze({fajr:2,dhuhr:4,asr:4,maghrib:3,isha:4});
export const ADHAN_MS=154000,GATHER_MS=240000,FOLLOW_DELAY=650,COMPLETE_MS=45000;
export const CONGREGATION_VENUES=Object.freeze({
 abudhabi:{...ABU_DHABI,imam:rotateMapPoint({x:0,z:-10}),yaw:ABU_YAW},
 mecca:{label:'Makkah',lat:21.422487,lon:39.826206,zone:'Asia/Riyadh',imam:{x:0,z:-10},yaw:0},
 makkah:{label:'Makkah',lat:21.422487,lon:39.826206,zone:'Asia/Riyadh',imam:{x:0,z:3},yaw:0},
 taj:{label:'Agra',lat:27.175,lon:78.0421,zone:'Asia/Kolkata',imam:{x:29,z:58},yaw:Math.PI}
});
export function congregationSteps(prayer){
 const steps=[],count=PRAYER_RAKAHS[prayer]||2;
 for(let rakah=1;rakah<=count;rakah++){
  for(const [key,pose,seconds]of [['recite','standing',45],['bow','bowing',7],['rise','rising',5],['sujud1','prostrating',7],['sit','qaadah',5],['sujud2','prostrating',7]])steps.push({key,pose,rakah,duration:seconds*1000});
  if(rakah===count||rakah===2)steps.push({key:'tashahhud',pose:'qaadah',rakah,duration:(rakah===count?20:12)*1000});
 }
 steps.push({key:'salaam',pose:'qaadah',rakah:count,duration:6000});return steps;
}
export function makeCongregation(map,prayer,adhanAt,{scale=1}={}){
 const steps=congregationSteps(prayer).map(s=>({...s,duration:Math.max(100,s.duration*scale)})),startsAt=adhanAt+GATHER_MS*scale;
 let at=startsAt;for(const step of steps){step.at=at;at+=step.duration;}
 return {id:map+':'+prayer+':'+adhanAt,map,prayer,adhanAt,adhanEndsAt:adhanAt+ADHAN_MS*scale,startsAt,endsAt:at+FOLLOW_DELAY,closesAt:at+FOLLOW_DELAY+COMPLETE_MS*scale,steps};
}
export function congregationPhase(session,now,{follower=false}={}){
 if(!session||now<session.adhanAt)return {key:'upcoming',pose:'standing',rakah:0};
 if(now<session.startsAt)return {key:now<session.adhanEndsAt?'adhan':'gather',pose:'standing',rakah:0};
 const t=now-(follower?FOLLOW_DELAY:0);
 if(t<session.startsAt)return {key:'recite',pose:'standing',rakah:1};
 const step=session.steps.find(s=>t>=s.at&&t<s.at+s.duration);
 return step?{key:step.key,pose:step.pose,rakah:step.rakah}:{key:'complete',pose:'qaadah',rakah:PRAYER_RAKAHS[session.prayer]};
}
export function nextCongregation(map,now=Date.now()){
 const venue=CONGREGATION_VENUES[map]||CONGREGATION_VENUES.mecca,candidates=[];
 for(const offset of [-1,0,1])for(const entry of prayerSchedule(venue,new Date(now+offset*86400000)).entries)if(Number.isFinite(+entry.time))candidates.push(makeCongregation(map,entry.id,+entry.time));
 const unique=[...new Map(candidates.map(s=>[s.id,s])).values()].sort((a,b)=>a.adhanAt-b.adhanAt);
 return unique.find(s=>s.closesAt>now)||null;
}
export function congregationDay(map,now){const venue=CONGREGATION_VENUES[map]||CONGREGATION_VENUES.mecca;return Object.values(dateAt(new Date(now),venue.zone)).join('-');}
export function congregationSeat(map,index){
 if(!Number.isInteger(index)||index<0||index>=50)return null;
 const venue=CONGREGATION_VENUES[map]||CONGREGATION_VENUES.mecca,row=Math.floor(index/7),column=index%7,offset=column===0?0:Math.ceil(column/2)*(column%2?-1:1)*1.3;
 const back=3.8+row*2.7,c=Math.cos(venue.yaw),s=Math.sin(venue.yaw),x=venue.imam.x+offset*c+back*s,z=venue.imam.z-offset*s+back*c;
 if(!legalPosition(x,z,map))return null;return {x,z,yaw:prayerYaw(map,{x,z}),row,column};
}
