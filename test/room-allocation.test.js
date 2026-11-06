import test from 'node:test';
import assert from 'node:assert/strict';
import {recommendedRoom,visibleRooms,consolidationTarget} from '../public/room-allocation.js';
const rooms=counts=>counts.map((count,i)=>({server:i+1,count,capacity:50}));
test('Quiet public rooms gather visitors and expose overflow only when needed',()=>{
 assert.equal(recommendedRoom(rooms([0,0,0])).server,1);
 assert.equal(recommendedRoom(rooms([0,3,1])).server,2);
 assert.equal(recommendedRoom(rooms([2,2,0])).server,1);
 assert.equal(recommendedRoom(rooms([50,0,0])).server,2);
 assert.equal(recommendedRoom(rooms([50,1,4])).server,3);
 assert.equal(recommendedRoom(rooms([50,50,50])),null);
 assert.deepEqual(visibleRooms(rooms([0,3,0])).map(r=>r.server),[2]);
 assert.deepEqual(visibleRooms(rooms([50,0,0])).map(r=>r.server),[1,2]);
 assert.equal(consolidationTarget(rooms([1,4,0]),1).server,2);
 assert.equal(consolidationTarget(rooms([1,4,0]),2),null);
 assert.equal(consolidationTarget(rooms([20,10,0]),2),null);
 assert.equal(consolidationTarget(rooms([0,0,0]),2),null);
});
