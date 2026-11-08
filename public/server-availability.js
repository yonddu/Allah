// A full room is confirmed by the directory; a failed fetch alone is never
// evidence of heavy traffic. Keep this independent of the 3D renderer.
export function availabilityIssue({status=0,rooms=[],server}={}){
  if(status===429||status===503)return 'busy';
  if(status>=500)return 'unavailable';
  if(status>=400)return 'connection';
  const full=room=>Number.isFinite(room.count)&&Number.isFinite(room.capacity)&&room.capacity>0&&room.count>=room.capacity;
  if(rooms.length&&(server?rooms.some(room=>room.server===server&&full(room)):rooms.every(full)))return 'full';
  return 'connection';
}

export async function probeRoomIssue(room,{fetcher=fetch}={}){
  try{
    const [map,server]=room.split(':');
    const response=await fetcher('/api/rooms?map='+encodeURIComponent(map),{cache:'no-store',signal:AbortSignal.timeout(6000)});
    if(!response.ok)return availabilityIssue({status:response.status});
    const data=await response.json();
    return availabilityIssue({rooms:Array.isArray(data.rooms)?data.rooms:[],server:Number(server)});
  }catch{return 'connection';}
}

export function initServerNotice({text,retry,document:doc=document,window:win=window}){
  const panel=doc.getElementById('serverNotice'),message=doc.getElementById('serverNoticeMessage'),button=doc.getElementById('serverRetry');
  let issue='connection',pending=false;
  const render=()=>{
    message.textContent=text(issue);
    for(const element of panel.querySelectorAll('[data-availability]'))element.textContent=text(element.dataset.availability);
    doc.getElementById('serverNoticeClose').setAttribute('aria-label',text('dismiss'));
  };
  doc.getElementById('serverNoticeClose').addEventListener('click',()=>{panel.hidden=true;});
  button.addEventListener('click',async()=>{
    if(pending)return;pending=true;button.disabled=true;
    try{await retry();}finally{pending=false;button.disabled=false;}
  });
  win.addEventListener('languagechange',render);render();
  return {show(value='connection'){issue=value;render();panel.hidden=false;},hide(){panel.hidden=true;}};
}
