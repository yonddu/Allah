// Fill occupied public rooms first. Empty overflow rooms open only when needed.
export function recommendedRoom(rooms=[]){
 const available=rooms.filter(r=>Number.isFinite(r.count)&&Number.isFinite(r.capacity)&&r.count<r.capacity);
 return available.sort((a,b)=>b.count-a.count||a.server-b.server)[0]||null;
}
export function visibleRooms(rooms=[]){
 const next=recommendedRoom(rooms);
 return rooms.filter(r=>r.count>0||r.server===next?.server);
}
export function consolidationTarget(rooms,currentServer){
 const total=rooms.reduce((n,r)=>n+r.count,0),capacity=rooms[0]?.capacity||50,next=recommendedRoom(rooms);
 // Keep a quiet room together; never migrate a crowd that needs several rooms.
 return total<=Math.min(25,capacity)&&next&&next.count>0&&next.server!==currentServer?next:null;
}
