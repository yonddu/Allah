import {generateRequestDetails} from 'web-push';
import {PRAYER_CITIES} from './public/prayer-cities.js';
import {prayerSchedule,PRAYER_METHODS,validZone} from './public/prayer-times-core.js';
export const PRAYER_EN={fajr:'Fajr',dhuhr:'Dhuhr',asr:'Asr',maghrib:'Maghrib',isha:'Isha'};
const json=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
export function validSubscription(s){
 try{const u=new URL(s.endpoint);if(u.protocol!=='https:'||u.username||u.password||u.port||u.hash||s.endpoint.length>2048||!(['fcm.googleapis.com','web.push.apple.com'].includes(u.hostname)||u.hostname.endsWith('.push.services.mozilla.com')))return false;
  const bytes=v=>{if(typeof v!=='string'||!/^[A-Za-z0-9_-]+$/.test(v))return 0;return atob(v.replaceAll('-','+').replaceAll('_','/')).length;};return bytes(s.keys?.p256dh)===65&&bytes(s.keys?.auth)===16;
 }catch{return false;}
}
export function reminderPreferences(data){
 if(!['number','string'].includes(typeof data.cityId)||!/^\d+$/.test(String(data.cityId)))throw new Error('Choose a supported city.');
 const id=Number(data.cityId),city=Number.isInteger(id)&&id>=0&&id!==15?PRAYER_CITIES[id-(id>15?1:0)]:null;if(!city)throw new Error('Choose a supported city.');
 return {cityId:id,city:city[0],lat:city[2],lon:city[3],zone:validZone(data.zone)?data.zone:city[4],method:PRAYER_METHODS.includes(data.method)?data.method:'auto',madhab:data.madhab==='Hanafi'?'Hanafi':'Shafi',ishaOffset:Math.max(-60,Math.min(120,Math.round(Number(data.ishaOffset)||0)))};
}
export function nextReminder(record,now=Date.now()){
 const entries=[];for(const offset of [0,1])for(const p of prayerSchedule(record.preferences,new Date(now+offset*86400000)).entries){const startsAt=+p.time,key=p.id+':'+startsAt;if(Number.isFinite(startsAt)&&startsAt>now&&startsAt-300000>=now-120000&&key!==record.last)entries.push({key,prayer:p.id,startsAt,at:startsAt-300000});}
 return entries.sort((a,b)=>a.at-b.at)[0]||null;
}
export async function reminderBody(request){
 const reader=request.body?.getReader();if(!reader)throw new Error('Missing request.');let size=0,text='';const decoder=new TextDecoder();try{while(true){const p=await reader.read();if(p.done)break;size+=p.value.byteLength;if(size>8192){await reader.cancel();throw new Error('Request too large.');}text+=decoder.decode(p.value,{stream:true});}text+=decoder.decode();}finally{reader.releaseLock();}return JSON.parse(text);
}
export class PrayerReminders{
 constructor(ctx,env){this.ctx=ctx;this.env=env;this.now=()=>Date.now();this.deliver=details=>fetch(details.endpoint,{method:'POST',headers:details.headers,body:details.body,redirect:'manual',signal:AbortSignal.timeout(12000)});}
 async fetch(request){
  if(new URL(request.url).hostname!=='reminder.internal')return json({error:'Not found'},404);
  const current=await this.ctx.storage.get('subscription');
  if(new URL(request.url).pathname==='/test'&&this.env.NOOR_PUSH_TEST_MODE==='1'&&request.method==='POST'&&current){current.testEvent={key:'test:'+this.now(),prayer:'asr',startsAt:this.now()+300000,at:this.now()+1000};await this.ctx.storage.put('subscription',current);await this.ctx.storage.setAlarm(current.testEvent.at);return json({ok:true});}
  if(request.method==='GET'){const next=current&&nextReminder(current,this.now());return json({enabled:!!current,city:current?.preferences.city,nextAt:next?.at||null,lastDelivered:current?.last||null,...(this.env.NOOR_PUSH_TEST_MODE==='1'?{testProof:current?.testProof}: {})});}
  if(request.method==='DELETE'){await this.ctx.storage.delete('subscription');await this.ctx.storage.deleteAlarm();return json({enabled:false});}
  if(request.method!=='POST')return json({error:'Method not allowed'},405);
  let data;try{data=await reminderBody(request);if(!validSubscription(data.subscription))throw new Error('Invalid push subscription.');data.preferences=reminderPreferences(data);}catch(e){return json({error:e.message},400);}
  if(!this.env.NOOR_PUSH_PUBLIC_KEY||!this.env.NOOR_PUSH_PRIVATE_KEY)return json({error:'Reminders are not configured yet.'},503);
  const bucket=Math.floor(this.now()/60000),rate=current?.rateBucket===bucket?(current.rateCount||0)+1:1;if(rate>30)return json({error:'Please wait a moment.'},429);
  const record={subscription:{endpoint:data.subscription.endpoint,keys:{p256dh:data.subscription.keys.p256dh,auth:data.subscription.keys.auth}},preferences:data.preferences,revision:crypto.randomUUID(),updated:this.now(),rateBucket:bucket,rateCount:rate,last:current?.last||null};
  await this.ctx.storage.put('subscription',record);const next=nextReminder(record,this.now());if(next)await this.ctx.storage.setAlarm(Math.max(this.now()+1000,next.at));return json({enabled:true,city:record.preferences.city,nextAt:next?.at||null});
 }
 async alarm(){
  const record=await this.ctx.storage.get('subscription');if(!record)return;const now=this.now(),event=this.env.NOOR_PUSH_TEST_MODE==='1'&&record.testEvent?record.testEvent:nextReminder(record,now);if(!event)return;
  if(event.at>now+1000){await this.ctx.storage.setAlarm(event.at);return;}
  const payload=JSON.stringify({prayer:PRAYER_EN[event.prayer],startsAt:event.startsAt,tag:'noor-prayer:'+event.key,city:record.preferences.city});
  let response;try{const details=generateRequestDetails(record.subscription,payload,{TTL:120,urgency:'high',vapidDetails:{subject:'https://noorrealm.com',publicKey:this.env.NOOR_PUSH_PUBLIC_KEY,privateKey:this.env.NOOR_PUSH_PRIVATE_KEY}});if(this.env.NOOR_PUSH_TEST_MODE==='1'){record.testProof={encryptedBytes:details.body.length,encoding:details.headers['Content-Encoding'],vapid:details.headers.Authorization?.startsWith('vapid ')};response={ok:true,status:201};}else response=await this.deliver(details);}catch{response={status:503,ok:false};}
  const current=await this.ctx.storage.get('subscription');if(current?.revision!==record.revision)return;
  if(response.status===404||response.status===410){await this.ctx.storage.delete('subscription');await this.ctx.storage.deleteAlarm();return;}
  if(response.ok){record.last=event.key;record.failures=0;delete record.testEvent;await this.ctx.storage.put('subscription',record);}else{record.failures=(record.failures||0)+1;if(record.failures<3&&this.now()+30000<event.startsAt){await this.ctx.storage.put('subscription',record);await this.ctx.storage.setAlarm(this.now()+30000);return;}record.last=event.key;record.failures=0;delete record.testEvent;await this.ctx.storage.put('subscription',record);}
  const next=nextReminder(record,this.now());if(next)await this.ctx.storage.setAlarm(Math.max(this.now()+1000,next.at));
 }
}
