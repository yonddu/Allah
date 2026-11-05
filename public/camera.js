export const PLAY_CAMERA=Object.freeze({distance:5.2,height:1.6,fov:80});
export function avatarFocus(pose,praying){
 if(!praying||pose==='standing')return {height:.94,forward:0};
 if(pose==='bowing')return {height:.72,forward:.22};
 if(pose==='sitting')return {height:.58,forward:.10};
 return {height:.36,forward:.32};
}
