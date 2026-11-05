import test from 'node:test';
import assert from 'node:assert/strict';
import {qibla,KAABA,sanitizeProfile,DEFAULT_PROFILE,legalPosition,constrainedMove,fenceAllows,validatePost,parseRoom} from '../public/core.js';
test('Qibla uses a great-circle bearing in several hemispheres',()=>{
  const seoul=qibla(37.5665,126.978),newYork=qibla(40.7128,-74.006),jakarta=qibla(-6.2088,106.8456);
  assert.ok(seoul.bearing>280&&seoul.bearing<290);
  assert.ok(newYork.bearing>58&&newYork.bearing<60);
  assert.ok(jakarta.bearing>294&&jakarta.bearing<297);
  assert.ok(seoul.distance>8000&&seoul.distance<8500);
  assert.equal(qibla(KAABA.lat,KAABA.lon).bearing,null);
  assert.throws(()=>qibla(91,0));assert.throws(()=>qibla(null,0));assert.throws(()=>qibla(NaN,0));
});
test('Malformed profile fields cannot escape the allowed appearance options',()=>{
  const p=sanitizeProfile({name:' <A>\u0000 ',skin:999,outfit:'<img>',color:-1,beard:true,face:['round']});
  assert.equal(p.name,'A');assert.equal(p.skin,DEFAULT_PROFILE.skin);assert.equal(p.outfit,'thobe');assert.equal(p.color,0);
  assert.deepEqual(sanitizeProfile(null),{...DEFAULT_PROFILE});
  assert.equal(sanitizeProfile({name:'A'.repeat(100)}).name.length,20);
});
test('Movement limits speed, walls, pillars, invalid input and pauses',()=>{
  const next=constrainedMove({x:0,z:0},{x:10000,z:0},.1);assert.ok(next.x<=.420001);
  assert.deepEqual(constrainedMove({x:0,z:0},{x:NaN,z:0},1),{x:0,z:0});
  assert.deepEqual(constrainedMove({x:0,z:0},{x:10,z:0},0),{x:0,z:0});
  assert.equal(legalPosition(8,0),false);assert.equal(legalPosition(13,0),false);
  const wall=constrainedMove({x:11.9,z:3},{x:13,z:3},.1);assert.ok(wall.x<=12);
});
test('Protected fences reject outsiders, permit friends, and permit a revoked guest to exit',()=>{
  const host={x:0,z:0,accountId:'host'};
  assert.equal(fenceAllows({x:3,z:0},{x:1,z:0},host,'stranger'),false);
  assert.equal(fenceAllows({x:3,z:0},{x:-3,z:0},host,'stranger'),false);
  assert.equal(fenceAllows({x:3,z:0},{x:1,z:0},host,'friend',['friend']),true);
  assert.equal(fenceAllows({x:3,z:0},{x:0,z:0},host,'host'),true);
  assert.equal(fenceAllows({x:0,z:0},{x:3,z:0},host,'revoked'),true);
});
test('Board validation and room selection reject unsupported input',()=>{
  assert.throws(()=>validatePost({category:'admin',title:'a',body:'b'}));
  assert.throws(()=>validatePost({category:'free',title:'a',body:'b'}));
  assert.equal(validatePost({category:'suggestion',title:' 의견 ',body:' 내용입니다 '}).title,'의견');
  assert.deepEqual(parseRoom('blue:2'),{map:'blue',server:2,key:'blue:2'});
  assert.equal(parseRoom('zayed:4'),null);assert.equal(parseRoom('../../admin'),null);
});
