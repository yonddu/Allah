const json=(data,status=200,headers={})=>Response.json(data,{status,headers:{'Cache-Control':'no-store',...headers}});
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
export function duaText(value){
 if(typeof value!=='string')return null;
 const body=value.normalize('NFC').replace(/\r\n?/g,'\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g,'').trim();
 return body&&[...body].length<=400?body:null;
}
export class DuaWall{
 constructor(community){
  this.community=community;this.sql=community.sql;this.storage=community.ctx.storage;
  this.sql.exec('CREATE TABLE IF NOT EXISTS duas (id TEXT PRIMARY KEY, owner TEXT NOT NULL, body TEXT NOT NULL, created INTEGER NOT NULL, amin_count INTEGER NOT NULL DEFAULT 0 CHECK(amin_count>=0))');
  this.sql.exec('CREATE INDEX IF NOT EXISTS duas_created ON duas(created DESC,id DESC)');
  this.sql.exec('CREATE TABLE IF NOT EXISTS dua_amins (dua_id TEXT NOT NULL, actor TEXT NOT NULL, PRIMARY KEY(dua_id,actor))');
 }
 one(query,...args){return this.sql.exec(query,...args).toArray()[0];}
 view(id,actor=''){
  const row=this.one('SELECT id,body,created,amin_count AS aminCount,owner=? AS mine,EXISTS(SELECT 1 FROM dua_amins WHERE dua_id=duas.id AND actor=?) AS amined FROM duas WHERE id=?',actor,actor,id);
  return row?{...row,mine:!!row.mine,amined:!!row.amined}:null;
 }
 handle(request,url,user,ipHash,data){
  const path=url.pathname,match=path.match(/^\/api\/duas\/([a-f0-9-]{36})(\/amin)?$/),actor=user?.id||'';
  if(path!=='/api/duas'&&!match)return null;
  if(match&&!uuid.test(match[1]))return json({error:'duaMissing'},404);
  if(path==='/api/duas'&&request.method==='GET'){
   const cursor=url.searchParams.get('cursor');let before=null;
   if(cursor){if(cursor.length>160)return json({error:'duaInvalid'},400);try{before=JSON.parse(atob(cursor));}catch{return json({error:'duaInvalid'},400);}if(!Array.isArray(before)||before.length!==2||!Number.isSafeInteger(before[0])||before[0]<0||typeof before[1]!=='string'||!uuid.test(before[1]))return json({error:'duaInvalid'},400);}
   const rows=this.sql.exec('SELECT id,body,created,amin_count AS aminCount,owner=? AS mine,EXISTS(SELECT 1 FROM dua_amins WHERE dua_id=duas.id AND actor=?) AS amined FROM duas'+(before?' WHERE (created,id)<(?,?)':'')+' ORDER BY created DESC,id DESC LIMIT 21',actor,actor,...(before||[])).toArray();
   const page=rows.slice(0,20),last=page.at(-1);return json({duas:page.map(r=>({...r,mine:!!r.mine,amined:!!r.amined})),nextCursor:rows.length>20?btoa(JSON.stringify([last.created,last.id])):null});
  }
  if(!user)return json({error:'duaSession'},401);
  if(path==='/api/duas'&&request.method==='POST'){
   const body=duaText(data.body);if(!body)return json({error:'duaInvalid'},400);
   if(!this.community.rate(actor,'dua-short',1,30)||!this.community.rate(actor,'dua-hour',10,3600)||!this.community.rate(ipHash,'dua-ip',180,3600))return json({error:'duaWait'},429);
   const id=crypto.randomUUID();this.sql.exec('INSERT INTO duas(id,owner,body,created) VALUES(?,?,?,?)',id,actor,body,Date.now());return json({dua:this.view(id,actor)},201);
  }
  if(match&&request.method==='POST'&&match[2]){
   if(!this.community.rate(actor,'amin',60,60)||!this.community.rate(ipHash,'amin-ip',600,60))return json({error:'duaWait'},429);
   return this.storage.transactionSync(()=>{
    const row=this.one('SELECT owner FROM duas WHERE id=?',match[1]);if(!row)return json({error:'duaMissing'},404);if(row.owner===actor)return json({error:'duaOwnAmin'},403);
    if(!this.one('SELECT actor FROM dua_amins WHERE dua_id=? AND actor=?',match[1],actor)){this.sql.exec('INSERT INTO dua_amins(dua_id,actor) VALUES(?,?)',match[1],actor);this.sql.exec('UPDATE duas SET amin_count=amin_count+1 WHERE id=?',match[1]);}
    return json({dua:this.view(match[1],actor)});
   });
  }
  if(match&&request.method==='DELETE'&&!match[2])return this.storage.transactionSync(()=>{
   const row=this.one('SELECT owner FROM duas WHERE id=?',match[1]);if(!row)return json({error:'duaMissing'},404);if(row.owner!==actor)return json({error:'duaOwner'},403);
   this.sql.exec('DELETE FROM dua_amins WHERE dua_id=?',match[1]);this.sql.exec('DELETE FROM duas WHERE id=?',match[1]);return json({ok:true});
  });
  return json({error:'duaMethod'},405,{Allow:path==='/api/duas'?'GET, POST':match[2]?'POST':'DELETE'});
 }
}
