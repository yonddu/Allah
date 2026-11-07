export const ABU_DHABI=Object.freeze({lat:24.4128,lon:54.475,zone:'Asia/Dubai',label:'Abu Dhabi'});
const rad=x=>x*Math.PI/180,p=rad(ABU_DHABI.lat),k=rad(21.422487),d=rad(39.826206-ABU_DHABI.lon);
export const ABU_QIBLA_BEARING=(Math.atan2(Math.sin(d)*Math.cos(k),Math.cos(p)*Math.sin(k)-Math.sin(p)*Math.cos(k)*Math.cos(d))*180/Math.PI+360)%360;
export const ABU_YAW=-ABU_QIBLA_BEARING*Math.PI/180;
export function rotateMapPoint(point,yaw=ABU_YAW){return {x:point.x*Math.cos(yaw)+point.z*Math.sin(yaw),z:-point.x*Math.sin(yaw)+point.z*Math.cos(yaw)};}
