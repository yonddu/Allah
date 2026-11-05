import {readdir,readFile,access} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
const paths=['worker.js','community.js',...(await readdir('public')).filter(p=>p.endsWith('.js')).map(p=>'public/'+p),...(await readdir('scripts')).filter(p=>p.endsWith('.mjs')).map(p=>'scripts/'+p)];
for(const path of paths){const result=spawnSync(process.execPath,['--check',path],{stdio:'inherit'});if(result.status!==0)process.exit(result.status||1);}
for(const file of ['public/index.html','public/style.css','wrangler.jsonc','HANDOFF.md'])await access(file);
const config=JSON.parse(await readFile('wrangler.jsonc','utf8'));
if(config.assets.directory!=='./public'||config.durable_objects.bindings[0].class_name!=='PrayerRoom')throw new Error('Invalid Cloudflare bindings');
console.log('Syntax and configuration checks passed.');
