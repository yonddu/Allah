import {t} from './i18n.js';
export function initCommunity({getName,toast,onSession,sendChat,reconnect}){
  const $=id=>document.getElementById(id);
  let session=null,category='suggestion',page=0,currentPost=null,requestVersion=0,startPromise=null;
  const open=id=>$(id).showModal();
  const date=value=>new Intl.DateTimeFormat(document.documentElement.lang||'en',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(value));
  const element=(tag,className,text)=>Object.assign(document.createElement(tag),{className:className||'',textContent:text||''});
  async function api(path,method='GET',data){
    const response=await fetch(path,{method,credentials:'same-origin',headers:data?{'Content-Type':'application/json'}:{},body:data?JSON.stringify(data):undefined});
    let result;try{result=await response.json();}catch{throw new Error('서버에 연결되지 않았습니다. 잠시 후 다시 시도해주세요.');}
    if(!response.ok)throw new Error(result.error||'요청을 처리하지 못했습니다.');
    return result;
  }
  function sessionUpdated(data){if(data.premium&&(!session?.premium||JSON.stringify(session?.friends?.map(f=>f.id))!==JSON.stringify(data.friends.map(f=>f.id))))$('chatMessages').replaceChildren();session=data;onSession(data);$('myFriendCode').textContent=data.code;$('friendBadge').textContent=data.incoming.length?'('+data.incoming.length+')':'';$('chatMode').textContent=data.premium?'친구 전용 채팅 · 친구의 글과 내 글만 표시됩니다.':'현재 서버의 전체 채팅';$('premiumTag').textContent=data.premium?'이용 중':'미리보기';}
  function start(){
    if(startPromise)return startPromise;
    startPromise=api('/api/session','POST',{name:getName()}).then(data=>{sessionUpdated(data);return data;}).finally(()=>{startPromise=null;});
    return startPromise;
  }
  function handler(id,event,fn){$(id).addEventListener(event,e=>{Promise.resolve(fn(e)).catch(error=>toast(error.message));});}
  async function loadPosts(){
    const version=++requestVersion;$('boardStatus').textContent='글을 불러오고 있습니다…';
    try{
      const result=await api('/api/posts?category='+category+'&page='+page);if(version!==requestVersion)return;
      $('postList').replaceChildren();$('boardStatus').textContent='';
      if(!result.posts.length)$('postList').append(element('p','empty-list','아직 글이 없습니다. 첫 이야기를 남겨주세요.'));
      for(const post of result.posts){
        const button=element('button','post-row');button.setAttribute('data-no-i18n','');button.append(element('strong','',post.title),element('small','',post.author+' · '+date(post.created)+(post.mine?' · '+t('내 글'):'')));
        button.addEventListener('click',()=>showPost(post.id).catch(e=>toast(e.message)));$('postList').append(button);
      }
      $('pageLabel').textContent=String(page+1);$('previousPageButton').disabled=page===0;$('nextPageButton').disabled=!result.hasMore;
    }catch(e){if(version===requestVersion){$('boardStatus').textContent=e.message;$('postList').replaceChildren();}}
  }
  async function showPost(id){
    const post=await api('/api/posts/'+id);currentPost=post;
    $('postCategoryLabel').textContent=post.category==='free'?'COMMUNITY · 자유게시판':'SUGGESTIONS · 건의사항';
    $('postDetailTitle').textContent=post.title;$('postMeta').textContent=post.author+' · '+date(post.created);
    $('postDetailBody').textContent=post.body;$('deletePostButton').hidden=!post.mine;$('deleteConfirm').hidden=true;open('postDialog');
  }
  handler('boardButton','click',()=>{open('boardDialog');page=0;return loadPosts();});
  for(const b of $('boardTabs').querySelectorAll('button'))b.addEventListener('click',()=>{category=b.dataset.category;page=0;for(const n of $('boardTabs').children)n.setAttribute('aria-pressed',String(n===b));loadPosts();});
  handler('previousPageButton','click',()=>{if(page>0)page--;return loadPosts();});
  handler('nextPageButton','click',()=>{page++;return loadPosts();});
  handler('writePostButton','click',async()=>{
    if(!session)await start();$('writeTitle').textContent=category==='free'?'자유게시판 글쓰기':'건의사항 작성';$('postFormStatus').textContent='다른 이용자에게 공개되는 글입니다.';open('writeDialog');
  });
  handler('postForm','submit',async e=>{
    e.preventDefault();$('submitPostButton').disabled=true;
    try{
      if(!session)await start();
      await api('/api/session','POST',{name:getName()});
      await api('/api/posts','POST',{category,title:$('postTitle').value,body:$('postBody').value});
      $('postForm').reset();$('writeDialog').close();page=0;await loadPosts();toast('글을 등록했습니다.');
    }catch(error){$('postFormStatus').textContent=error.message;}finally{$('submitPostButton').disabled=false;}
  });
  handler('deletePostButton','click',()=>{$('deleteConfirm').hidden=false;});
  handler('cancelDeleteButton','click',()=>{$('deleteConfirm').hidden=true;});
  handler('confirmDeleteButton','click',async()=>{if(!currentPost)return;$('confirmDeleteButton').disabled=true;try{await api('/api/posts/'+currentPost.id,'DELETE');$('postDialog').close();await loadPosts();toast('글을 삭제했습니다.');}finally{$('confirmDeleteButton').disabled=false;}});
  function friendRow(person,buttons=[]){
    const row=element('div','friend-row'),label=element('div','',person.name);label.setAttribute('data-no-i18n','');label.append(element('small','',person.code));row.append(label);
    const actions=element('div');for(const [text,fn]of buttons){const b=element('button','small-secondary',text);b.addEventListener('click',()=>{b.disabled=true;Promise.resolve(fn()).catch(e=>toast(e.message)).finally(()=>b.disabled=false);});actions.append(b);}row.append(actions);return row;
  }
  function renderFriends(){
    if(!session)return;
    $('incomingFriends').replaceChildren();$('friendList').replaceChildren();$('outgoingFriends').replaceChildren();
    for(const p of session.incoming)$('incomingFriends').append(friendRow(p,[['수락',()=>friendAction('/api/friends/respond',{id:p.id,accept:true})],['거절',()=>friendAction('/api/friends/respond',{id:p.id,accept:false})]]));
    for(const p of session.friends)$('friendList').append(friendRow(p,[['친구 해제',()=>friendAction('/api/friends/remove',{id:p.id})]]));
    for(const p of session.outgoing)$('outgoingFriends').append(friendRow(p,[['요청 취소',()=>friendAction('/api/friends/remove',{id:p.id})]]));
    for(const id of ['incomingFriends','friendList','outgoingFriends'])if(!$(id).children.length)$(id).append(element('p','field-note','아직 없습니다.'));
  }
  async function refreshFriends(){if(!session)await start();else sessionUpdated(await api('/api/social'));renderFriends();}
  async function friendAction(path,data){sessionUpdated(await api(path,'POST',data));renderFriends();$('chatMessages').replaceChildren();reconnect();toast('친구 정보를 업데이트했습니다.');}
  handler('friendsButton','click',async()=>{open('friendsDialog');$('friendStatus').textContent='친구 정보를 불러오고 있습니다…';try{await refreshFriends();$('friendStatus').textContent='친구 요청은 상대방이 수락하면 연결됩니다.';}catch(e){$('friendStatus').textContent=e.message;}});
  handler('copyFriendCode','click',async()=>{if(!session)return;try{await navigator.clipboard.writeText(session.code);toast('친구 코드를 복사했습니다.');}catch{toast('친구 코드: '+session.code);}});
  handler('friendForm','submit',async e=>{e.preventDefault();if(!session)await start();await friendAction('/api/friends/request',{code:$('friendCodeInput').value});$('friendCodeInput').value='';});
  handler('chatButton','click',async()=>{open('chatDialog');try{await refreshFriends();}catch{}});
  handler('chatForm','submit',e=>{
    e.preventDefault();const text=$('chatInput').value.trim();if(!text)return;
    if(sendChat(text))$('chatInput').value='';else toast('온라인 서버에 연결된 뒤 채팅할 수 있습니다.');
  });
  function chat(message){
    const row=element('div','chat-message'),title=element('strong','',message.name);title.append(element('small','',date(message.at)));row.append(title,element('p','',message.text));
    $('chatMessages').append(row);while($('chatMessages').children.length>80)$('chatMessages').firstElementChild.remove();$('chatMessages').scrollTop=$('chatMessages').scrollHeight;
  }
  window.addEventListener('languagechange',()=>{if($('boardDialog').open)loadPosts();if($('friendsDialog').open)renderFriends();});
  return {start,chat,refresh:refreshFriends,get session(){return session;},updateName:async()=>{if(session)sessionUpdated(await api('/api/session','POST',{name:getName()}));}};
}
