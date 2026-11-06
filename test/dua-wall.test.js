import test from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {Community} from '../community.js';import worker from '../worker.js';import {duaText} from '../dua-wall.js';import {DUA_KEYS,DUA_LOCALES} from '../public/dua-i18n.js';import {LANGUAGES} from '../public/i18n.js';
function fixture(){
 const db=new DatabaseSync(':memory:');let fail='';
 const sql={exec(query,...args){if(fail&&query.startsWith(fail))throw new Error('Injected write failure');const statement=db.prepare(query);const rows=/^\s*SELECT/i.test(query)?statement.all(...args):(statement.run(...args),[]);return {toArray:()=>rows};}};
 const storage={sql,transactionSync(fn){db.exec('BEGIN');try{const value=fn();db.exec('COMMIT');return value;}catch(e){db.exec('ROLLBACK');throw e;}}};
 return {db,storage,c:new Community({storage},{}),set fail(value){fail=value;}};
}
const call=(c,path,method='GET',body,cookie='',origin='https://noor.example')=>c.fetch(new Request('https://noor.example'+path,{method,headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json'},body:['GET','DELETE'].includes(method)?undefined:JSON.stringify(body||{})}));
async function user(c,name){const r=await call(c,'/api/session','POST',{name});return {cookie:r.headers.get('set-cookie').split(';')[0],data:await r.json()};}
async function create(c,a,body='Please pray for peace.'){const r=await call(c,'/api/duas','POST',{body,author:'forged',aminCount:999},a.cookie);assert.equal(r.status,201);return (await r.json()).dua;}

test('Duas are anonymous to other visitors and survive restarts without exposing profile or account fields',async()=>{
 const f=fixture();try{const a=await user(f.c,'PRIVATE NAME A'),b=await user(f.c,'PRIVATE NAME B'),dua=await create(f.c,a);
  assert.equal(dua.mine,true);assert.equal(dua.aminCount,0);assert.equal(dua.amined,false);
  for(const cookie of ['',b.cookie,a.cookie]){const r=await call(f.c,'/api/duas','GET',null,cookie),text=await r.text();assert.ok(!text.includes(a.data.id));assert.ok(!text.includes('PRIVATE NAME'));const result=JSON.parse(text).duas[0];assert.deepEqual(Object.keys(result).sort(),['id','body','created','aminCount','mine','amined'].sort());assert.equal(result.mine,cookie===a.cookie);assert.equal(r.headers.get('cache-control'),'no-store');}
  const restarted=new Community({storage:f.storage},{});assert.equal((await(await call(restarted,'/api/duas')).json()).duas[0].body,dua.body);
 }finally{f.db.close();}
});
test('Concurrent and repeated Amin requests count once per visitor, reject self-reactions and enforce deletion ownership',async()=>{
 const f=fixture();try{const a=await user(f.c,'A'),b=await user(f.c,'B'),c=await user(f.c,'C'),dua=await create(f.c,a),path='/api/duas/'+dua.id;
  assert.equal((await call(f.c,path+'/amin','POST',{},a.cookie)).status,403);assert.equal((await call(f.c,path+'/amin','POST',{})).status,401);
  const reactions=await Promise.all(Array.from({length:30},()=>call(f.c,path+'/amin','POST',{aminCount:100000,actor:a.data.id},b.cookie)));for(const r of reactions){assert.equal(r.status,200);assert.equal((await r.json()).dua.aminCount,1);}
  assert.equal((await(await call(f.c,path+'/amin','POST',{},c.cookie)).json()).dua.aminCount,2);
  const bv=(await(await call(f.c,'/api/duas','GET',null,b.cookie)).json()).duas[0];assert.equal(bv.amined,true);assert.equal(bv.mine,false);
  assert.equal((await call(f.c,path,'DELETE',null,b.cookie)).status,403);assert.equal((await call(f.c,path,'DELETE',null,a.cookie)).status,200);assert.equal(f.db.prepare('SELECT count(*) AS n FROM dua_amins').get().n,0);assert.equal((await call(f.c,path+'/amin','POST',{},b.cookie)).status,404);
 }finally{f.db.close();}
});
test('Dua pages stay bounded and stable across new posts, equal timestamps and invalid cursors',async()=>{
 const f=fixture();try{for(let i=0;i<41;i++)f.db.prepare('INSERT INTO duas(id,owner,body,created) VALUES(?,?,?,?)').run(crypto.randomUUID(),'test','Dua '+i,1000);
  const first=await(await call(f.c,'/api/duas')).json();assert.equal(first.duas.length,20);assert.ok(first.nextCursor);const ids=first.duas.map(d=>d.id);
  f.db.prepare('INSERT INTO duas(id,owner,body,created) VALUES(?,?,?,?)').run(crypto.randomUUID(),'test','New after page one',2000);
  let cursor=first.nextCursor;while(cursor){const page=await(await call(f.c,'/api/duas?cursor='+encodeURIComponent(cursor))).json();assert.ok(page.duas.length<=20);ids.push(...page.duas.map(d=>d.id));cursor=page.nextCursor;}assert.equal(ids.length,41);assert.equal(new Set(ids).size,41);
  for(const cursor of ['bad',btoa(JSON.stringify([1000,"' OR 1=1"])),btoa(JSON.stringify([null,crypto.randomUUID()])),btoa(JSON.stringify([1000,123])), 'x'.repeat(200)])assert.equal((await call(f.c,'/api/duas?cursor='+encodeURIComponent(cursor))).status,400);
 }finally{f.db.close();}
});
test('Unicode content stays text, writes are rate-limited, and CSRF and unbounded payloads are rejected',async()=>{
 assert.equal(duaText('  اللهم اشفِ أمي\r\nآمين  '),'اللهم اشفِ أمي\nآمين');assert.equal(duaText('💛'.repeat(400))?.length,800);assert.equal(duaText('💛'.repeat(401)),null);assert.equal(duaText(' \n '),null);assert.equal(duaText({body:'spoof'}),null);
 const f=fixture();try{const a=await user(f.c,'A'),b=await user(f.c,'B');const body='<img src=x onerror="window.attacked=true">';const dua=await create(f.c,a,body);assert.equal(dua.body,body);
  assert.equal((await call(f.c,'/api/duas','POST',{body:'Second'},a.cookie)).status,429);assert.equal((await call(f.c,'/api/duas','POST',{body:'CSRF'},a.cookie,'https://evil.example')).status,403);
  const response=await f.c.fetch(new Request('https://noor.example/api/duas',{method:'POST',headers:{Origin:'https://noor.example',Cookie:b.cookie},body:JSON.stringify({body:'x'.repeat(13000)})}));assert.equal(response.status,413);
  assert.equal((await call(f.c,'/api/duas','POST',{body:'x'.repeat(401)},b.cookie)).status,400);assert.equal((await call(f.c,'/api/duas','DELETE',null,a.cookie)).status,405);
 }finally{f.db.close();}
});
test('Amin and deletion transactions roll back together on a storage failure',async()=>{
 const f=fixture();try{const a=await user(f.c,'A'),b=await user(f.c,'B'),dua=await create(f.c,a),path='/api/duas/'+dua.id;
  f.fail='UPDATE duas';await assert.rejects(()=>call(f.c,path+'/amin','POST',{},b.cookie),/Injected/);assert.equal(f.db.prepare('SELECT count(*) AS n FROM dua_amins').get().n,0);assert.equal(f.db.prepare('SELECT amin_count FROM duas').get().amin_count,0);
  f.fail='';assert.equal((await(await call(f.c,path+'/amin','POST',{},b.cookie)).json()).dua.aminCount,1);
  f.fail='DELETE FROM duas';await assert.rejects(()=>call(f.c,path,'DELETE',null,a.cookie),/Injected/);assert.equal(f.db.prepare('SELECT count(*) AS n FROM dua_amins').get().n,1);assert.equal(f.db.prepare('SELECT count(*) AS n FROM duas').get().n,1);
 }finally{f.db.close();}
});
test('All game languages include Dua controls and Worker routes stay on the Community binding',async()=>{
 for(const {code}of LANGUAGES){assert.equal(DUA_LOCALES[code].length,DUA_KEYS.length,code);for(const label of DUA_LOCALES[code]){assert.ok(label.trim());if(code!=='ko')assert.ok(!/[\uac00-\ud7a3]/.test(label),code);}}
 const routed=[],env={COMMUNITY:{idFromName:name=>name,get:id=>({fetch:request=>{routed.push(new URL(request.url).pathname);return Response.json({ok:true});}})}};
 for(const path of ['/api/duas','/api/duas/'+crypto.randomUUID(),'/api/duas/'+crypto.randomUUID()+'/amin'])assert.equal((await worker.fetch(new Request('https://noor.example'+path),env)).status,200);
 assert.equal(routed.length,3);assert.equal((await worker.fetch(new Request('https://noor.example/api/duas-other'),env)).status,404);
});
