import {mkdir,copyFile,readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {dirname,join} from 'node:path';
const require=createRequire(import.meta.url);
const threeBuild=dirname(require.resolve('three'));
await mkdir('public/vendor',{recursive:true});
for(const name of ['three.module.js','three.core.js'])await copyFile(join(threeBuild,name),join('public/vendor',name));
await copyFile(join(threeBuild,'../LICENSE'),'public/vendor/THREE-LICENSE.txt');
await copyFile(join(threeBuild,'../examples/jsm/environments/RoomEnvironment.js'),'public/vendor/RoomEnvironment.js');
const info=JSON.parse(await readFile(join(threeBuild,'../package.json'),'utf8'));
if(info.version!=='0.180.0')throw new Error('Unexpected Three.js version');
console.log('Static assets ready: Three.js '+info.version);

await mkdir('public/audio',{recursive:true});
try{
  const audio=await fetch('https://upload.wikimedia.org/wikipedia/commons/2/26/Flowing-water-100019.ogg',{signal:AbortSignal.timeout(15000),headers:{'User-Agent':'NoorPrototype/0.1 (Public domain sound; source in CREDITS.md)'}});
  if(!audio.ok)throw new Error('HTTP '+audio.status);
  const bytes=new Uint8Array(await audio.arrayBuffer());
  if(bytes[0]!==79||bytes[1]!==103||bytes[2]!==103||bytes[3]!==83)throw new Error('Invalid OGG audio');
  await writeFile('public/audio/water.ogg',bytes);
  console.log('Public domain water ambience prepared.');
}catch(e){console.warn('Local water sound unavailable; browser will use the public source URL. '+e.message);}
