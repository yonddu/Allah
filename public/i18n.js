import {ko,en} from './locale-base.js';
export const LANGUAGES=[
 {code:'en',name:'English'},{code:'ar',name:'العربية',dir:'rtl'},{code:'ur',name:'اردو',dir:'rtl'},
 {code:'id',name:'Bahasa Indonesia'},{code:'bn',name:'বাংলা'},{code:'tr',name:'Türkçe'},
 {code:'fa',name:'فارسی',dir:'rtl'},{code:'ms',name:'Bahasa Melayu'},{code:'hi',name:'हिन्दी'},
 {code:'fr',name:'Français'},{code:'ha',name:'Hausa'},{code:'sw',name:'Kiswahili'},
 {code:'ps',name:'پښتو',dir:'rtl'},{code:'so',name:'Soomaali'},{code:'uz',name:'O‘zbekcha'},
 {code:'ru',name:'Русский'},{code:'kk',name:'Қазақша'},{code:'az',name:'Azərbaycanca'},
 {code:'tg',name:'Тоҷикӣ'},{code:'zh',name:'简体中文'},{code:'ko',name:'한국어'}
];
const cache=new Map([['ko',ko],['en',en]]),lookup=new Map(),sourceRecords=new WeakMap(),attributeRecords=new WeakMap();
let locale='en',dictionary=en,observer,languageRequest=0;
function addLookup(data){for(const [key,value]of Object.entries(data))if(value)lookup.set(value,key);}
addLookup(ko);addLookup(en);
const aliases={
 'MAKE IT YOURS':'나의 공간 꾸미기','YOUR OWN MOMENT OF STILLNESS':'평온을 향한',
 'WELCOME TO NOOR':'Noor 홈','THE DETAILS MATTER':'화면 설정','A LITTLE MORE SPACE':'온전히 나만의 시간.',
 'A WORLD OF SANCTUARIES':'모스크와 서버 선택','VOICES OF THE COMMUNITY':'우리의 이야기',
 'SHARE YOUR THOUGHTS':'글쓰기','PEACE, TOGETHER':'나의 친구','IN THIS SANCTUARY':'기도원 채팅',
 'A QUIETER KIND OF SOUND':'나의 소리','A PLACE FOR YOUR PEACE':'평온을 향한'
};
for(const [alias,source]of Object.entries(aliases))lookup.set(alias,lookup.get(source));
export function t(source,values={}){
  const key=lookup.get(source)||source;
  const template=dictionary[key]||en[key]||source;
  return template.replace(/\{(\w+)\}/g,(m,k)=>values[k]===undefined?m:String(values[k]));
}
function translated(raw){
  const value=raw.trim();if(!value)return raw;
  let result=t(value);
  if(result===value){
    let m;
    if((m=value.match(/^(\d+)명 접속$/)))result=t('{n}명 접속',{n:m[1]});
    else if((m=value.match(/^서버 (\d+)$/)))result=t('서버 {n}',{n:m[1]});
    else if((m=value.match(/^다음 자세 · (.+)$/)))result=t('다음 자세 · {pose}',{pose:t(m[1])});
    else if((m=value.match(/^기도 중 · (.+)$/)))result=t('기도 중 · {pose}',{pose:t(m[1])});
    else if((m=value.match(/^([\d,.]+) km · 카바까지$/)))result=t('{n} km · 카바까지',{n:m[1]});
    else if((m=value.match(/^메카 방위각 ([\d.]+)도(.*)$/)))result=t('메카 방위각 {n}도',{n:m[1]});
    else if((m=value.match(/^친구 코드: (.+)$/)))result=t('친구 코드: {code}',{code:m[1]});
    else if((m=value.match(/^(.+) · ([1-3])$/))&&lookup.has(m[1]))result=t(m[1])+' · '+m[2];
    else if((m=value.match(/^(\d+) \/ (\d+)명$/)))result=m[1]+' / '+m[2];
    else if(value.includes(' · 내 글'))result=value.replace(' · 내 글',' · '+t('내 글'));
    else if(value.includes(' 위치 오차가 큽니다. 열린 장소에서 다시 확인해주세요.')){
      const split=value.split(' 위치 오차가 큽니다. 열린 장소에서 다시 확인해주세요.');
      result=t(split[0])+' '+t('위치 오차가 큽니다. 열린 장소에서 다시 확인해주세요.');
    }
  }
  if(result===value)return raw;
  return raw.slice(0,raw.indexOf(value))+result+raw.slice(raw.indexOf(value)+value.length);
}
function excluded(node){
  return node.parentElement?.closest('script,style,textarea,[data-no-i18n]')||!node.parentElement;
}
function translateNode(node){
  if(excluded(node))return;
  const record=sourceRecords.get(node),raw=node.nodeValue;
  const original=record&&raw===record.output?record.original:raw;
  const output=translated(original);
  sourceRecords.set(node,{original,output});
  if(raw!==output)node.nodeValue=output;
}
function translateAttributes(el){
  if(!el.matches||el.closest('[data-no-i18n]'))return;
  let records=attributeRecords.get(el);if(!records){records={};attributeRecords.set(el,records);}
  for(const name of ['placeholder','aria-label','title']){
    if(!el.hasAttribute(name))continue;
    const raw=el.getAttribute(name),record=records[name],original=record&&record.output===raw?record.original:raw,output=translated(original);
    records[name]={original,output};if(raw!==output)el.setAttribute(name,output);
  }
}
function translateTree(root){
  if(root.nodeType===Node.TEXT_NODE){translateNode(root);return;}
  if(root.nodeType!==Node.ELEMENT_NODE&&root!==document.body)return;
  if(root.closest?.('[data-no-i18n],script,style'))return;
  translateAttributes(root);
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);while(walker.nextNode())translateNode(walker.currentNode);
  for(const el of root.querySelectorAll('[placeholder],[aria-label],[title]'))translateAttributes(el);
}
export function currentLanguage(){return locale;}
export async function setLanguage(code,persist=true){
  const target=LANGUAGES.find(l=>l.code===code)||LANGUAGES[0],request=++languageRequest;
  let data=cache.get(target.code);
  if(!data){
    try{
      const r=await fetch('/locales/'+target.code+'.json');if(!r.ok)throw new Error('Language unavailable');
      data=await r.json();
      if(Object.keys(en).some(k=>typeof data[k]!=='string'))throw new Error('Incomplete translation');
      cache.set(target.code,data);addLookup(data);
    }catch{
      if(request!==languageRequest)return false;
      const status=document.getElementById('languageStatus');if(status)status.textContent='This language could not be loaded. Please try again.';
      return false;
    }
  }
  if(request!==languageRequest)return false;
  locale=target.code;dictionary=data;document.documentElement.lang=locale;document.documentElement.dir=target.dir||'ltr';
  document.title=t('NOOR — 나만의 평온이 머무는 곳');
  document.getElementById('languageSelect').value=locale;
  document.getElementById('entryLanguageSelect').value=locale;
  translateTree(document.body);
  if(persist)try{localStorage.setItem('noor-language',locale);}catch{}
  window.dispatchEvent(new CustomEvent('languagechange',{detail:{language:locale}}));
  return true;
}
export function chooseInitialLanguage(query,saved){
  const codes=LANGUAGES.map(l=>l.code);
  return codes.includes(query)?query:codes.includes(saved)?saved:'id';
}
export async function initI18n(){
  const select=document.getElementById('languageSelect'),entrySelect=document.getElementById('entryLanguageSelect');
  for(const lang of LANGUAGES){const option=document.createElement('option');option.value=lang.code;option.textContent=lang.name;select.append(option);entrySelect.append(option.cloneNode(true));}
  document.getElementById('languageButton').addEventListener('click',()=>document.getElementById('languageDialog').showModal());
  document.getElementById('closeLanguage').addEventListener('click',()=>document.getElementById('languageDialog').close());
  for(const picker of [select,entrySelect])picker.addEventListener('change',async()=>{
    select.disabled=entrySelect.disabled=true;
    try{
      const ok=await setLanguage(picker.value);
      document.getElementById('languageStatus').textContent=ok?t('언어 설정을 저장했습니다.'):'This language could not be loaded. Please try again.';
    }finally{select.disabled=entrySelect.disabled=false;}
  });
  let saved;try{saved=localStorage.getItem('noor-language');}catch{}
  const codes=LANGUAGES.map(l=>l.code),query=new URLSearchParams(location.search).get('lang');
  await setLanguage(chooseInitialLanguage(query,saved),false);
  let savedRoom,onboarded;try{savedRoom=localStorage.getItem('noor-room');onboarded=localStorage.getItem('noor-onboarded');}catch{}
  if(onboarded!=='1'||!/^(zayed|blue|nabawi):[1-3]$/.test(savedRoom||''))document.getElementById('mapDialog').showModal();
  observer=new MutationObserver(changes=>{
    for(const change of changes){
      if(change.type==='characterData')translateNode(change.target);
      else if(change.type==='attributes')translateAttributes(change.target);
      else for(const node of change.addedNodes)translateTree(node);
    }
  });
  observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['placeholder','aria-label','title']});
}
