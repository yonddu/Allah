import test from 'node:test';import assert from 'node:assert/strict';
import {CONGREGATION_VENUES,PRAYER_RAKAHS,makeCongregation,congregationPhase,nextCongregation,congregationSeat,FOLLOW_DELAY} from '../public/congregation-core.js';
test('All five prayers share a deterministic server clock and followers never move before the imam',()=>{
 for(const [prayer,count]of Object.entries(PRAYER_RAKAHS)){
  const session=makeCongregation('mecca',prayer,1000000);assert.equal(session.steps.filter(s=>s.key==='recite').length,count);assert.equal(session.steps.filter(s=>s.pose==='prostrating').length,count*2);
  assert.equal(congregationPhase(session,session.adhanAt).key,'adhan');assert.equal(congregationPhase(session,session.adhanEndsAt).key,'gather');
  const bow=session.steps.find(s=>s.pose==='bowing');assert.equal(congregationPhase(session,bow.at).pose,'bowing');assert.equal(congregationPhase(session,bow.at,{follower:true}).pose,'standing');assert.equal(congregationPhase(session,bow.at+FOLLOW_DELAY,{follower:true}).pose,'bowing');
  assert.equal(congregationPhase(session,session.endsAt,{follower:true}).key,'complete');
 }
});
test('Every map has fifty legal, separated positions in rows behind the imam',()=>{
 for(const map of Object.keys(CONGREGATION_VENUES)){
  const seats=Array.from({length:50},(_,i)=>congregationSeat(map,i));assert.ok(seats.every(Boolean),map);assert.equal(new Set(seats.map(p=>p.x+':'+p.z)).size,50);
  for(let i=0;i<seats.length;i++)for(let j=i+1;j<seats.length;j++)assert.ok(Math.hypot(seats[i].x-seats[j].x,seats[i].z-seats[j].z)>1.25);
  assert.equal(congregationSeat(map,50),null);
 }
});
test('Room prayer times are independent of the visitor timezone and roll over at the venue date',()=>{
 for(const map of Object.keys(CONGREGATION_VENUES)){
  const now=Date.parse('2026-11-07T01:00:00Z'),a=nextCongregation(map,now);assert.ok(a.closesAt>now);assert.equal(nextCongregation(map,a.adhanAt).id,a.id);assert.notEqual(nextCongregation(map,a.closesAt).id,a.id);
 }
});
