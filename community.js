import {sanitizeProfile,validatePost} from './public/core.js';
const json=(data,status=200,headers={})=>Response.json(data,{status,headers:{'Cache-Control':'no-store',...headers}});
const hash=async value=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(b=>b.toString(16).padStart(2,'0')).join('');
const cookieToken=request=>(request.headers.get('Cookie')||'').split(';').map(p=>p.trim()).find(p=>p.startsWith('noor_session='))?.slice(13);
export class Community {
  constructor(ctx,env){
    this.ctx=ctx;this.env=env;this.sql=ctx.storage.sql;
    this.sql.exec('CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, token_hash TEXT UNIQUE NOT NULL, code TEXT UNIQUE NOT NULL, name TEXT NOT NULL, premium_until INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS friendships (sender TEXT NOT NULL, receiver TEXT NOT NULL, accepted INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL, PRIMARY KEY(sender,receiver))');
    this.sql.exec('CREATE TABLE IF NOT EXISTS posts (id TEXT PRIMARY KEY, category TEXT NOT NULL, author_id TEXT NOT NULL, author TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL, created INTEGER NOT NULL)');
    this.sql.exec('CREATE INDEX IF NOT EXISTS posts_category_created ON posts(category,created DESC)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS rate_limits (actor TEXT NOT NULL, kind TEXT NOT NULL, bucket INTEGER NOT NULL, count INTEGER NOT NULL, PRIMARY KEY(actor,kind,bucket))');
    this.sql.exec('CREATE TABLE IF NOT EXISTS chat_preferences (owner TEXT PRIMARY KEY, public_chat INTEGER NOT NULL DEFAULT 1, whispers INTEGER NOT NULL DEFAULT 1)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS blocks (owner TEXT NOT NULL, target TEXT NOT NULL, created INTEGER NOT NULL, PRIMARY KEY(owner,target))');
  }
  one(query,...args){return this.sql.exec(query,...args).toArray()[0];}
  friends(id){return this.sql.exec('SELECT u.id,u.code,u.name FROM friendships f JOIN users u ON u.id=CASE WHEN f.sender=? THEN f.receiver ELSE f.sender END WHERE (f.sender=? OR f.receiver=?) AND f.accepted=1',id,id,id).toArray();}
  privacy(id){
    const prefs=this.one('SELECT public_chat,whispers FROM chat_preferences WHERE owner=?',id);
    return {publicChat:prefs?.public_chat!==0,whispers:prefs?.whispers!==0,blocked:this.sql.exec('SELECT u.id,u.name FROM blocks b JOIN users u ON u.id=b.target WHERE b.owner=? ORDER BY b.created DESC',id).toArray()};
  }
  access(id){
    const user=this.one('SELECT id,name,premium_until FROM users WHERE id=?',id);
    if(!user)return null;
    const privacy=this.privacy(id),blocked=privacy.blocked.map(p=>p.id);
    return {id:user.id,name:user.name,premium:user.premium_until>Date.now(),friends:this.friends(id).map(f=>f.id).filter(friend=>!blocked.includes(friend)),publicChat:privacy.publicChat,whispers:privacy.whispers,blocked};
  }
  view(user){
    return {id:user.id,name:user.name,code:user.code,premium:user.premium_until>Date.now(),friends:this.friends(user.id),...this.privacy(user.id),
      incoming:this.sql.exec('SELECT u.id,u.name,u.code FROM friendships f JOIN users u ON u.id=f.sender WHERE f.receiver=? AND f.accepted=0',user.id).toArray(),
      outgoing:this.sql.exec('SELECT u.id,u.name,u.code FROM friendships f JOIN users u ON u.id=f.receiver WHERE f.sender=? AND f.accepted=0',user.id).toArray()};
  }
  async user(request){
    const token=cookieToken(request);if(!token||!/^[a-f0-9]{64}$/.test(token))return null;
    return this.one('SELECT * FROM users WHERE token_hash=?',await hash(token))||null;
  }
  rate(actor,kind,limit,seconds){
    const bucket=Math.floor(Date.now()/1000/seconds),record=this.one('SELECT count FROM rate_limits WHERE actor=? AND kind=? AND bucket=?',actor,kind,bucket);
    if(record&&record.count>=limit)return false;
    this.sql.exec('INSERT INTO rate_limits(actor,kind,bucket,count) VALUES(?,?,?,1) ON CONFLICT(actor,kind,bucket) DO UPDATE SET count=count+1',actor,kind,bucket);
    if(Math.random()<.01)this.sql.exec('DELETE FROM rate_limits WHERE bucket < ? AND kind=?',bucket-2,kind);
    return true;
  }
  async fetch(request){
    const url=new URL(request.url),path=url.pathname;
    if(url.hostname==='community.internal'){
      if(path==='/session'){const user=await this.user(request);return user?json(this.view(user)):json({error:'Session required'},401);}
      if(path==='/access'){const ids=(url.searchParams.get('ids')||'').split(',').slice(0,32);return json(Object.fromEntries(ids.map(id=>[id,this.access(id)])));}
      return json({error:'Not found'},404);
    }
    const mutating=request.method!=='GET';
    if(mutating&&request.headers.get('Origin')!==url.origin)return json({error:'허용되지 않은 요청입니다.'},403);
    if(Number(request.headers.get('Content-Length')||0)>12000)return json({error:'요청이 너무 큽니다.'},413);
    let data={};
    if(mutating&&request.method!=='DELETE'){
      try{const raw=await request.text();if(raw.length>12000)return json({error:'요청이 너무 큽니다.'},413);data=JSON.parse(raw);}
      catch{return json({error:'입력 형식을 확인해주세요.'},400);}
      if(!data||typeof data!=='object')return json({error:'입력 형식을 확인해주세요.'},400);
    }
    let user=await this.user(request);
    const ipHash=await hash(request.headers.get('CF-Connecting-IP')||'local-development');
    if(path==='/api/session'&&request.method==='POST'){
      const name=sanitizeProfile({name:data.name}).name;
      if(!user){
        if(!this.rate(ipHash,'register',10,3600))return json({error:'새 계정 생성이 많습니다. 잠시 후 다시 시도해주세요.'},429);
        const token=[...crypto.getRandomValues(new Uint8Array(32))].map(b=>b.toString(16).padStart(2,'0')).join('');
        const id=crypto.randomUUID(),code=crypto.randomUUID().replaceAll('-','').slice(0,12).toUpperCase();
        this.sql.exec('INSERT INTO users(id,token_hash,code,name,created) VALUES(?,?,?,?,?)',id,await hash(token),code,name,Date.now());
        user=this.one('SELECT * FROM users WHERE id=?',id);
        return json(this.view(user),200,{'Set-Cookie':'noor_session='+token+'; Path=/; HttpOnly; SameSite=Strict; Max-Age=31536000'+(url.protocol==='https:'?'; Secure':'')});
      }
      this.sql.exec('UPDATE users SET name=? WHERE id=?',name,user.id);user.name=name;return json(this.view(user));
    }
    if(path==='/api/posts'&&request.method==='GET'){
      const category=url.searchParams.get('category')==='free'?'free':'suggestion';
      const page=Math.max(0,Math.min(10000,Number.parseInt(url.searchParams.get('page')||'0',10)||0));
      const posts=this.sql.exec('SELECT id,category,author,title,created,author_id FROM posts WHERE category=? ORDER BY created DESC,id DESC LIMIT 21 OFFSET ?',category,page*20).toArray();
      return json({posts:posts.slice(0,20).map(p=>({...p,mine:p.author_id===user?.id,author_id:undefined})),hasMore:posts.length>20,page});
    }
    const postMatch=path.match(/^\/api\/posts\/([a-f0-9-]{36})$/);
    if(postMatch&&request.method==='GET'){
      const post=this.one('SELECT * FROM posts WHERE id=?',postMatch[1]);
      return post?json({...post,mine:post.author_id===user?.id,author_id:undefined}):json({error:'글을 찾을 수 없습니다.'},404);
    }
    if(!user)return json({error:'이 기기의 접속 정보를 먼저 만들어주세요.'},401);
    if(path==='/api/social'&&request.method==='GET')return json(this.view(user));
    if(path==='/api/chat/preferences'&&request.method==='POST'){
      if(typeof data.publicChat!=='boolean'||typeof data.whispers!=='boolean')return json({error:'입력 형식을 확인해주세요.'},400);
      this.sql.exec('INSERT INTO chat_preferences(owner,public_chat,whispers) VALUES(?,?,?) ON CONFLICT(owner) DO UPDATE SET public_chat=excluded.public_chat,whispers=excluded.whispers',user.id,Number(data.publicChat),Number(data.whispers));
      return json(this.view(user));
    }
    if(path==='/api/blocks'&&request.method==='POST'){
      const target=typeof data.id==='string'?data.id:'';
      if(typeof data.blocked!=='boolean'||target===user.id||!this.one('SELECT id FROM users WHERE id=?',target))return json({error:'입력 형식을 확인해주세요.'},400);
      if(!this.rate(user.id,'block',120,3600))return json({error:'잠시 후 다시 시도해주세요.'},429);
      if(data.blocked){
        if(this.privacy(user.id).blocked.length>=200&&!this.one('SELECT target FROM blocks WHERE owner=? AND target=?',user.id,target))return json({error:'차단 목록은 최대 200명입니다.'},400);
        this.sql.exec('INSERT OR IGNORE INTO blocks(owner,target,created) VALUES(?,?,?)',user.id,target,Date.now());
      }else this.sql.exec('DELETE FROM blocks WHERE owner=? AND target=?',user.id,target);
      return json(this.view(user));
    }
    if(path==='/api/friends/request'&&request.method==='POST'){
      if(!this.rate(user.id,'friend',20,3600)||!this.rate(ipHash,'friend-ip',60,3600))return json({error:'친구 요청이 많습니다. 잠시 후 다시 시도해주세요.'},429);
      if(this.friends(user.id).length>=100)return json({error:'친구는 최대 100명까지 등록할 수 있습니다.'},400);
      const code=typeof data.code==='string'?data.code.replaceAll('-','').toUpperCase().trim():'';
      const target=this.one('SELECT id FROM users WHERE code=?',code);
      if(!target||target.id===user.id)return json({error:'친구 코드를 확인해주세요.'},400);
      if(this.one('SELECT owner FROM blocks WHERE (owner=? AND target=?) OR (owner=? AND target=?)',user.id,target.id,target.id,user.id))return json({error:'친구 코드를 확인해주세요.'},400);
      if(this.one('SELECT sender FROM friendships WHERE (sender=? AND receiver=?) OR (sender=? AND receiver=?)',user.id,target.id,target.id,user.id))return json({error:'이미 친구이거나 요청이 대기 중입니다.'},409);
      this.sql.exec('INSERT INTO friendships(sender,receiver,accepted,created) VALUES(?,?,0,?)',user.id,target.id,Date.now());return json(this.view(user));
    }
    if(path==='/api/friends/respond'&&request.method==='POST'){
      const row=this.one('SELECT sender FROM friendships WHERE sender=? AND receiver=? AND accepted=0',String(data.id),user.id);
      if(!row)return json({error:'친구 요청을 찾을 수 없습니다.'},404);
      if(data.accept===true){
        if(this.friends(user.id).length>=100||this.friends(String(data.id)).length>=100)return json({error:'친구 수 제한에 도달했습니다.'},400);
        this.sql.exec('UPDATE friendships SET accepted=1 WHERE sender=? AND receiver=?',String(data.id),user.id);
      }else this.sql.exec('DELETE FROM friendships WHERE sender=? AND receiver=?',String(data.id),user.id);
      return json(this.view(user));
    }
    if(path==='/api/friends/remove'&&request.method==='POST'){
      this.sql.exec('DELETE FROM friendships WHERE (sender=? AND receiver=?) OR (sender=? AND receiver=?)',user.id,String(data.id),String(data.id),user.id);return json(this.view(user));
    }
    if(path==='/api/posts'&&request.method==='POST'){
      let post;try{post=validatePost(data);}catch(e){return json({error:e.message},400);}
      if(!this.rate(user.id,'post-short',1,30)||!this.rate(ipHash,'post-hour',15,3600))return json({error:'잠시 기다린 뒤 글을 작성해주세요. (30초 간격, 시간당 최대 15개)'},429);
      const id=crypto.randomUUID(),created=Date.now();
      this.sql.exec('INSERT INTO posts(id,category,author_id,author,title,body,created) VALUES(?,?,?,?,?,?,?)',id,post.category,user.id,user.name,post.title,post.body,created);
      return json({id,...post,author:user.name,created,mine:true},201);
    }
    if(postMatch&&request.method==='DELETE'){
      const post=this.one('SELECT author_id FROM posts WHERE id=?',postMatch[1]);
      if(!post)return json({error:'글을 찾을 수 없습니다.'},404);
      if(post.author_id!==user.id)return json({error:'본인 글만 삭제할 수 있습니다.'},403);
      this.sql.exec('DELETE FROM posts WHERE id=?',postMatch[1]);return json({ok:true});
    }
    return json({error:'찾을 수 없는 요청입니다.'},404);
  }
}
