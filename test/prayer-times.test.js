import test from 'node:test';
import assert from 'node:assert/strict';
import {dateAt,zoneAt,validZone,prayerSchedule} from '../public/prayer-times-core.js';
const sample={lat:-6.2088,lon:106.8456,zone:'Asia/Jakarta'};
test('Prayer times include exactly five prayers, a tomorrow Fajr and the location date across the date line',()=>{
 const now=new Date('2026-11-05T23:30:00Z'),schedule=prayerSchedule(sample,now);
 assert.deepEqual(schedule.civil,{year:2026,month:11,day:6});assert.equal(schedule.valid,true);assert.deepEqual(schedule.entries.map(p=>p.id),['fajr','dhuhr','asr','maghrib','isha']);
 assert.ok(schedule.entries.every((p,i,a)=>Number.isFinite(+p.time)&&(!i||p.time>a[i-1].time)));
 const late=prayerSchedule(sample,new Date('2026-11-06T16:30:00Z'));assert.equal(late.next.id,'fajr');assert.equal(late.next.tomorrow,true);assert.ok(late.next.time>new Date('2026-11-06T16:30:00Z'));
 assert.deepEqual(dateAt(new Date('2026-11-06T01:00:00Z'),'America/New_York'),{year:2026,month:11,day:5});
 assert.equal(zoneAt(-6.2088,106.8456),'Asia/Jakarta');assert.equal(zoneAt(37.5665,126.978),'Asia/Seoul');assert.equal(validZone('invalid/zone'),false);
});
test('Location timezone, DST and calculation choices are independent of the device timezone',()=>{
 const original=process.env.TZ,options={lat:40.7128,lon:-74.006,zone:'America/New_York',method:'Karachi'},now=new Date('2026-03-08T06:00:00Z');let reference;
 try{for(const tz of ['UTC','Asia/Seoul','Pacific/Honolulu']){process.env.TZ=tz;const s=prayerSchedule(options,now),values=s.entries.map(p=>+p.time);if(reference)assert.deepEqual(values,reference);reference=values;assert.deepEqual(s.civil,{year:2026,month:3,day:8});}}
 finally{if(original===undefined)delete process.env.TZ;else process.env.TZ=original;}
 const standard=prayerSchedule({...sample,method:'Karachi'},now),hanafi=prayerSchedule({...sample,method:'Karachi',madhab:'Hanafi'},now);
 assert.ok(hanafi.entries[2].time>standard.entries[2].time);
 const shifted=prayerSchedule({...sample,method:'Karachi',ishaOffset:30},now);assert.equal(+shifted.entries[4].time-+standard.entries[4].time,30*60000);
 const fmt=new Intl.DateTimeFormat('en',{timeZone:'America/New_York',hour:'numeric',hourCycle:'h23'});assert.equal(fmt.format(new Date('2026-03-08T06:00:00Z')),'01');assert.equal(fmt.format(new Date('2026-03-08T07:00:00Z')),'03');
});
test('High latitude summer calculations stay finite and invalid coordinates are rejected',()=>{
 const s=prayerSchedule({lat:69.6492,lon:18.9553,zone:'Europe/Oslo'},new Date('2026-06-21T12:00:00Z'));assert.equal(s.highLatitude,true);assert.equal(s.valid,true);assert.ok(s.entries.every(p=>Number.isFinite(+p.time)));
 assert.throws(()=>prayerSchedule({...sample,lat:91}));assert.throws(()=>prayerSchedule({...sample,zone:'wrong'}));
});
