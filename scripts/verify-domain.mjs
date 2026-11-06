import {setTimeout as delay} from 'node:timers/promises';import {resolve4} from 'node:dns/promises';
try{console.log('Domain DNS: '+(await resolve4('noorrealm.com')).join(','));}catch(e){console.log('Domain DNS pending: '+e.code);}
let last='not reached';for(let attempt=0;attempt<18;attempt++){
 try{const r=await fetch('https://noorrealm.com/api/health',{signal:AbortSignal.timeout(6000)});if(r.ok&&(await r.json()).ok){console.log('Verified HTTPS domain: https://noorrealm.com');process.exit(0);}last='HTTP '+r.status;}catch(e){last=String(e)+' '+(e.cause?.code||'');}
 await delay(5000);
}throw new Error('Domain verification failed: '+last);
