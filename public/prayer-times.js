import {t} from './i18n.js';
import {PRAYER_NAMES,PRAYER_METHODS,zoneAt,validZone,prayerSchedule} from './prayer-times-core.js';
export const PRAYER_CITIES=[
 ['Jakarta','ID',-6.2088,106.8456,'Asia/Jakarta'],['Makkah','SA',21.422487,39.826206,'Asia/Riyadh'],['Madinah','SA',24.4672,39.6111,'Asia/Riyadh'],['Dubai','AE',25.2048,55.2708,'Asia/Dubai'],['Karachi','PK',24.8607,67.0011,'Asia/Karachi'],['Dhaka','BD',23.8103,90.4125,'Asia/Dhaka'],['New Delhi','IN',28.6139,77.2090,'Asia/Kolkata'],['Kuala Lumpur','MY',3.1390,101.6869,'Asia/Kuala_Lumpur'],['Istanbul','TR',41.0082,28.9784,'Europe/Istanbul'],['Cairo','EG',30.0444,31.2357,'Africa/Cairo'],['Tehran','IR',35.6892,51.3890,'Asia/Tehran'],['Lagos','NG',6.5244,3.3792,'Africa/Lagos'],['Lahore','PK',31.5204,74.3587,'Asia/Karachi'],['Tashkent','UZ',41.2995,69.2401,'Asia/Tashkent'],['Seoul','KR',37.5665,126.978,'Asia/Seoul'],['Daegu','KR',35.8714,128.6014,'Asia/Seoul'],['London','GB',51.5074,-.1278,'Europe/London'],['New York','US',40.7128,-74.006,'America/New_York']
];
export function initPrayerTimes({qibla,toast}){
 const $=id=>document.getElementById(id);let location=null,schedule=null,settings={method:'auto',madhab:'Shafi',ishaOffset:0},dayKey='',zoneOverride=null;
 try{const saved=JSON.parse(localStorage.getItem('noor-prayer-settings'));if(saved&&typeof saved==='object')settings={...settings,method:PRAYER_METHODS.includes(saved.method)?saved.method:'auto',madhab:saved.madhab==='Hanafi'?'Hanafi':'Shafi',ishaOffset:Number.isFinite(saved.ishaOffset)?Math.max(-60,Math.min(120,saved.ishaOffset)):0};}catch{}
 const timeFormat=()=>new Intl.DateTimeFormat(document.documentElement.lang||'en',{timeZone:location.zone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
 function cities(){const current=$('prayerCity').value,region=typeof Intl.DisplayNames==='function'?new Intl.DisplayNames([document.documentElement.lang||'en'],{type:'region'}):{of:v=>v};$('prayerCity').replaceChildren(new Option(t('도시 선택'),''));for(const [i,c]of PRAYER_CITIES.entries())$('prayerCity').append(new Option(c[0]+' · '+region.of(c[1]),String(i)));$('prayerCity').value=current;}
 for(const method of PRAYER_METHODS)$('prayerMethod').append(new Option(method,method));
 $('prayerZone').disabled=true;
 const zones=typeof Intl.supportedValuesOf==='function'?Intl.supportedValuesOf('timeZone'):['UTC',...PRAYER_CITIES.map(c=>c[4])];
 for(const zone of [...new Set(['UTC',...zones])])$('prayerZone').append(new Option(zone,zone));
 function chooseZone(zone){if(![...$('prayerZone').options].some(o=>o.value===zone))$('prayerZone').append(new Option(zone,zone));$('prayerZone').value=zone;}
 $('prayerMethod').value=settings.method;$('prayerMadhab').value=settings.madhab;$('prayerIshaOffset').value=settings.ishaOffset;
 function rebuild(){
  if(!location)return;
  try{
   schedule=prayerSchedule({...location,...settings});dayKey=Object.values(schedule.civil).join('-');
   const f=timeFormat();$('prayerDate').textContent=new Intl.DateTimeFormat(document.documentElement.lang||'en',{timeZone:location.zone,dateStyle:'full'}).format(new Date());
   $('prayerLocation').textContent=location.label+' · '+location.zone;
   $('prayerRows').replaceChildren();
   for(const entry of schedule.entries){const row=document.createElement('div');row.className='prayer-time-row';row.dataset.prayer=entry.id;const name=document.createElement('span');name.textContent=t(PRAYER_NAMES[entry.id]);const time=document.createElement('time');time.textContent=Number.isFinite(entry.time.getTime())?f.format(entry.time):'—';if(Number.isFinite(entry.time.getTime()))time.dateTime=entry.time.toISOString();row.append(name,time);$('prayerRows').append(row);}
   $('prayerHighLatitude').hidden=!schedule.highLatitude;$('prayerTimesStatus').textContent=schedule.valid?'':t('현지 모스크 시간표를 확인해주세요.');
   $('prayerMethodUsed').textContent=schedule.method+' · '+settings.madhab;
   $('prayerEmpty').hidden=true;$('prayerResults').hidden=false;
   tick();
  }catch(e){toast(e.message);}
 }
 function tick(){
  if(!location||!schedule||document.hidden)return;
  const now=new Date(),parts=new Intl.DateTimeFormat('en-US-u-ca-gregory-nu-latn',{timeZone:location.zone,year:'numeric',month:'numeric',day:'numeric'}).formatToParts(now),p=Object.fromEntries(parts.map(v=>[v.type,v.value]));
  if([+p.year,+p.month,+p.day].join('-')!==dayKey||schedule.next&&now>=schedule.next.time){rebuild();return;}
  const next=schedule.next;
  if(next){const mins=Math.max(0,Math.ceil((next.time-now)/60000)),duration=Math.floor(mins/60)+':'+String(mins%60).padStart(2,'0'),label=t(PRAYER_NAMES[next.id]);$('prayerCountdown').textContent=t('다음 기도: {name} · {time} 남음',{name:label,time:duration})+(next.tomorrow?' · '+t('내일'):'');$('prayerHudText').textContent=label+' · '+duration;
   for(const row of $('prayerRows').children)row.classList.toggle('next',row.dataset.prayer===next.id&&!next.tomorrow);
  }else{$('prayerCountdown').textContent='—';$('prayerHudText').textContent=t('기도 시간');}
 }
 function setLocation(detail,knownZone){
  const same=location&&Math.abs(location.lat-detail.lat)<.001&&Math.abs(location.lon-detail.lon)<.001;
  if(!same)zoneOverride=null;
  location={...detail,zone:knownZone||zoneOverride||zoneAt(detail.lat,detail.lon)};chooseZone(location.zone);$('prayerZone').disabled=false;
  $('prayerLatitude').value=detail.lat.toFixed(5);$('prayerLongitude').value=detail.lon.toFixed(5);rebuild();
 }
 window.addEventListener('noor:location',e=>setLocation(e.detail));
 window.addEventListener('noor:location-error',e=>{$('prayerTimesStatus').textContent=e.detail.message;});
 $('prayerTimesButton').addEventListener('click',()=>{if(!$('prayerTimesDialog').open)$('prayerTimesDialog').showModal();tick();});
 $('prayerLocationButton').addEventListener('click',()=>{qibla.useLocation();$('prayerTimesStatus').textContent='현재 위치를 확인하고 있습니다…';});
 $('prayerCity').addEventListener('change',()=>{const c=PRAYER_CITIES[Number($('prayerCity').value)];if($('prayerCity').value===''||!c)return;qibla.setLocation(c[2],c[3],c[0]);setLocation({lat:c[2],lon:c[3],label:c[0]},c[4]);});
 $('prayerCoordinatesButton').addEventListener('click',()=>{const a=$('prayerLatitude').value,b=$('prayerLongitude').value;if(!a.trim()||!b.trim()){toast('위도 -90~90, 경도 -180~180 범위의 좌표를 입력해주세요.');return;}qibla.setLocation(Number(a),Number(b),'직접 입력한 위치');});
 $('prayerZone').addEventListener('change',()=>{if(!location||!validZone($('prayerZone').value))return;zoneOverride=location.zone=$('prayerZone').value;rebuild();});
 for(const id of ['prayerMethod','prayerMadhab','prayerIshaOffset'])$(id).addEventListener('change',()=>{settings={method:$('prayerMethod').value,madhab:$('prayerMadhab').value,ishaOffset:Math.max(-60,Math.min(120,Math.round(Number($('prayerIshaOffset').value)||0)))};$('prayerIshaOffset').value=settings.ishaOffset;try{localStorage.setItem('noor-prayer-settings',JSON.stringify(settings));}catch{}rebuild();});
 window.addEventListener('languagechange',()=>{cities();rebuild();});document.addEventListener('visibilitychange',tick);setInterval(tick,15000);cities();
}
