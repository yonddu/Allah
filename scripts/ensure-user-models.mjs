import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {createWriteStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {Readable,Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {prepareUserModels,inspectGLB} from './prepare-user-models.mjs';
import {userRigConfig} from '../public/user-skinning.js';
import * as THREE from 'three';
const run=promisify(execFile);
export async function ensureUserModels(){
 const sourceText=await readFile('scripts/user-model-sources.json','utf8'),source=JSON.parse(sourceText);
 const fingerprint=createHash('sha256').update(sourceText).update(await readFile('scripts/prepare-user-models.mjs')).update(await readFile('scripts/ensure-user-models.mjs')).update(await readFile('public/user-skinning.js')).digest('hex');
 const output='public/user-models',raw='node_modules/.cache/noor-user-models';
 try{
  if((await readFile(output+'/source.sha256','utf8')).trim()===fingerprint){
   await Promise.all(source.models.flatMap(m=>['full.glb','near.glb','far.glb','png'].map(s=>access(output+'/'+m.id+(s==='png'?'.png':'-'+s)))));await access(output+'/runtime.json');return;
  }
 }catch{}
 await mkdir(raw,{recursive:true});
 const valid=async m=>{try{const b=await readFile(raw+'/'+m.file);return b.length===m.bytes&&createHash('sha256').update(b).digest('hex')===m.sha256;}catch{return false;}};
 if(!(await Promise.all(source.models.map(valid))).every(Boolean)){
  console.log('Downloading the supplied character archive.');
  const response=await fetch(source.folderUrl,{signal:AbortSignal.timeout(180000)});
  if(!response.ok)throw new Error('Character archive HTTP '+response.status);
  let downloaded=0;const limit=new Transform({transform(chunk,encoding,done){downloaded+=chunk.length;if(downloaded>60000000)done(new Error('Character archive exceeds the build download budget'));else done(null,chunk);}});
  const archive=raw+'/source.zip';await pipeline(Readable.fromWeb(response.body),limit,createWriteStream(archive));
  // Read only the pinned filenames; never extract arbitrary ZIP paths.
  await run('python3',['-c',`import json,zipfile,pathlib,sys
source=json.load(open('scripts/user-model-sources.json'))
root=pathlib.Path(sys.argv[1]); archive=zipfile.ZipFile(root/'source.zip')
for model in source['models']:
    items=[item for item in archive.infolist() if pathlib.PurePosixPath(item.filename).name==model['file']]
    if len(items)!=1 or items[0].file_size!=model['bytes']: raise ValueError('Unexpected source file: '+model['file'])
    (root/model['file']).write_bytes(archive.read(items[0]))
`,raw],{timeout:120000});
 }
 for(const m of source.models)if(!await valid(m))throw new Error('Supplied character checksum mismatch: '+m.id);
 const manifest=await prepareUserModels(raw,output,source.models),runtime={};
 for(const model of manifest.models){
  const paths={},seen=new Map();
  for(const level of ['full','near','far']){
   const file=model.variants[level].file,bytes=await readFile(output+'/'+file),hash=createHash('sha256').update(bytes).digest('hex');
   if(!seen.has(hash))seen.set(hash,file);paths[level]=seen.get(hash);
  }
  const full=inspectGLB(new Uint8Array(await readFile(output+'/'+paths.full))),geometry=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(full.positions,3));
  runtime[model.id]={...paths,rig:userRigConfig(geometry)};geometry.dispose();
 }
 await writeFile(output+'/runtime.json',JSON.stringify(runtime));
 await writeFile(output+'/source.sha256',fingerprint);
}
