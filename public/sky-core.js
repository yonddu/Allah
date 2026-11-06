import {prayerSchedule} from './prayer-times-core.js';
import {CONGREGATION_VENUES,congregationDay} from './congregation-core.js';
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
export function skySchedule(map,now){
 const venue=CONGREGATION_VENUES[map]||CONGREGATION_VENUES.mecca;
 const schedules=[-1,0,1].map(d=>prayerSchedule(venue,new Date(now+d*86400000)));
 const pick=(s,id)=>+s.entries.find(p=>p.id===id).time;
 return {day:congregationDay(map,now),map,sunrise:+schedules[1].sunrise,sunset:pick(schedules[1],'maghrib'),fajr:pick(schedules[1],'fajr'),isha:pick(schedules[1],'isha'),previousSunset:pick(schedules[0],'maghrib'),nextSunrise:+schedules[2].sunrise};
}
export function skyState(schedule,now){
 const s=schedule,day=now>=s.sunrise&&now<=s.sunset;
 const daylight=smooth(s.fajr,s.sunrise+1800000,now)*(1-smooth(s.sunset-1200000,s.isha,now));
 const phase=day?(now-s.sunrise)/(s.sunset-s.sunrise):now<s.sunrise?(now-s.previousSunset)/(s.sunrise-s.previousSunset):(now-s.sunset)/(s.nextSunrise-s.sunset);
 const angle=Math.PI*Math.max(0,Math.min(1,phase)),direction=[Math.cos(angle),Math.sin(angle)*.85,-.35];
 const len=Math.hypot(...direction);direction.forEach((v,i)=>direction[i]=v/len);
 return {daylight,day,sun:day?direction:[0,-1,0],moon:day?[0,-1,0]:direction,twilight:4*daylight*(1-daylight)};
}
