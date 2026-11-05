import {qibla,coordinatesValid} from './core.js';
export function initQibla(toast){
  const $=id=>document.getElementById(id);
  let bearing=null,heading=null,watch=null,listener=null,lastSensor=0,timeout=null;
  function paint(){
    $('compassArrow').style.transform='rotate('+(bearing??0)+'deg)';
    $('compassArrow').style.opacity=bearing===null?'.25':'1';
    $('compass').style.rotate=heading===null?'0deg':(-heading)+'deg';
    $('compass').setAttribute('aria-label',bearing===null?'방향 계산 전':'메카 방위각 '+bearing.toFixed(1)+'도'+(heading===null?' · 북쪽 기준':' · 휴대폰 방향 반영'));
  }
  function update(lat,lon,label,accuracy){
    try{
      const result=qibla(lat,lon);bearing=result.bearing;
      $('bearingValue').replaceChildren(document.createTextNode(bearing===null?'—':bearing.toFixed(1)),Object.assign(document.createElement('span'),{textContent:'°'}));
      $('locationLabel').textContent=label;
      $('distanceValue').textContent=Math.round(result.distance).toLocaleString('ko-KR')+' km · 카바까지';
      $('qiblaStatus').textContent=bearing===null?'카바 바로 근처이거나 방향이 정해지지 않는 지점입니다. 현장 안내를 따라주세요.':heading===null?'북쪽 기준 방향입니다. 지원 휴대폰에서 나침반을 켜면 회전에 따라 움직입니다.':'휴대폰 방향을 반영하고 있습니다. 기기를 평평하게 놓아주세요.';
      if(accuracy>500)$('qiblaStatus').textContent+=' 위치 오차가 큽니다. 열린 장소에서 다시 확인해주세요.';
      paint();
    }catch(e){toast(e.message);}
  }
  $('locationButton').addEventListener('click',()=>{
    if(!navigator.geolocation){toast('이 브라우저에서는 위치를 사용할 수 없습니다. 도시나 좌표를 선택해주세요.');return;}
    if(watch!==null)navigator.geolocation.clearWatch(watch);
    $('locationButton').disabled=true;$('qiblaStatus').textContent='현재 위치를 확인하고 있습니다…';
    watch=navigator.geolocation.watchPosition(p=>{
      $('locationButton').disabled=false;update(p.coords.latitude,p.coords.longitude,'현재 위치',p.coords.accuracy);
    },e=>{
      $('locationButton').disabled=false;
      $('qiblaStatus').textContent=e.code===1?'위치 권한이 거부되었습니다. 도시·좌표를 직접 선택할 수 있습니다.':'위치를 확인하지 못했습니다. 도시·좌표를 직접 선택해주세요.';
      if(watch!==null){navigator.geolocation.clearWatch(watch);watch=null;}
    },{enableHighAccuracy:true,timeout:15000,maximumAge:60000});
  });
  $('citySelect').addEventListener('change',e=>{
    if(!e.target.value)return;
    if(watch!==null){navigator.geolocation.clearWatch(watch);watch=null;}$('locationButton').disabled=false;
    const [lat,lon]=e.target.value.split(',').map(Number);$('latitude').value=lat;$('longitude').value=lon;update(lat,lon,e.target.selectedOptions[0].textContent);
  });
  $('coordinateButton').addEventListener('click',()=>{
    const lat=$('latitude').value,lon=$('longitude').value;
    if(!lat.trim()||!lon.trim()||!coordinatesValid(Number(lat),Number(lon))){toast('위도 -90~90, 경도 -180~180 범위의 좌표를 입력해주세요.');return;}
    if(watch!==null){navigator.geolocation.clearWatch(watch);watch=null;}$('locationButton').disabled=false;
    update(Number(lat),Number(lon),'직접 입력한 위치');
  });
  function stopSensors(){
    if(listener){window.removeEventListener('deviceorientation',listener);window.removeEventListener('deviceorientationabsolute',listener);}
    listener=null;heading=null;clearTimeout(timeout);$('sensorButton').textContent='나침반 켜기';paint();
  }
  $('sensorButton').addEventListener('click',async()=>{
    if(listener){stopSensors();$('qiblaStatus').textContent='북쪽 기준 방위각을 표시합니다.';return;}
    if(!window.isSecureContext||!window.DeviceOrientationEvent){toast('방향 센서를 지원하는 휴대폰의 HTTPS 주소에서 이용해주세요.');return;}
    try{
      if(typeof DeviceOrientationEvent.requestPermission==='function'){
        const permission=await DeviceOrientationEvent.requestPermission(true);
        if(permission!=='granted'){toast('방향 센서 권한이 필요합니다. 북쪽 기준 안내는 계속 사용할 수 있습니다.');return;}
      }
      lastSensor=0;
      listener=e=>{
        let value=null;
        const screenAngle=screen.orientation?.angle||0;
        if(Number.isFinite(e.webkitCompassHeading)){
          if(Number.isFinite(e.webkitCompassAccuracy)&&(e.webkitCompassAccuracy<0||e.webkitCompassAccuracy>35)){
            heading=null;paint();$('qiblaStatus').textContent='나침반 오차가 큽니다. 금속에서 떨어져 기기를 보정해주세요.';return;
          }
          value=e.webkitCompassHeading+screenAngle;
        }else if(e.absolute===true&&Number.isFinite(e.alpha)){
          if(Math.abs(e.beta||0)>65||Math.abs(e.gamma||0)>65){heading=null;paint();$('qiblaStatus').textContent='휴대폰을 평평하게 놓으면 방향을 추적합니다.';return;}
          value=360-e.alpha+screenAngle;
        }
        if(value===null)return;
        lastSensor=Date.now();heading=(value+360)%360;paint();
        $('qiblaStatus').textContent=bearing===null?'위치나 도시를 선택하면 방향 화살표가 표시됩니다.':'휴대폰 방향을 반영하고 있습니다. 실내에서는 센서 오차가 생길 수 있습니다.';
      };
      window.addEventListener('deviceorientationabsolute',listener);window.addEventListener('deviceorientation',listener);
      $('sensorButton').textContent='나침반 끄기';
      timeout=setTimeout(()=>{if(!lastSensor){stopSensors();$('qiblaStatus').textContent='절대 북쪽 센서값을 받지 못했습니다. 북쪽 기준 방위각을 이용해주세요.';}},6000);
    }catch{stopSensors();toast('방향 센서를 사용할 수 없습니다. 북쪽 기준 안내를 이용해주세요.');}
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&listener)stopSensors();});
  window.addEventListener('pagehide',()=>{if(watch!==null)navigator.geolocation.clearWatch(watch);stopSensors();});
}
