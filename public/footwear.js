// Shared by the live avatar material and the actual-mesh thumbnail renderer.
export const SOCK_TOP=.18;
export const SOCK_HALF_WIDTH=.4;
export function sockColorFor(id){return id==='model08'?'#303235':'#e9e5dc';}
export function thumbnailName(model){return model.id+(model.gender==='female'?'-covered.png':'.png');}
export function sockShapeParts(feet){
 return ['left','right'].flatMap(key=>{
  const foot=feet[key],width=(foot.max.x-foot.min.x)/2;
  return [
   {center:[foot.center.x,.043,foot.center.z],radii:[width+.003,.046,(foot.max.z-foot.min.z)/2+.005]},
   {center:[foot.center.x,.12,.005],radii:[Math.max(.038,width*.70),.075,.054]}
  ];
 });
}
