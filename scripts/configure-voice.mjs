import {spawn} from 'node:child_process';
const secrets=['NOOR_TURN_KEY_ID','NOOR_TURN_API_TOKEN'];
for(const name of secrets){
 const value=process.env[name];if(!value)throw new Error('Missing voice deployment secret: '+name);
 await new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,['node_modules/wrangler/bin/wrangler.js','secret','put',name],{stdio:['pipe','pipe','pipe']});
  let log='';for(const stream of [child.stdout,child.stderr])stream.on('data',b=>log=(log+b).slice(-3000));
  child.stdin.end(value+'\n');child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error('Unable to configure '+name+': '+log.replaceAll(value,'[redacted]'))));
 });
 console.log('Configured runtime secret: '+name);
}

const relay=await fetch('https://rtc.live.cloudflare.com/v1/turn/keys/'+process.env.NOOR_TURN_KEY_ID+'/credentials/generate-ice-servers',{method:'POST',headers:{Authorization:'Bearer '+process.env.NOOR_TURN_API_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({ttl:60}),signal:AbortSignal.timeout(12000)});
if(!relay.ok)throw new Error('Voice relay credential check failed: HTTP '+relay.status);
const ice=await relay.json();if(!ice.iceServers?.some(server=>[server.urls].flat().some(url=>url.startsWith('turn'))))throw new Error('No voice relay was issued');
console.log('Voice relay credentials validated.');
