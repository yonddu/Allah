export const QUALITY_BUDGETS=Object.freeze({
  low:Object.freeze({asset:'low',dpr:1,maxPixels:550000,fps:30,shadows:false,detailedVisitors:4}),
  balanced:Object.freeze({asset:'high',dpr:1.35,maxPixels:1400000,fps:30,shadows:false,detailedVisitors:5}),
  high:Object.freeze({asset:'high',dpr:1.75,maxPixels:2200000,fps:60,shadows:true,detailedVisitors:8})
});
export function chooseQuality(requested='auto',device={}){
  if(requested==='low'||requested==='high')return requested;
  return device.memory<=4||device.cores<=4||device.software?'low':'balanced';
}
export function pixelRatioFor(width,height,deviceDpr,budget,scale=1){
  const dpr=Math.min(Number.isFinite(deviceDpr)?deviceDpr:1,budget.dpr);
  return Math.min(dpr,Math.sqrt(budget.maxPixels/Math.max(1,width*height)))*Math.min(1,Math.max(.85,scale));
}
export function nextResolutionScale(scale,averageFrameMs){
  return averageFrameMs>47?Math.max(.85,Math.round(scale*.85*100)/100):scale;
}
