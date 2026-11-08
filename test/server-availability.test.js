import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {availabilityIssue,probeRoomIssue} from '../public/server-availability.js';
import {LANGUAGES} from '../public/i18n.js';
import {AVAILABILITY_KEYS,AVAILABILITY_LOCALES} from '../public/availability-i18n.js';
import {runInNewContext} from 'node:vm';

test('Traffic notices require a capacity or HTTP overload signal, not an offline or denied request',async()=>{
 const rooms=[1,2,3].map(server=>({server,count:50,capacity:50}));
 assert.equal(availabilityIssue({rooms}),'full');
 rooms[2].count=49;assert.equal(availabilityIssue({rooms}),'connection');
 assert.equal(availabilityIssue({rooms,server:1}),'full');
 assert.equal(availabilityIssue({rooms,server:3}),'connection');
 assert.equal(availabilityIssue({rooms:[{server:1,count:null,capacity:50}]}),'connection');
 for(const status of [429,503])assert.equal(availabilityIssue({status}),'busy');
 for(const status of [401,403,404])assert.equal(availabilityIssue({status}),'connection');
 assert.equal(availabilityIssue({status:500}),'unavailable');
 assert.equal(await probeRoomIssue('mecca:1',{fetcher:async()=>{throw Error('offline');}}),'connection');
 assert.equal(await probeRoomIssue('mecca:1',{fetcher:async()=>new Response('Cloudflare HTML',{status:503})}),'busy');
 assert.equal(await probeRoomIssue('mecca:1',{fetcher:async()=>Response.json({rooms})}),'full');
 assert.equal(await probeRoomIssue('mecca:3',{fetcher:async()=>Response.json({rooms})}),'connection');
});

test('Every supported language has overload, expansion and recovery messages, with an optional existing donation link',async()=>{
 for(const {code}of LANGUAGES){const labels=AVAILABILITY_LOCALES[code];assert.equal(labels?.length,AVAILABILITY_KEYS.length,code);assert.ok(labels.every(label=>typeof label==='string'&&label.trim()),code);}
 assert.match(AVAILABILITY_LOCALES.ko[1],/서버 확장이 필요/);
 const html=await readFile('public/index.html','utf8'),panel=html.match(/<aside id="serverNotice"[\s\S]*?<\/aside>/)[0];
 assert.match(panel,/href="https:\/\/ko-fi.com\/solh130919"/);assert.match(panel,/id="serverRetry"/);assert.match(panel,/rel="noopener noreferrer"/);
});

test('A previously installed service worker shows the lightweight support page on navigation overload, and keeps offline errors separate',async()=>{
 const handlers={},fallback=await readFile('public/server-busy.html','utf8');let stored,networkStatus=200,offline=false;
 const cache={async add(path){assert.equal(path,'/server-busy.html');stored=fallback;},async match(){return stored?new Response(stored,{headers:{'Content-Type':'text/html'}}):undefined;}};
 runInNewContext(await readFile('public/sw.js','utf8'),{self:{addEventListener:(name,fn)=>handlers[name]=fn,skipWaiting:async()=>{},clients:{claim:async()=>{}}},caches:{open:async()=>cache},fetch:async()=>{if(offline)throw Error('offline');return new Response('Original response',{status:networkStatus});},Response});
 let install;handlers.install({waitUntil:p=>install=p});await install;
 const navigate=()=>{let response;handlers.fetch({request:{mode:'navigate'},respondWith:p=>response=p});return response;};
 assert.equal(await(await navigate()).text(),'Original response');
 for(const status of [429,503]){networkStatus=status;const response=await navigate();assert.match(await response.text(),/https:\/\/ko-fi.com\/solh130919/);}
 offline=true;const disconnected=await(await navigate()).text();assert.match(disconnected,/Noor is offline/);assert.doesNotMatch(disconnected,/Server expansion/);
 offline=false;networkStatus=200;assert.equal(await(await navigate()).text(),'Original response');
 assert.doesNotMatch(fallback,/<script|\/api\//);
});
