import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {Community} from '../community.js';
function setup(){
  const db=new DatabaseSync(':memory:');
  const sql={exec(query,...args){const p=db.prepare(query);if(/^\s*SELECT/i.test(query)){const rows=p.all(...args);return {toArray:()=>rows};}p.run(...args);return {toArray:()=>[]};}};
  return {community:new Community({storage:{sql}},{}),db};
}
async function call(c,path,method='GET',data,cookie='',origin='https://noor.example'){
  return c.fetch(new Request('https://noor.example'+path,{method,headers:{Origin:origin,Cookie:cookie,'CF-Connecting-IP':'127.0.0.1','Content-Type':'application/json'},body:method==='GET'||method==='DELETE'?undefined:JSON.stringify(data||{})}));
}
async function session(c,name){
  const r=await call(c,'/api/session','POST',{name});assert.equal(r.status,200);
  return {cookie:r.headers.get('Set-Cookie').split(';')[0],view:await r.json()};
}
test('Device identities persist with HttpOnly cookies and ignore client paid flags',async()=>{
  const {community:c,db}=setup();
  try{
    const {cookie,view}=await session(c,'첫 사용자');
    const response=await call(c,'/api/session','POST',{name:'새 이름',premium:true,premium_until:Date.now()+9999999},cookie);
    const user=await response.json();assert.equal(user.id,view.id);assert.equal(user.name,'새 이름');assert.equal(user.premium,false);
    const csrf=await call(c,'/api/friends/request','POST',{code:'123'},cookie,'https://evil.example');assert.equal(csrf.status,403);
    const missing=await call(c,'/api/social');assert.equal(missing.status,401);
  }finally{db.close();}
});
test('Friend requests require target acceptance and either side can remove the friendship',async()=>{
  const {community:c,db}=setup();
  try{
    const a=await session(c,'A'),b=await session(c,'B');
    const req=await call(c,'/api/friends/request','POST',{code:b.view.code},a.cookie);assert.equal(req.status,200);
    assert.equal((await req.json()).friends.length,0);
    const incoming=await (await call(c,'/api/social','GET',null,b.cookie)).json();assert.equal(incoming.incoming[0].id,a.view.id);
    assert.equal((await call(c,'/api/friends/respond','POST',{id:a.view.id,accept:true},a.cookie)).status,404);
    const accept=await call(c,'/api/friends/respond','POST',{id:a.view.id,accept:true},b.cookie);assert.equal((await accept.json()).friends.length,1);
    assert.equal((await (await call(c,'/api/social','GET',null,a.cookie)).json()).friends[0].id,b.view.id);
    await call(c,'/api/friends/remove','POST',{id:b.view.id},a.cookie);
    assert.equal((await (await call(c,'/api/social','GET',null,b.cookie)).json()).friends.length,0);
  }finally{db.close();}
});
test('Boards persist across requests, paginate separately, rate-limit and enforce deletion ownership',async()=>{
  const {community:c,db}=setup();
  try{
    const a=await session(c,'작성자'),b=await session(c,'다른 사람');
    const create=await call(c,'/api/posts','POST',{category:'suggestion',title:'기도원 의견',body:'분수 소리를 더 작게 해주세요.'},a.cookie);assert.equal(create.status,201);
    const post=await create.json();
    const list=await (await call(c,'/api/posts?category=suggestion','GET',null,b.cookie)).json();assert.equal(list.posts.length,1);assert.equal(list.posts[0].mine,false);
    assert.equal((await (await call(c,'/api/posts?category=free')).json()).posts.length,0);
    assert.equal((await call(c,'/api/posts/'+post.id,'DELETE',null,b.cookie)).status,403);
    assert.equal((await call(c,'/api/posts','POST',{category:'free',title:'반복 글',body:'연속 게시 검사'},a.cookie)).status,429);
    assert.equal((await call(c,'/api/posts/'+post.id,'DELETE',null,a.cookie)).status,200);
    assert.equal((await call(c,'/api/posts/'+post.id)).status,404);
  }finally{db.close();}
});
