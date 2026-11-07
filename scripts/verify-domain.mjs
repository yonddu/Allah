import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';import {resolve4} from 'node:dns/promises';
try{console.log('Domain DNS: '+(await resolve4('noorrealm.com')).join(','));}catch(e){console.log('Domain DNS pending: '+e.code);}
let last='not reached';for(let attempt=0;attempt<18;attempt++){
 try{const r=await fetch('https://noorrealm.com/api/health',{signal:AbortSignal.timeout(6000)});if(r.ok&&(await r.json()).ok){console.log('Verified HTTPS domain: https://noorrealm.com');await verifySelectionImages();process.exit(0);}last='HTTP '+r.status;}catch(e){last=String(e)+' '+(e.cause?.code||'');}
 await delay(5000);
}throw new Error('Domain verification failed: '+last);

async function verifySelectionImages(){
 const requests=[];
 for(const id of ['model08','model09','model10']){
  const expected=createHash('sha256').update(await readFile('public/user-models/'+id+'-covered.png')).digest('hex');
  for(const file of [id+'-covered.png',id+'.png'])requests.push((async()=>{
   const r=await fetch('https://noorrealm.com/user-models/'+file+'?coverage=permanent-socks-v1',{cache:'no-store',signal:AbortSignal.timeout(10000)});
   if(!r.ok)throw new Error('Selection image HTTP '+r.status+': '+file);
   const actual=createHash('sha256').update(new Uint8Array(await r.arrayBuffer())).digest('hex');
   if(actual!==expected)throw new Error('Selection image does not match the covered build: '+file);
  })());
 }
 await Promise.all(requests);console.log('Verified covered female selection images: 3 new URLs and 3 legacy URLs');
}
