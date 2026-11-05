export {Community} from './community.js';
import {sanitizeProfile,constrainedMove,publicPlayer,PRAYER_POSES,fenceAllows,parseRoom,MAPS,legalPosition,prayerYaw} from './public/core.js';

export default {
  async fetch(request,env) {
    const url=new URL(request.url);
    if(url.pathname==='/api/health')return Response.json({ok:true,mode:'anonymous-prototype',payments:false});
    if(url.pathname==='/api/rooms'&&request.method==='GET'){
      const requested=url.searchParams.get('map')||'mecca',map=parseRoom(requested+':1')?.map;
      if(!map)return new Response('Unknown map',{status:400});
      const rooms=await Promise.all([1,2,3].map(async server=>{
        const key=map+':'+server,r=await env.ROOMS.get(env.ROOMS.idFromName(key)).fetch('https://room.internal/status'),status=await r.json();
        return {key,server,count:status.count,capacity:32};
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
  constructor(ctx,env){this.ctx=ctx;this.env=env;}
  async access(ids){const r=await this.env.COMMUNITY.get(this.env.COMMUNITY.idFromName('community')).fetch('https://community.internal/access?ids='+ids.join(','));if(!r.ok)throw new Error('Access lookup failed');return r.json();}
  players(){return this.ctx.getWebSockets().map(ws=>({ws,state:ws.deserializeAttachment()})).filter(p=>p.state);}
  send(ws,message){try{ws.send(JSON.stringify(message));}catch{try{ws.close(1011,'Connection closed');}catch{}}}
  broadcast(message,except){for(const {ws}of this.players())if(ws!==except)this.send(ws,message);}
  async fetch(request){
    if(new URL(request.url).pathname==='/status')return Response.json({count:this.players().length});
    if(request.headers.get('Upgrade')?.toLowerCase()!=='websocket')return new Response('WebSocket required',{status:426});
    const accountId=request.headers.get('X-Noor-Account');if(!accountId)return new Response('Session required',{status:401});
    const peers=this.players();
    if(peers.length>=32)return new Response('기도원이 가득 찼습니다. 잠시 후 다시 입장해주세요.',{status:503});
    const pair=new WebSocketPair(),client=pair[0],server=pair[1];
    this.ctx.acceptWebSocket(server);
    // Pick an unoccupied spawn; reconnects never accept client-supplied identity/position.
    const map=parseRoom(request.headers.get('X-Noor-Room'))?.map||'mecca',base=MAPS[map].spawn;let spawn={...base};
    for(let n=0;n<100;n++){
      const x=base.x+(n%10)*2.5,z=base.z+Math.floor(n/10)*3;
      if(legalPosition(x,z,map)&&peers.every(p=>Math.hypot(x-p.state.x,z-p.state.z)>(p.state.protected?3.2:1.5))){spawn={x,z};break;}
    }
    const now=Date.now(),state={id:crypto.randomUUID(),map,accountId,protected:false,profile:sanitizeProfile({name:decodeURIComponent(request.headers.get('X-Noor-Name')||'')}),...spawn,yaw:Math.PI,praying:false,pose:'standing',lastMove:now,rateAt:now,tokens:30,profileAt:0};
    server.serializeAttachment(state);
    this.send(server,{type:'welcome',id:state.id,self:publicPlayer(state),players:peers.map(p=>publicPlayer(p.state))});
    this.broadcast({type:'join',player:publicPlayer(state)},server);
    return new Response(null,{status:101,webSocket:client});
  }
  async webSocketMessage(ws,message){return this.ctx.blockConcurrencyWhile(()=>this.handleMessage(ws,message));}
  async handleMessage(ws,message){
    if(typeof message!=='string'||message.length>2048){ws.close(1009,'Message too large');return;}
    const state=ws.deserializeAttachment();if(!state)return;
    const now=Date.now();
    state.tokens=Math.min(30,state.tokens+Math.max(0,now-state.rateAt)*0.025);
    state.rateAt=now;
    if(state.tokens<1){ws.serializeAttachment(state);return;}
    state.tokens--;
    let data;
    try{data=JSON.parse(message);}catch{ws.serializeAttachment(state);return;}
    if(!data||typeof data!=='object'){ws.serializeAttachment(state);return;}
    if(data.type==='chat'||data.type==='whisper'){
      const text=typeof data.text==='string'?data.text.trim().slice(0,280):'';
      if(!text||now-(state.chatAt||0)<1200){ws.serializeAttachment(state);return;}
      state.chatAt=now;ws.serializeAttachment(state);
      const peers=this.players(),access=await this.access(peers.map(p=>p.state.accountId));
      const sender=access[state.accountId];if(!sender)return;
      const fail=()=>this.send(ws,{type:'notice',message:'메시지를 전달할 수 없습니다. 채팅 설정과 접속 상태를 확인해주세요.'});
      const blocked=(a,id)=>(a?.blocked||[]).includes(id);
      if(data.type==='whisper'){
        const targetId=typeof data.to==='string'?data.to:'',recipient=access[targetId];
        if(targetId===state.accountId||sender.whispers===false||!recipient||recipient.whispers===false||blocked(recipient,state.accountId)||blocked(sender,targetId)||!peers.some(p=>p.state.accountId===targetId)){fail();return;}
        const item={type:'whisper',id:crypto.randomUUID(),accountId:state.accountId,name:state.profile.name,to:targetId,toName:recipient.name,text,at:now};
        // A private message is delivered to these two accounts only, including their other room tabs.
        for(const peer of peers)if(peer.state.accountId===state.accountId||peer.state.accountId===targetId)this.send(peer.ws,item);
        return;
      }
      if(sender.publicChat===false){fail();return;}
      const item={type:'chat',id:crypto.randomUUID(),accountId:state.accountId,name:state.profile.name,text,at:now};
      for(const peer of peers){
        const viewer=access[peer.state.accountId];
        if(viewer&&viewer.publicChat!==false&&!blocked(viewer,state.accountId)&&!blocked(sender,peer.state.accountId)&&(!viewer.premium||peer.state.accountId===state.accountId||viewer.friends.includes(state.accountId)))this.send(peer.ws,item);
      }
      return;
    }
    if(data.type==='profile'){
      if(now-state.profileAt<300){ws.serializeAttachment(state);return;}
      state.profile=sanitizeProfile(data.profile);state.profileAt=now;
    }else if(data.type==='move'){
      if(Number.isSafeInteger(data.seq)&&data.seq>=0)state.seq=data.seq;
      if(!state.praying){
        const elapsed=Math.max(0,now-state.lastMove)/1000;
        const next=constrainedMove(state,data,elapsed,state.map);
        const hosts=this.players().filter(p=>p.state.protected&&p.state.praying);
        const access=hosts.length?await this.access(hosts.map(p=>p.state.accountId)):{};
        const allowed=hosts.every(p=>!access[p.state.accountId]?.premium||fenceAllows(state,next,p.state,state.accountId,access[p.state.accountId].friends));
        if(allowed)Object.assign(state,next);
        if(Number.isFinite(data.yaw))state.yaw=((data.yaw%(Math.PI*2))+Math.PI*2)%(Math.PI*2);
      }
      state.lastMove=now;
    }else if(data.type==='prayer'){
      state.praying=data.active===true;
      state.pose=state.praying&&PRAYER_POSES.includes(data.pose)?data.pose:'standing';
      state.protected=false;
      if(state.praying){
        state.yaw=prayerYaw(state.map||'mecca',state);
        const rights=(await this.access([state.accountId]))[state.accountId];
        const clear=this.players().every(p=>p.ws===ws||rights?.friends.includes(p.state.accountId)||Math.hypot(p.state.x-state.x,p.state.z-state.z)>3);
        state.protected=!!rights?.premium&&clear&&Math.abs(state.x)<MAPS[state.map||'mecca'].bounds.x-3&&Math.abs(state.z)<MAPS[state.map||'mecca'].bounds.z-3;
        if(rights?.premium&&!state.protected)this.send(ws,{type:'notice',message:'펜스는 중앙 통로를 피해 다른 사람과 충분히 떨어진 곳에서 펼칠 수 있습니다.'});
      }
      state.lastMove=now;
    }else if(data.type==='protect'){
      // No client-controlled paid flag. A signed billing webhook + account auth is required before enabling.
      this.send(ws,{type:'notice',message:'펜스는 현재 개인 미리보기만 제공됩니다. 결제는 활성화되지 않았습니다.'});
      ws.serializeAttachment(state);return;
    }else{ws.serializeAttachment(state);return;}
    ws.serializeAttachment(state);
    this.broadcast({type:'state',player:publicPlayer(state)});
  }
  webSocketClose(ws,code){
    const state=ws.deserializeAttachment();
    try{ws.close(code===1006?1000:code,'Disconnected');}catch{}
    if(state)this.broadcast({type:'leave',id:state.id},ws);
  }
  webSocketError(ws){try{ws.close(1011,'Connection error');}catch{}}
}
