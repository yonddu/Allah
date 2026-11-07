import test from 'node:test';import assert from 'node:assert/strict';import {skySchedule,skyState} from '../public/sky-core.js';
test('Venue skies follow Fajr, actual sunrise, Maghrib and Isha with continuous twilight',()=>{
 for(const map of ['mecca','makkah','taj','abudhabi']){const s=skySchedule(map,Date.parse('2026-11-07T10:00:00Z'));assert.ok(s.fajr<s.sunrise&&s.sunrise<s.sunset&&s.sunset<s.isha);assert.equal(skyState(s,s.fajr).daylight,0);assert.equal(skyState(s,(s.sunrise+s.sunset)/2).daylight,1);assert.equal(skyState(s,s.isha).daylight,0);assert.ok(skyState(s,s.sunrise).sun[1]>=0);assert.ok(skyState(s,s.isha).moon[1]>0);for(const at of [s.fajr,s.sunrise,s.sunset,s.isha])assert.ok(Math.abs(skyState(s,at-1).daylight-skyState(s,at+1).daylight)<.001);}
 assert.notEqual(skySchedule('taj',Date.now()).sunrise,skySchedule('makkah',Date.now()).sunrise);
});
