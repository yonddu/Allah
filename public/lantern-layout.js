const pairs=(x,zs)=>zs.flatMap(z=>[{x:-x,z},{x,z}]);
export const LANTERN_LAYOUT=Object.freeze({
 mecca:[...pairs(9,[6,32,58]),...pairs(52,[-12,24,60])],
 makkah:[...pairs(16,[10,38,64]),...pairs(50,[-32,6,44])],
 taj:[...pairs(10,[14,38,62]),...pairs(52,[0,28,56])]
});
export function lanternBrightness(daylight){const t=Math.max(0,Math.min(1,(.78-daylight)/.62));return t*t*(3-2*t);}
