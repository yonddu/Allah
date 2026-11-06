import {setTimeout as delay} from 'node:timers/promises';
let last='not reached';for(let attempt=0;attempt<12;attempt++){
 try{const r=await fetch('https://noorrealm.com/api/health',{signal:AbortSignal.timeout(6000)});if(r.ok&&(await r.json()).ok){console.log('Verified HTTPS domain: https://noorrealm.com');process.exit(0);}last='HTTP '+r.status;}catch(e){last=String(e);}
 await delay(2000);
}throw new Error('Domain verification failed: '+last);
