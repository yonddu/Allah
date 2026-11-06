import {t} from './i18n.js';
export function initCommunity({getName,toast,onSession,sendChat,reconnect,onPublicChat}){
  const $=id=>document.getElementById(id);
  let session=null,category='suggestion',page=0,currentPost=null,requestVersion=0,startPromise=null;
  let channel='chat',messages=[],collapsed=false,unread=0,prayerMode=false;const players=new Map();
  const open=id=>$(id).showModal();
  const date=value=>new Intl.DateTimeFormat(document.documentElement.lang||'en',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(value));
  const element=(tag,className,text)=>Object.assign(document.createElement(tag),{className:className||'',textContent:text||''});
  async function api(path,method='GET',data){
    const response=await fetch(path,{method,credentials:'same-origin',headers:data?{'Content-Type':'application/json'}:{},body:data?JSON.stringify(data):undefined});
    let result;try{result=await response.json();}catch{throw new Error('서버에 연결되지 않았습니다. 잠시 후 다시 시도해주세요.');}
    if(!response.ok)throw new Error(result.error||'요청을 처리하지 못했습니다.');
    return result;
  }
  function sessionUpdated(data){
    session=data;session.blocked??=[];onSession(data);
    $('myFriendCode').textContent=data.code;$('friendBadge').textContent=data.incoming.length?'('+data.incoming.length+')':'';
    $('publicChatOff').checked=data.publicChat===false;$('whispersOff').checked=data.whispers===false;
    // Purge disabled or newly blocked content immediately, including old whispers.
    messages=messages.filter(visibleMessage);renderChat();renderPeople();
  }
  const isBlocked=id=>session?.blocked.some(p=>p.id===id);
  function visibleMessage(message){
    if(prayerMode||!session||isBlocked(message.accountId)||isBlocked(message.to))return false;
    if(message.type==='whisper')return session.whispers!==false;
    return session.publicChat!==false&&(!session.premium||message.accountId===session.id||session.friends.some(p=>p.id===message.accountId));
  }

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
  function setCollapsed(value){collapsed=value;$('chatBody').hidden=value;$('collapseChatButton').setAttribute('aria-expanded',String(!value));$('collapseChatButton').textContent=value?'⌃':'⌄';}
  function selectChannel(value){
    channel=value;if(value==='whisper')unread=0;
    renderChat();
  }
  function renderChat(){
    $('chatDock').hidden=prayerMode;$('chatButton').disabled=prayerMode;
    if(prayerMode){$('chatMessages').replaceChildren();$('whisperUnread').textContent='';return;}
    const disabled=channel==='chat'?session?.publicChat===false:session?.whispers===false;
    $('publicChatTab').setAttribute('aria-selected',String(channel==='chat'));
    $('whisperChatTab').setAttribute('aria-selected',String(channel==='whisper'));
    $('whisperUnread').textContent=unread?' · '+unread:'';
    $('whisperTargetRow').hidden=channel!=='whisper'||disabled;
    $('chatMode').textContent=channel==='whisper'?'같은 서버의 상대에게만 전달됩니다.':session?.premium?'친구 전용 채팅 · 친구의 글과 내 글만 표시됩니다.':'현재 서버의 전체 채팅';
    $('chatDisabledStatus').hidden=!disabled;$('chatForm').hidden=disabled;
    $('chatMessages').replaceChildren();
    for(const message of messages.filter(m=>m.type===channel&&visibleMessage(m))){
      const row=element('div','chat-message'),name=message.accountId===session.id&&message.type==='whisper'?'→ '+message.toName:message.name;
      const author=element('button','chat-author',name);author.type='button';
      const id=message.accountId===session.id?message.to:message.accountId;
      author.addEventListener('click',()=>beginWhisper(id));
      const body=element('span','',message.text);row.append(author,body);$('chatMessages').append(row);
    }
    $('chatMessages').scrollTop=$('chatMessages').scrollHeight;
  }
  function roomPeople(){
    return [...new Map([...players.values()].filter(p=>p.accountId!==session?.id&&!isBlocked(p.accountId)).map(p=>[p.accountId,{id:p.accountId,name:p.profile.name}])).values()];
  }
  function renderPeople(){
    const current=$('whisperTarget').value;
    $('whisperTarget').replaceChildren(new Option(t('귓속말 상대 선택'),''));
    const people=roomPeople();for(const person of people)$('whisperTarget').append(new Option(person.name,person.id));
    if(people.some(p=>p.id===current))$('whisperTarget').value=current;
    $('roomPeople').replaceChildren();$('blockedPeople').replaceChildren();
    for(const p of people)$('roomPeople').append(friendRow(p,[['귓속말',()=>{beginWhisper(p.id);$('peopleDialog').close();}],['차단',()=>block(p.id,true)]]));
    for(const p of session?.blocked||[])$('blockedPeople').append(friendRow(p,[['차단 해제',()=>block(p.id,false)]]));
    for(const id of ['roomPeople','blockedPeople'])if(!$(id).children.length)$(id).append(element('p','field-note','아직 없습니다.'));
  }
  function beginWhisper(id){
    if(prayerMode)return false;
    if(session?.whispers===false){toast('채팅이 꺼져 있습니다.');return false;}
    if(!roomPeople().some(p=>p.id===id)){toast('귓속말 상대를 선택해주세요.');return;}
    selectChannel('whisper');setCollapsed(false);$('whisperTarget').value=id;$('chatInput').focus();
  }
  async function block(id,blocked){
    if(!session)await start();sessionUpdated(await api('/api/blocks','POST',{id,blocked}));
  }
  handler('publicChatTab','click',()=>selectChannel('chat'));
  handler('whisperChatTab','click',()=>selectChannel('whisper'));
  handler('collapseChatButton','click',()=>setCollapsed(!collapsed));
  handler('chatButton','click',()=>{setCollapsed(!collapsed);});
  handler('peopleButton','click',async()=>{open('peopleDialog');await refreshFriends();renderPeople();});
  for(const id of ['publicChatOff','whispersOff'])handler(id,'change',async()=>{
    const data={publicChat:!$('publicChatOff').checked,whispers:!$('whispersOff').checked};
    $('publicChatOff').disabled=$('whispersOff').disabled=true;
    try{if(!session)await start();sessionUpdated(await api('/api/chat/preferences','POST',data));}
    catch(e){if(session)sessionUpdated(session);throw e;}
    finally{$('publicChatOff').disabled=$('whispersOff').disabled=false;}
  });
  handler('chatForm','submit',e=>{
    e.preventDefault();if(prayerMode)return;const text=$('chatInput').value.trim();if(!text)return;
    if(channel==='chat'?session?.publicChat===false:session?.whispers===false)return;
    const to=channel==='whisper'?$('whisperTarget').value:null;
    if(channel==='whisper'&&!to){toast('귓속말 상대를 선택해주세요.');return;}
    if(sendChat(text,to))$('chatInput').value='';else toast('온라인 서버에 연결된 뒤 채팅할 수 있습니다.');
  });
  function chat(message){
    if(!visibleMessage(message))return;
    messages.push(message);if(messages.length>100)messages.shift();
    if(message.type==='chat')onPublicChat?.(message);
    if(message.type==='whisper'&&message.accountId!==session.id&&(channel!=='whisper'||collapsed))unread=Math.min(99,unread+1);
    renderChat();
  }
  function player(p){const old=players.get(p.id);players.set(p.id,p);if(!old||old.profile.name!==p.profile.name||old.accountId!==p.accountId)renderPeople();}
  function leave(id){players.delete(id);renderPeople();}
  function clear(){players.clear();messages=[];unread=0;renderChat();renderPeople();}
  window.addEventListener('languagechange',()=>{if($('boardDialog').open)loadPosts();if($('friendsDialog').open)renderFriends();renderChat();renderPeople();});
  function setPrayerMode(active){if(prayerMode===active)return;prayerMode=active;if(active){messages=[];unread=0;$('chatInput').blur();$('chatInput').value='';}renderChat();}
  return {start,chat,setPrayerMode,beginWhisper,player,leave,clear,refresh:refreshFriends,get session(){return session;},updateName:async()=>{if(session)sessionUpdated(await api('/api/session','POST',{name:getName()}));}};
}
