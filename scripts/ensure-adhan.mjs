import {mkdir,readFile,writeFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
import {ADHAN_RECORDING} from '../public/adhan-source.js';
export async function ensureAdhan(){
 const path='public'+ADHAN_RECORDING.file,hash=b=>createHash('sha256').update(b).digest('hex');
 try{if(hash(await readFile(path))===ADHAN_RECORDING.sha256)return;}catch{}
 const response=await fetch(ADHAN_RECORDING.url,{signal:AbortSignal.timeout(30000),headers:{'User-Agent':'NoorRealm/0.1 (CC0 prayer alert; https://noorrealm.com)'}});
 if(!response.ok)throw new Error('Adhan recording download: HTTP '+response.status);
 const data=new Uint8Array(await response.arrayBuffer());if(data.length>4000000||hash(data)!==ADHAN_RECORDING.sha256)throw new Error('Adhan recording integrity check failed');
 await mkdir('public/audio',{recursive:true});await writeFile(path,data);console.log('CC0 adhan recording prepared.');
}
