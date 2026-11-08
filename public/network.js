import {probeRoomIssue} from './server-availability.js';
import {PRAYER_POSES} from './core.js';
export class RoomConnection {
  constructor(handlers){this.handlers=handlers;this.socket=null;this.generation=0;this.retry=0;this.timer=null;this.lastState='';this.selfId=null;this.room='mecca:1';this.sequence=0;this.pending=new Map();this.known=new Map();}
  connect(room=this.room){
    if(this.suspended)return false;
    this.room=room;this.generation++;const generation=this.generation;
    clearTimeout(this.handshakeTimer);clearTimeout(this.timer);if(this.socket){this.socket.onclose=null;this.socket.close();}this.socket=null;this.selfId=null;this.lastState='';this.pending.clear();this.known.clear();
    this.handlers.status('connecting');this.handlers.clear();
    const url=new URL('/api/room',location.href);url.protocol=location.protocol==='https:'?'wss:':'ws:';url.searchParams.set('room',room);
    const ws=new WebSocket(url);this.socket=ws;
    ws.onmessage=e=>{
      if(generation!==this.generation)return;
      let msg;try{msg=JSON.parse(e.data);}catch{return;}
      if(msg.type==='welcome'){
        clearTimeout(this.handshakeTimer);this.retry=0;this.selfId=msg.id;this.handlers.status('connected');this.handlers.welcome(msg.self);this.known.set(msg.self.id,msg.self);
        for(const player of msg.players){this.known.set(player.id,player);this.handlers.player(player);}this.send({type:'profile',motionProtocol:2,profile:this.handlers.profile()});
        this.handlers.count(msg.players.length+1);
        if(msg.congregation)this.handlers.congregation?.(msg.congregation);
      }else if(msg.type==='state'||msg.type==='join'){
        this.receivePlayer(msg.player,true);this.handlers.recount();
      }else if(msg.type==='motion'){
        for(const m of msg.players){const previous=this.known.get(m[0]);if(previous)this.receivePlayer({...previous,id:m[0],seq:m[1],x:m[2],z:m[3],yaw:m[4],pose:PRAYER_POSES[m[5]]||'standing',praying:!!(m[6]&1),protected:!!(m[6]&2)});}this.handlers.recount();
      }else if(msg.type==='leave'){this.known.delete(msg.id);this.handlers.leave(msg.id);this.handlers.recount();}
      else if(typeof msg.type==='string'&&(msg.type.startsWith('party-')||msg.type==='voice-signal'))this.handlers.party?.(msg);
      else if(msg.type==='greeting')this.handlers.greeting?.(msg);
      else if(msg.type==='notice')this.handlers.notice(msg.message);
      else if(msg.type==='chat'||msg.type==='whisper')this.handlers.chat(msg);
      else if(msg.type==='congregation-state'||msg.type==='congregation-error')this.handlers.congregation?.(msg);
    };
    ws.onclose=()=>{
      if(generation!==this.generation)return;
      clearTimeout(this.handshakeTimer);this.socket=null;this.selfId=null;this.handlers.clear();this.handlers.status('offline');
      if(this.handlers.unavailable)void probeRoomIssue(room).then(issue=>{if(!this.suspended&&generation===this.generation&&!this.selfId)this.handlers.unavailable(issue);});
      if(this.retry<5){const delay=Math.min(15000,1000*2**this.retry++);this.timer=setTimeout(()=>{if(!this.suspended&&generation===this.generation)this.connect();},delay);}
    };
    ws.onerror=()=>{};
    this.handshakeTimer=setTimeout(()=>{if(generation===this.generation&&!this.selfId)ws.close();},10000);
  }
  resume(){this.suspended=false;}
  disconnect({notify=false,suspend=false}={}){
    if(notify&&this.selfId){
      const body=JSON.stringify({room:this.room,player:this.selfId});let queued=false;
      try{queued=globalThis.navigator?.sendBeacon?.('/api/leave',new Blob([body],{type:'application/json'}))===true;}catch{}
      if(!queued)try{fetch('/api/leave',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body,keepalive:true}).catch(()=>{});}catch{}
    }
    if(suspend)this.suspended=true;
    this.generation++;clearTimeout(this.handshakeTimer);clearTimeout(this.timer);this.timer=null;
    const ws=this.socket;this.socket=null;this.selfId=null;this.lastState='';this.pending.clear();this.known.clear();
    if(ws){ws.onclose=null;try{ws.close(1000,'Page left');}catch{}}
    this.handlers.clear();this.handlers.status('offline');
  }
  receivePlayer(player,authoritative=false){
    this.known.set(player.id,player);
    if(player.id===this.selfId){
      const sent=this.pending.get(player.seq),correction=sent?{x:player.x-sent.x,z:player.z-sent.z}:null;
      for(const seq of this.pending.keys())if(seq<=player.seq)this.pending.delete(seq);
      this.handlers.self({...player,correction,authoritative});
    }else this.handlers.player(player);
  }
  send(data){if(this.socket?.readyState!==WebSocket.OPEN)return false;this.socket.send(JSON.stringify(data));return true;}
  movement(position,yaw){
    const state={type:'move',x:Math.round(position.x*1000)/1000,z:Math.round(position.z*1000)/1000,yaw:Math.round(yaw*1000)/1000};
    const key=JSON.stringify(state);if(key===this.lastState)return;this.lastState=key;state.seq=++this.sequence;if(this.send(state)){this.pending.set(state.seq,{x:state.x,z:state.z});if(this.pending.size>64)this.pending.delete(this.pending.keys().next().value);}
  }
}
