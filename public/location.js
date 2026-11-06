import {coordinatesValid} from './core.js';
// Prayer-time coordinates only: no direction sensors, compass or location marker.
export function initLocation(toast){
 let generation=0;
 const fail=message=>{toast(message);window.dispatchEvent(new CustomEvent('noor:location-error',{detail:{message}}));};
 function setLocation(lat,lon,label,accuracy){
  generation++;
  if(!coordinatesValid(lat,lon)){fail('위도 -90~90, 경도 -180~180 범위의 좌표를 입력해주세요.');return;}
  window.dispatchEvent(new CustomEvent('noor:location',{detail:{lat,lon,label,accuracy}}));
 }
 function useLocation(){
  if(!navigator.geolocation){fail('이 브라우저에서는 위치를 사용할 수 없습니다. 도시나 좌표를 선택해주세요.');return;}
  const request=++generation;
  navigator.geolocation.getCurrentPosition(p=>{if(request===generation)setLocation(p.coords.latitude,p.coords.longitude,'현재 위치',p.coords.accuracy);},e=>{if(request===generation)fail(e.code===1?'위치 권한이 거부되었습니다. 도시·좌표를 직접 선택할 수 있습니다.':'위치를 확인하지 못했습니다. 도시·좌표를 직접 선택해주세요.');},{enableHighAccuracy:false,timeout:15000,maximumAge:60000});
 }
 return {useLocation,setLocation};
}
