import test from 'node:test';import assert from 'node:assert/strict';import {LANTERN_LAYOUT,lanternBrightness} from '../public/lantern-layout.js';import {MAPS,legalPosition} from '../public/core.js';import {congregationSeat} from '../public/congregation-core.js';
test('Lanterns fade at twilight and leave spawns and all fifty congregation places clear',()=>{
 assert.equal(lanternBrightness(1),0);assert.equal(lanternBrightness(0),1);assert.ok(lanternBrightness(.5)>0&&lanternBrightness(.5)<1);
 for(const [map,positions]of Object.entries(LANTERN_LAYOUT)){assert.equal(positions.length,12);assert.ok(legalPosition(MAPS[map].spawn.x,MAPS[map].spawn.z,map));for(const p of positions){assert.equal(legalPosition(p.x,p.z,map),false);assert.ok(legalPosition(p.x+1.2,p.z,map));}for(let i=0;i<50;i++){const seat=congregationSeat(map,i);assert.ok(seat);assert.ok(positions.every(p=>Math.hypot(p.x-seat.x,p.z-seat.z)>2.5));}}
});
