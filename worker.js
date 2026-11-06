export {Community} from './community.js';
import {RoomParties} from './party-room.js';
import {sanitizeProfile,constrainedMove,publicPlayer,PRAYER_POSES,prayerAreaAllows,canBeginPrayer,parseRoom,MAPS,legalPosition,prayerYaw} from './public/core.js';
// A server-only override permits isolated capacity tests; production defaults to50.
export const roomCapacity=env=>[32,50,64,100].includes(Number(env?.NOOR_ROOM_CAPACITY))?Number(env.NOOR_ROOM_CAPACITY):50;
async function leavePayload(request){
  if(Number(request.headers.get('Content-Length')||0)>1024)throw new RangeError('Request too large');
  const reader=request.body?.getReader();if(!reader)throw new SyntaxError('Missing body');
  const decoder=new TextDecoder();let size=0,text='';
  try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>1024){await reader.cancel();throw new RangeError('Request too large');}text+=decoder.decode(part.value,{stream:true});}text+=decoder.decode();}
  finally{reader.releaseLock();}
  return JSON.parse(text);
}

export default {
  async fetch(request,env) {
    const url=new URL(request.url);
    if(url.pathname==='/api/health')return Response.json({ok:true,mode:'anonymous-prototype',payments:false});
    if(url.pathname==='/api/leave'&&request.method==='POST'){
      if(request.headers.get('Origin')!==url.origin)return new Response('Origin not allowed',{status:403});
      let data;try{data=await leavePayload(request);}catch(error){return new Response(error instanceof RangeError?'Request too large':'Invalid request',{status:error instanceof RangeError?413:400});}
      const room=parseRoom(data?.room)?.key,player=data?.player;
      if(!room||typeof player!=='string'||!player||player.length>100)return new Response('Invalid room or player',{status:400});
      const identity=await env.COMMUNITY.get(env.COMMUNITY.idFromName('community')).fetch(new Request('https://community.internal/session',{headers:{Cookie:request.headers.get('Cookie')||''}}));
      if(!identity.ok)return new Response('Session required',{status:401});const user=await identity.json();
      return env.ROOMS.get(env.ROOMS.idFromName(room)).fetch(new Request('https://room.internal/leave?player='+encodeURIComponent(player),{method:'POST',headers:{'X-Noor-Account':user.id}}));
    }
    if(url.pathname==='/api/voice/ice'&&request.method==='GET'){
      if(request.headers.get('Origin')&&request.headers.get('Origin')!==url.origin)return new Response('Origin not allowed',{status:403});
      const room=parseRoom(url.searchParams.get('room'))?.key,player=url.searchParams.get('player');if(!room||!player)return new Response('Invalid room',{status:400});
      const identity=await env.COMMUNITY.get(env.COMMUNITY.idFromName('community')).fetch(new Request('https://community.internal/session',{headers:{Cookie:request.headers.get('Cookie')||''}}));
      if(!identity.ok)return new Response('Session required',{status:401});const user=await identity.json();
      const allowed=await env.ROOMS.get(env.ROOMS.idFromName(room)).fetch(new Request('https://room.internal/voice-authorize?player='+encodeURIComponent(player),{headers:{'X-Noor-Account':user.id}}));
      if(!allowed.ok)return new Response('Voice membership required',{status:403});
      if(env.NOOR_VOICE_TEST_MODE==='1')return Response.json({iceServers:[],relayOnly:false,expiresAt:Date.now()+3600000},{headers:{'Cache-Control':'no-store'}});
      if(!env.NOOR_TURN_KEY_ID||!env.NOOR_TURN_API_TOKEN)return new Response('Voice relay unavailable',{status:503});
      try{
        const response=await fetch('https://rtc.live.cloudflare.com/v1/turn/keys/'+env.NOOR_TURN_KEY_ID+'/credentials/generate-ice-servers',{method:'POST',headers:{Authorization:'Bearer '+env.NOOR_TURN_API_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({ttl:3600}),signal:AbortSignal.timeout(10000)});
        if(!response.ok)throw new Error('Relay unavailable');const data=await response.json();
        return Response.json({iceServers:data.iceServers,relayOnly:true,expiresAt:Date.now()+3500000},{headers:{'Cache-Control':'no-store'}});
      }catch{return new Response('Voice relay unavailable',{status:503});}
    }
    if(url.pathname==='/api/rooms'&&request.method==='GET'){
      const requested=url.searchParams.get('map')||'mecca',map=parseRoom(requested+':1')?.map;
      if(!map)return new Response('Unknown map',{status:400});
      const rooms=await Promise.all([1,2,3].map(async server=>{
        const key=map+':'+server,r=await env.ROOMS.get(env.ROOMS.idFromName(key)).fetch('https://room.internal/status'),status=await r.json();
        return {key,server,count:status.count,capacity:roomCapacity(env)};
      }));
      return Response.json({rooms},{headers:{'Cache-Control':'no-store'}});
    }
    if(url.pathname==='/api/room'){
      if(request.headers.get('Upgrade')?.toLowerCase()!=='websocket')return new Response('WebSocket required',{status:426});
      // Only browser connections from this origin. Coordinates are never sent here.
      if(request.headers.get('Origin')!==url.origin)return new Response('Origin not allowed',{status:403});
      const requestedRoom=url.searchParams.get('room')||'mecca:1',room=parseRoom(requestedRoom)?.key;
      if(!room)return new Response('Unknown room',{status:404});
      const identity=await env.COMMUNITY.get(env.COMMUNITY.idFromName('community')).fetch(new Request('https://community.internal/session',{headers:{Cookie:request.headers.get('Cookie')||''}}));
      if(!identity.ok)return new Response('Session required',{status:401});
      const user=await identity.json(),headers=new Headers(request.headers);
      headers.set('X-Noor-Room',room);headers.set('X-Noor-Account',user.id);headers.set('X-Noor-Name',encodeURIComponent(user.name));
      return env.ROOMS.get(env.ROOMS.idFromName(room)).fetch(new Request(request,{headers}));
    }
    if(['/api/session','/api/social','/api/posts','/api/friends/request','/api/friends/respond','/api/friends/remove','/api/chat/preferences','/api/blocks'].includes(url.pathname)||/^\/api\/posts\/[a-f0-9-]{36}$/.test(url.pathname))return env.COMMUNITY.get(env.COMMUNITY.idFromName('community')).fetch(request);
    if(url.pathname.startsWith('/api/'))return new Response('Not found',{status:404});
    return env.ASSETS.fetch(request);
  }
};

export class PrayerRoom {
  constructor(ctx,env){
    this.ctx=ctx;this.env=env;this.parties=new RoomParties(this);this.pendingMoves=new Map();this.flushTimer=null;this.batchClients=new Set();this.protectedSockets=new Set();
    for(const ws of ctx.getWebSockets()){const state=ws.deserializeAttachment();if(state?.motionProtocol===2)this.batchClients.add(ws);if(state?.praying)this.protectedSockets.add(ws);}
  }
  async access(ids){const r=await this.env.COMMUNITY.get(this.env.COMMUNITY.idFromName('community')).fetch('https://community.internal/access?ids='+ids.join(','));if(!r.ok)throw new Error('Access lookup failed');return r.json();}
  players(){return this.ctx.getWebSockets().map(ws=>({ws,state:ws.deserializeAttachment()})).filter(p=>p.state);}
  send(ws,message){try{ws.send(JSON.stringify(message));}catch{try{ws.close(1011,'Connection closed');}catch{}}}
  broadcast(message,except){const raw=JSON.stringify(message);for(const ws of this.ctx.getWebSockets())if(ws!==except){try{ws.send(raw);}catch{try{ws.close(1011,'Connection closed');}catch{}}}}
  queueMovement(player){
    this.pendingMoves.set(player.id,player);if(this.flushTimer)return;
    let done;const flushed=new Promise(resolve=>{done=resolve;});this.ctx.waitUntil?.(flushed);
    this.flushTimer=setTimeout(()=>{try{this.flushMovement();}finally{done();}},75);
  }
  flushMovement(){
    clearTimeout(this.flushTimer);this.flushTimer=null;
    const players=[...this.pendingMoves.values()];this.pendingMoves.clear();if(!players.length)return;
    const round=n=>Math.round(n*1000)/1000;
    const batch=JSON.stringify({type:'motion',players:players.map(p=>[p.id,p.seq,round(p.x),round(p.z),round(p.yaw),PRAYER_POSES.indexOf(p.pose),(p.praying?1:0)|(p.protected?2:0)])});
    let legacy;
    for(const ws of this.ctx.getWebSockets()){
      try{if(this.batchClients.has(ws))ws.send(batch);else{legacy??=players.map(player=>JSON.stringify({type:'state',player}));for(const message of legacy)ws.send(message);}}
      catch{try{ws.close(1011,'Connection closed');}catch{}}
    }
  }
  async fetch(request){
    if(new URL(request.url).pathname==='/leave'&&request.method==='POST'){
      const account=request.headers.get('X-Noor-Account');if(!account)return new Response('Session required',{status:401});
      const id=new URL(request.url).searchParams.get('player'),peer=this.players().find(p=>p.state.id===id&&p.state.accountId===account);
      if(peer)this.webSocketClose(peer.ws,1000);return new Response(null,{status:204});
    }
    if(new URL(request.url).pathname==='/voice-authorize')return new Response(null,{status:this.parties.authorize(request.headers.get('X-Noor-Account'),new URL(request.url).searchParams.get('player'))?204:403});
    if(new URL(request.url).pathname==='/status')return Response.json({count:this.players().length});
    if(request.headers.get('Upgrade')?.toLowerCase()!=='websocket')return new Response('WebSocket required',{status:426});
    const accountId=request.headers.get('X-Noor-Account');if(!accountId)return new Response('Session required',{status:401});
    const peers=this.players();
    if(peers.length>=roomCapacity(this.env))return new Response('기도원이 가득 찼습니다. 잠시 후 다시 입장해주세요.',{status:503});
    const pair=new WebSocketPair(),client=pair[0],server=pair[1];
    this.ctx.acceptWebSocket(server);
    // Pick an unoccupied spawn; reconnects never accept client-supplied identity/position.
    const map=parseRoom(request.headers.get('X-Noor-Room'))?.map||'mecca',base=MAPS[map].spawn;let spawn={...base};
    for(let n=0;n<100;n++){
      const x=base.x+(n%10)*2.5,z=base.z+Math.floor(n/10)*3;
      if(legalPosition(x,z,map)&&peers.every(p=>Math.hypot(x-p.state.x,z-p.state.z)>(p.state.praying?4:1.5))){spawn={x,z};break;}
    }
    const now=Date.now(),state={id:crypto.randomUUID(),map,accountId,protected:false,profile:sanitizeProfile({name:decodeURIComponent(request.headers.get('X-Noor-Name')||'')}),...spawn,yaw:Math.PI,praying:false,pose:'standing',lastMove:now,rateAt:now,tokens:30,profileAt:0};
    server.serializeAttachment(state);
    this.send(server,{type:'welcome',id:state.id,self:publicPlayer(state),players:peers.map(p=>publicPlayer(p.state))});
    this.broadcast({type:'join',player:publicPlayer(state)},server);
    return new Response(null,{status:101,webSocket:client});
  }
  async webSocketMessage(ws,message){return this.ctx.blockConcurrencyWhile(()=>this.handleMessage(ws,message));}
  async handleMessage(ws,message){
    if(typeof message!=='string'||message.length>16384){ws.close(1009,'Message too large');return;}
    const state=ws.deserializeAttachment();if(!state)return;
    const now=Date.now();
    state.tokens=Math.min(30,state.tokens+Math.max(0,now-state.rateAt)*0.025);
    state.rateAt=now;
    if(state.tokens<1){ws.serializeAttachment(state);return;}
    state.tokens--;
    let data;
    try{data=JSON.parse(message);}catch{ws.serializeAttachment(state);return;}
    if(!data||typeof data!=='object'){ws.serializeAttachment(state);return;}
    if(typeof data.type==='string'&&data.type.startsWith('party-')||data.type==='voice-signal'){await this.parties.handle(ws,state,data);return;}
    if(message.length>2048){ws.close(1009,'Message too large');return;}
    if(data.type==='greeting'){
      if(state.praying||now-(state.greetingAt||0)<5000){ws.serializeAttachment(state);return;}
      const peers=this.players(),access=await this.access(peers.map(p=>p.state.accountId));
      const target=typeof data.to==='string'?peers.find(p=>p.state.accountId===data.to&&!p.state.praying&&p.state.accountId!==state.accountId):null;
      if(data.to&&(!target||(access[target.state.accountId]?.blocked||[]).includes(state.accountId)||(access[state.accountId]?.blocked||[]).includes(target.state.accountId))){ws.serializeAttachment(state);return;}
      if(target)state.yaw=Math.atan2(state.x-target.state.x,state.z-target.state.z);
      state.greetingAt=now;ws.serializeAttachment(state);
      if(target){this.pendingMoves.delete(state.id);this.broadcast({type:'state',player:publicPlayer(state)});}
      const item={type:'greeting',id:state.id,accountId:state.accountId,at:now,...(target?{to:target.state.accountId,targetPlayerId:target.state.id}:{})};
      for(const peer of peers)if(!peer.state.praying&&!(access[peer.state.accountId]?.blocked||[]).includes(state.accountId)&&!(access[state.accountId]?.blocked||[]).includes(peer.state.accountId))this.send(peer.ws,item);
      return;
    }
    if(data.type==='chat'||data.type==='whisper'){
      if(state.praying){ws.serializeAttachment(state);return;}
      const text=typeof data.text==='string'?data.text.trim().slice(0,280):'';
      if(!text||now-(state.chatAt||0)<1200){ws.serializeAttachment(state);return;}
      state.chatAt=now;ws.serializeAttachment(state);
      const peers=this.players(),access=await this.access(peers.map(p=>p.state.accountId));
      const sender=access[state.accountId];if(!sender)return;
      const fail=()=>this.send(ws,{type:'notice',message:'메시지를 전달할 수 없습니다. 채팅 설정과 접속 상태를 확인해주세요.'});
      const blocked=(a,id)=>(a?.blocked||[]).includes(id);
      if(data.type==='whisper'){
        const targetId=typeof data.to==='string'?data.to:'',recipient=access[targetId];
        if(targetId===state.accountId||sender.whispers===false||!recipient||recipient.whispers===false||blocked(recipient,state.accountId)||blocked(sender,targetId)||!peers.some(p=>p.state.accountId===targetId&&!p.state.praying)){fail();return;}
        const item={type:'whisper',id:crypto.randomUUID(),accountId:state.accountId,name:state.profile.name,to:targetId,toName:recipient.name,text,at:now};
        // A private message is delivered to these two accounts only, including their other room tabs.
        for(const peer of peers)if(!peer.state.praying&&(peer.state.accountId===state.accountId||peer.state.accountId===targetId))this.send(peer.ws,item);
        return;
      }
      if(sender.publicChat===false){fail();return;}
      const item={type:'chat',id:crypto.randomUUID(),playerId:state.id,accountId:state.accountId,name:state.profile.name,text,at:now};
      for(const peer of peers){
        const viewer=access[peer.state.accountId];
        if(!peer.state.praying&&viewer&&viewer.publicChat!==false&&!blocked(viewer,state.accountId)&&!blocked(sender,peer.state.accountId)&&(!viewer.premium||peer.state.accountId===state.accountId||viewer.friends.includes(state.accountId)))this.send(peer.ws,item);
      }
      return;
    }
    if(data.type==='profile'){
      if(now-state.profileAt<300){ws.serializeAttachment(state);return;}
      state.profile=sanitizeProfile(data.profile);state.profileAt=now;if(data.motionProtocol===2){state.motionProtocol=2;this.batchClients.add(ws);}
    }else if(data.type==='move'){
      if(Number.isSafeInteger(data.seq)&&data.seq>=0)state.seq=data.seq;
      if(!state.praying){
        const elapsed=Math.max(0,now-state.lastMove)/1000;
        const next=constrainedMove(state,data,elapsed,state.map);
        const hosts=this.protectedSockets.size?this.players().filter(p=>p.state.praying&&p.ws!==ws):[];
        const allowed=hosts.every(p=>prayerAreaAllows(state,next,p.state));
        if(allowed)Object.assign(state,next);
        if(Number.isFinite(data.yaw))state.yaw=((data.yaw%(Math.PI*2))+Math.PI*2)%(Math.PI*2);
      }
      state.lastMove=now;
    }else if(data.type==='prayer'){
      if(data.active===true&&!state.praying&&!canBeginPrayer(state,this.players().map(p=>p.state),state.map||'mecca')){
        ws.serializeAttachment(state);this.pendingMoves.delete(state.id);
        this.send(ws,{type:'state',player:publicPlayer(state)});
        this.send(ws,{type:'notice',message:'다른 이용자와 건물에서 조금 떨어진 곳에서 기도를 시작해주세요.'});return;
      }
      state.praying=data.active===true;
      state.pose=state.praying&&PRAYER_POSES.includes(data.pose)?data.pose:'standing';
      state.protected=state.praying;
      if(state.praying){
        state.yaw=prayerYaw(state.map||'mecca',state);
        this.parties.silence(ws,state);
      }
      if(state.protected)this.protectedSockets.add(ws);else this.protectedSockets.delete(ws);
      state.lastMove=now;
    }else if(data.type==='protect'){
      // Old clients cannot opt out of another visitor's prayer boundary.
      ws.serializeAttachment(state);return;
    }else{ws.serializeAttachment(state);return;}
    ws.serializeAttachment(state);
    if(data.type==='move')this.queueMovement(publicPlayer(state));else{this.pendingMoves.delete(state.id);this.broadcast({type:'state',player:publicPlayer(state)});}
  }
  webSocketClose(ws,code){
    this.batchClients.delete(ws);this.protectedSockets.delete(ws);
    const state=ws.deserializeAttachment();this.parties.closed(ws,state);if(state)this.pendingMoves.delete(state.id);
    ws.serializeAttachment(null);
    try{ws.close(code===1006?1000:code,'Disconnected');}catch{}
    if(state)this.broadcast({type:'leave',id:state.id},ws);
  }
  webSocketError(ws){this.webSocketClose(ws,1011);}
}
