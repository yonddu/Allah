import {t,currentLanguage} from './i18n.js';
import {duaLabel as d} from './dua-i18n.js';
export function initDuaWall({getSession,ensureSession,toast}){
 const $=id=>document.getElementById(id),controllers=new Map(),busy=new Set();
 let active=false,items=[],cursor=null,history=[null],loading=false,creating=false,confirmId=null,version=0,epoch=0,timer;
 const el=(tag,className,text)=>Object.assign(document.createElement(tag),{className,textContent:text||''});
 const errorText=code=>d(code==='duaInvalid'?'invalid':code==='duaWait'?'wait':'failed');
 async function api(path,method='GET',body){
  const controller=new AbortController();controllers.set(controller,method);
  try{const response=await fetch(path,{method,credentials:'same-origin',signal:controller.signal,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});let result;try{result=await response.json();}catch{throw new Error(d('failed'));}if(!response.ok)throw new Error(errorText(result.error));return result;}
  finally{controllers.delete(controller);}
 }
 function labels(){
  for(const node of document.querySelectorAll('[data-dua-label]'))node.textContent=d(node.dataset.duaLabel);
  $('duaBody').placeholder=d('placeholder');$('duaPrevious').textContent=t('이전');$('duaCounter').textContent=new Intl.NumberFormat(currentLanguage()).format([...$('duaBody').value].length)+' / '+new Intl.NumberFormat(currentLanguage()).format(400);
  $('duaPublish').disabled=creating||!$('duaBody').value.trim()||[...$('duaBody').value.trim()].length>400;
 }
 function render(){
  labels();const focused=document.activeElement?.dataset.duaAction,focusedId=document.activeElement?.closest('[data-dua-id]')?.dataset.duaId;
  $('duaList').replaceChildren();const numbers=new Intl.NumberFormat(currentLanguage()),dates=new Intl.DateTimeFormat(currentLanguage(),{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
  if(!items.length&&!loading)$('duaList').append(el('p','empty-list',d('empty')));
  for(const dua of items){
   const card=el('article','dua-card');card.dataset.duaId=dua.id;
   const meta=el('div','dua-meta'),name=el('span','',d('anonymous')+(dua.mine?' · '+d('mine'):'')),date=el('time','',dates.format(new Date(dua.created)));date.dateTime=new Date(dua.created).toISOString();meta.append(name,date);
   const text=el('p','dua-text',dua.body);text.dir='auto';
   const actions=el('div','dua-actions'),amin=el('button','small-secondary dua-amin',(dua.amined?'✓ ':'')+d('amin')+' · '+numbers.format(dua.aminCount));amin.type='button';amin.dataset.duaAction='amin';amin.disabled=dua.mine||dua.amined||busy.has(dua.id);amin.setAttribute('aria-pressed',String(dua.amined));amin.setAttribute('aria-label',(dua.amined?d('amined'):d('amin'))+' · '+numbers.format(dua.aminCount));amin.addEventListener('click',()=>void react(dua.id));actions.append(amin);
   if(dua.mine){const remove=el('button','small-secondary dua-remove',d('remove'));remove.type='button';remove.dataset.duaAction='delete';remove.disabled=busy.has(dua.id);remove.addEventListener('click',()=>{confirmId=dua.id;render();});actions.append(remove);}
   card.append(meta,text,actions);
   if(confirmId===dua.id&&dua.mine){const confirm=el('div','dua-confirm');confirm.append(el('span','',d('confirm')));for(const [key,fn]of [['remove',()=>void removeDua(dua.id)],['cancel',()=>{confirmId=null;render();}]]){const button=el('button','small-secondary',d(key));button.type='button';button.dataset.duaAction=key;button.disabled=busy.has(dua.id);button.addEventListener('click',fn);confirm.append(button);}card.append(confirm);}
   $('duaList').append(card);
  }
  $('duaPrevious').disabled=loading||history.length===1;$('duaMore').disabled=loading||!cursor;$('duaRefresh').disabled=loading;$('duaPage').textContent=numbers.format(history.length);
  if(focused&&focusedId){for(const card of $('duaList').children)if(card.dataset.duaId===focusedId)card.querySelector('[data-dua-action="'+focused+'"]')?.focus({preventScroll:true});}
 }
 async function load({refresh=false,next=false,previous=false,quiet=false}={}){
  const request=++version,requestCursor=refresh?null:next?cursor:previous?history.at(-2):history.at(-1);loading=true;if(!quiet)$('duaStatus').textContent=d('loading');render();
  try{const result=await api('/api/duas'+(requestCursor?'?cursor='+encodeURIComponent(requestCursor):''));if(request!==version)return;items=result.duas;cursor=result.nextCursor;if(refresh)history=[null];else if(next)history.push(requestCursor);else if(previous)history.pop();confirmId=null;$('duaStatus').textContent='';}
  catch(error){if(request===version&&error.name!=='AbortError')$('duaStatus').textContent=error.message;}
  finally{if(request===version){loading=false;render();}}
 }
 async function react(id){
  if(busy.has(id))return;const generation=epoch;busy.add(id);render();
  try{if(!getSession())await ensureSession();if(generation!==epoch)return;const result=await api('/api/duas/'+id+'/amin','POST',{});if(generation!==epoch)return;items=items.map(p=>p.id===id?result.dua:p);}
  catch(error){if(generation===epoch&&error.name!=='AbortError')$('duaStatus').textContent=error.message;}
  finally{busy.delete(id);if(generation===epoch)render();}
 }
 async function removeDua(id){
  if(busy.has(id))return;const generation=epoch;busy.add(id);render();
  try{await api('/api/duas/'+id,'DELETE');if(generation!==epoch)return;confirmId=null;await load({refresh:true});if(active)toast(d('deleted'));}
  catch(error){if(generation===epoch&&error.name!=='AbortError')$('duaStatus').textContent=error.message;}
  finally{busy.delete(id);if(generation===epoch)render();}
 }
 $('duaForm').addEventListener('submit',async event=>{
  event.preventDefault();if(creating)return;const body=$('duaBody').value,generation=epoch;if(!body.trim()||[...body.trim()].length>400){$('duaStatus').textContent=d('invalid');return;}creating=true;labels();
  try{if(!getSession())await ensureSession();if(generation!==epoch)return;await api('/api/duas','POST',{body});if(generation!==epoch)return;if($('duaBody').value===body)$('duaBody').value='';await load({refresh:true});if(active)toast(d('published'));}
  catch(error){if(generation===epoch&&error.name!=='AbortError')$('duaStatus').textContent=error.message;}
  finally{creating=false;if(generation===epoch)labels();}
 });
 $('duaBody').addEventListener('input',labels);$('duaRefresh').addEventListener('click',()=>void load({refresh:true}));$('duaMore').addEventListener('click',()=>{if(cursor&&!loading)void load({next:true});});$('duaPrevious').addEventListener('click',()=>{if(history.length>1&&!loading)void load({previous:true});});
 function setActive(value){active=value;clearInterval(timer);if(active)timer=setInterval(()=>{if(!document.hidden&&!loading&&!creating&&!busy.size&&!confirmId&&history.length===1)void load({quiet:true});},15000);else{version++;loading=false;for(const [controller,method]of controllers)if(method==='GET')controller.abort();}}
 $('boardDialog').addEventListener('close',()=>setActive(false));window.addEventListener('languagechange',render);
 function stop(){epoch++;setActive(false);for(const controller of controllers.keys())controller.abort();items=[];history=[null];cursor=null;confirmId=null;busy.clear();creating=false;$('duaBody').value='';$('duaStatus').textContent='';render();}
 window.addEventListener('pagehide',stop);labels();
 return {setActive,load,stop,diagnostics:()=>({active,loaded:items.length,loading,page:history.length})};
}
