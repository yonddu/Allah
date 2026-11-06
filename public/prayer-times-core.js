import {Coordinates,CalculationMethod,Madhab,HighLatitudeRule,PolarCircleResolution,PrayerTimes} from './lib/adhan/Adhan.js';
import tzlookup from './lib/tz-lookup.js';
import {coordinatesValid} from './core.js';
export const PRAYER_NAMES={fajr:'파즈르',dhuhr:'두흐르',asr:'아스르',maghrib:'마그리브',isha:'이샤'};
export const PRAYER_METHODS=['Singapore','MuslimWorldLeague','Karachi','UmmAlQura','Egyptian','Dubai','MoonsightingCommittee','NorthAmerica','Turkey','Tehran','Qatar','Kuwait'];
export function validZone(zone){try{new Intl.DateTimeFormat('en',{timeZone:zone}).format();return typeof zone==='string'&&!!zone;}catch{return false;}}
export function zoneAt(lat,lon){if(!coordinatesValid(lat,lon))throw new RangeError('위도 -90~90, 경도 -180~180 범위의 좌표를 입력해주세요.');const zone=tzlookup(lat,lon);return validZone(zone)?zone:'UTC';}
export function dateAt(now,zone){
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US-u-ca-gregory-nu-latn',{timeZone:zone,year:'numeric',month:'numeric',day:'numeric'}).formatToParts(now).map(p=>[p.type,p.value]));
 return {year:+parts.year,month:+parts.month,day:+parts.day};
}
export function automaticMethod(zone){
 if(['Asia/Jakarta','Asia/Pontianak','Asia/Makassar','Asia/Jayapura','Asia/Kuala_Lumpur','Asia/Kuching','Asia/Singapore','Asia/Brunei'].includes(zone))return 'Singapore';
 if(zone==='Asia/Riyadh')return 'UmmAlQura';if(zone==='Asia/Dubai')return 'Dubai';if(zone==='Asia/Qatar')return 'Qatar';if(zone==='Asia/Kuwait')return 'Kuwait';
 if(zone==='Africa/Cairo')return 'Egyptian';if(zone==='Europe/Istanbul')return 'Turkey';if(zone==='Asia/Tehran')return 'Tehran';
 if(['Asia/Karachi','Asia/Dhaka','Asia/Kolkata','Asia/Kabul','Asia/Colombo'].includes(zone))return 'Karachi';
 if(zone.startsWith('America/')||zone==='Europe/London')return 'MoonsightingCommittee';return 'MuslimWorldLeague';
}
export function prayerSchedule({lat,lon,zone,method='auto',madhab='Shafi',ishaOffset=0},now=new Date()){
 if(!coordinatesValid(lat,lon)||!validZone(zone)||!Number.isFinite(now.getTime()))throw new RangeError('위도 -90~90, 경도 -180~180 범위의 좌표를 입력해주세요.');
 const actualMethod=method==='auto'?automaticMethod(zone):PRAYER_METHODS.includes(method)?method:'MuslimWorldLeague',coordinates=new Coordinates(lat,lon),civil=dateAt(now,zone);
 const params=CalculationMethod[actualMethod]();params.madhab=madhab==='Hanafi'?Madhab.Hanafi:Madhab.Shafi;params.highLatitudeRule=HighLatitudeRule.recommended(coordinates);params.polarCircleResolution=PolarCircleResolution.AqrabBalad;
 params.adjustments.isha=Number.isFinite(ishaOffset)?Math.max(-60,Math.min(120,Math.round(ishaOffset))):0;
 const day=offset=>{const d=new Date(Date.UTC(civil.year,civil.month-1,civil.day+offset));return new Date(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate(),12);};
 const today=new PrayerTimes(coordinates,day(0),params),tomorrow=new PrayerTimes(coordinates,day(1),params);
 const entries=Object.keys(PRAYER_NAMES).map(id=>({id,time:today[id]}));
 const next=entries.find(p=>Number.isFinite(p.time.getTime())&&p.time>now)||(tomorrow.isValid&&tomorrow.fajr>now?{id:'fajr',time:tomorrow.fajr,tomorrow:true}:null);
 const tomorrowEntries=Object.keys(PRAYER_NAMES).map(id=>({id,time:tomorrow[id]}));
 return {civil,entries,tomorrowEntries,next,method:actualMethod,zone,valid:today.isValid,highLatitude:Math.abs(lat)>55};
}
export function prayerCountdowns(schedule,now=new Date()){
 return schedule.entries.map(entry=>{
  const tomorrow=entry.time<=now,time=tomorrow?schedule.tomorrowEntries.find(p=>p.id===entry.id)?.time:entry.time;
  const remainingSeconds=time&&Number.isFinite(+time)?Math.max(0,Math.ceil((time-now)/1000)):null;
  return {id:entry.id,time,tomorrow,remainingSeconds};
 });
}
export function formatPrayerCountdown(seconds){
 if(!Number.isFinite(seconds))return '—';
 const value=Math.max(0,Math.ceil(seconds));
 return [Math.floor(value/3600),Math.floor(value/60)%60,value%60].map(n=>String(n).padStart(2,'0')).join(':');
}
