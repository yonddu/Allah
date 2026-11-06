import test from 'node:test';
import assert from 'node:assert/strict';
import {qibla,KAABA,sanitizeProfile,DEFAULT_PROFILE,legalPosition,constrainedMove,prayerAreaAllows,canBeginPrayer,validatePost,parseRoom,joystickVector} from '../public/core.js';

test('The Makkah courtyard keeps visitors outside the Kaaba and points prayer toward it',async()=>{
 const {prayerYaw}=await import('../public/core.js');assert.deepEqual(parseRoom('makkah:2'),{map:'makkah',server:2,key:'makkah:2'});
 assert.equal(legalPosition(0,-12,'makkah'),false);assert.equal(legalPosition(0,-23,'makkah'),false);assert.equal(legalPosition(11,-10,'makkah'),false);assert.equal(legalPosition(0,21,'makkah'),true);
 for(const p of [{x:0,z:21},{x:30,z:-12},{x:-30,z:20},{x:0,z:-40}]){
  const yaw=prayerYaw('makkah',p),dx=-p.x,dz=-12-p.z,len=Math.hypot(dx,dz);assert.ok((-Math.sin(yaw)*dx-Math.cos(yaw)*dz)/len>.9999);
 }
});
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
  assert.equal(legalPosition(0,-59),false);assert.equal(legalPosition(75,0),false);
  const wall=constrainedMove({x:73.9,z:3},{x:75,z:3},.1);assert.ok(wall.x<=74);
});
test('Invisible prayer areas block mats/front in either direction and let trapped visitors leave',()=>{
  const host={x:0,z:0,yaw:0};
  assert.equal(prayerAreaAllows({x:2,z:-2},{x:-2,z:-2},host),false);
  assert.equal(prayerAreaAllows({x:-2,z:-2},{x:2,z:-2},host),false);
  assert.equal(prayerAreaAllows({x:2,z:0},{x:0,z:0},host),false);
  assert.equal(prayerAreaAllows({x:2,z:2},{x:-2,z:2},host),true);
  assert.equal(prayerAreaAllows({x:0,z:0},{x:2,z:0},host),true);
  assert.equal(prayerAreaAllows({x:.8,z:0},{x:0,z:0},host),false);
  const turned={x:10,z:10,yaw:Math.PI/2};
  assert.equal(prayerAreaAllows({x:8,z:12},{x:8,z:8},turned),false);
  assert.equal(canBeginPrayer({id:'self',x:0,z:0},[{id:'guest',x:0,z:-1}], 'mecca'),false);
  assert.equal(canBeginPrayer({id:'self',x:0,z:0},[{id:'guest',x:8,z:0}], 'mecca'),true);
  assert.equal(canBeginPrayer({id:'self',x:0,z:83},[], 'mecca'),false);
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


test('Outdoor maps allow long walks while keeping visitors out of the sanctuary, Taj Mahal and pool',()=>{
 assert.equal(legalPosition(50,60,'mecca'),true);assert.equal(legalPosition(0,-59,'mecca'),false);assert.equal(legalPosition(0,-18,'mecca'),true);
 assert.equal(legalPosition(10,30,'taj'),true);assert.equal(legalPosition(0,30,'taj'),false);assert.equal(legalPosition(0,-50,'taj'),false);
 assert.deepEqual(parseRoom('mecca:3'),{map:'mecca',server:3,key:'mecca:3'});assert.deepEqual(parseRoom('nabawi:1'),{map:'mecca',server:1,key:'mecca:1'});
});


test('User model choices cannot bypass gender and head-covering restrictions',()=>{
 assert.equal(sanitizeProfile({gender:'female',model:'model01'}).model,'model08');
 assert.equal(sanitizeProfile({gender:'male',model:'model09'}).model,'model01');
 assert.equal(sanitizeProfile({gender:'female',model:'model10',cover:'none'}).cover,'hijab');
 assert.equal(sanitizeProfile({gender:'female',model:'model10'}).model,'model10');
 assert.equal(sanitizeProfile({model:'https://other.example/evil.glb'}).model,'model01');
});

test('Taj prayer follows the user-marked pool-side path in +Z for both body and mat',async()=>{
 const {prayerYaw}=await import('../public/core.js'),yaw=prayerYaw('taj',{x:10,z:24});assert.ok(Math.abs(Math.sin(yaw))<1e-8);assert.ok(-Math.cos(yaw)>.999);assert.equal(prayerYaw('mecca',{x:0,z:18}),0);
});
