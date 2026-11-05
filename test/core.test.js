import test from 'node:test';
import assert from 'node:assert/strict';
import {qibla,KAABA,sanitizeProfile,DEFAULT_PROFILE,legalPosition,constrainedMove,fenceAllows,validatePost,parseRoom,joystickVector} from '../public/core.js';
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
test('Movement limits speed, courtyard edges and landmarks, invalid input and pauses',()=>{
  const next=constrainedMove({x:0,z:0},{x:10000,z:0},.1);assert.ok(next.x<=.420001);
  assert.deepEqual(constrainedMove({x:0,z:0},{x:NaN,z:0},1),{x:0,z:0});
  assert.deepEqual(constrainedMove({x:0,z:0},{x:10,z:0},0),{x:0,z:0});
  assert.equal(legalPosition(0,-18),false);assert.equal(legalPosition(75,0),false);
  const wall=constrainedMove({x:73.9,z:3},{x:75,z:3},.1);assert.ok(wall.x<=74);
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
  assert.deepEqual(parseRoom('blue:2'),{map:'taj',server:2,key:'taj:2'});
  assert.equal(parseRoom('zayed:4'),null);assert.equal(parseRoom('../../admin'),null);
});

test('Joystick uses a dead zone, analog speed, radial clamping and safe reset',()=>{
  assert.deepEqual(joystickVector(0,0,30),{x:0,y:0,pixelX:0,pixelY:0});
  assert.equal(joystickVector(2,0,30).x,0);
  const gentle=joystickVector(15,0,30),full=joystickVector(100,0,30);
  assert.ok(gentle.x>0&&gentle.x<1);assert.equal(full.x,1);assert.equal(full.pixelX,30);
  const diagonal=joystickVector(100,100,30);
  assert.ok(Math.abs(Math.hypot(diagonal.x,diagonal.y)-1)<1e-9);
  assert.ok(Math.abs(Math.hypot(diagonal.pixelX,diagonal.pixelY)-30)<1e-9);
  assert.deepEqual(joystickVector(NaN,10,30),{x:0,y:0,pixelX:0,pixelY:0});
});

test('Female avatars always receive a head covering, including tampered client profiles',()=>{
  assert.equal(sanitizeProfile({gender:'female',cover:'none'}).cover,'hijab');
  assert.equal(sanitizeProfile({gender:'female',cover:'kufi'}).cover,'hijab');
  assert.equal(sanitizeProfile({gender:'female',cover:'hijab'}).cover,'hijab');
  assert.equal(sanitizeProfile({gender:'male',cover:'none'}).cover,'none');
});


test('Reference character and clothing combinations are normalized on the server',()=>{
  const female=sanitizeProfile({gender:'female',character:'face01',wardrobe:'look01',cover:'none'});
  assert.equal(female.character,'face07');assert.equal(female.wardrobe,'look07');assert.equal(female.cover,'hijab');
  for(const wardrobe of ['look07','look08','look09','look10'])assert.equal(sanitizeProfile({gender:'female',wardrobe}).wardrobe,wardrobe);
  const male=sanitizeProfile({gender:'male',character:'face07',wardrobe:'look10'});assert.equal(male.character,'face01');assert.equal(male.wardrobe,'look01');
});


test('Outdoor maps allow long walks while keeping visitors out of the Kaaba, Taj Mahal and pool',()=>{
 assert.equal(legalPosition(50,60,'mecca'),true);assert.equal(legalPosition(0,-18,'mecca'),false);
 assert.equal(legalPosition(10,30,'taj'),true);assert.equal(legalPosition(0,30,'taj'),false);assert.equal(legalPosition(0,-50,'taj'),false);
 assert.deepEqual(parseRoom('mecca:3'),{map:'mecca',server:3,key:'mecca:3'});assert.deepEqual(parseRoom('nabawi:1'),{map:'mecca',server:1,key:'mecca:1'});
});
