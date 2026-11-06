import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {LANGUAGES,t,chooseInitialLanguage} from '../public/i18n.js';
test('Every supported language has all messages and preserves formatting variables',async()=>{
  const en=JSON.parse(await readFile(new URL('../public/locales/en.json',import.meta.url),'utf8'));
  assert.equal(LANGUAGES.length,21);assert.equal(Object.keys(en).length,351);
  const variables=s=>(s.match(/\{\w+\}/g)||[]).sort();
  for(const {code}of LANGUAGES){
    const dict=JSON.parse(await readFile(new URL('../public/locales/'+code+'.json',import.meta.url),'utf8'));
    assert.deepEqual(Object.keys(dict).sort(),Object.keys(en).sort(),code+' missing keys');
    for(const [key,value]of Object.entries(en)){
      assert.equal(typeof dict[key],'string',code+':'+key);assert.ok(dict[key].trim(),code+':'+key+' empty');
      assert.deepEqual(variables(dict[key]),variables(value),code+':'+key+' broken variables');
      if(code!=='ko')assert.equal(/[\uac00-\ud7a3]/.test(dict[key]),false,code+':'+key+' Korean text leaked');
    }
  }
});
test('Right-to-left languages and default message formatting are configured',()=>{
  assert.deepEqual(LANGUAGES.filter(l=>l.dir==='rtl').map(l=>l.code).sort(),['ar','fa','ps','ur']);
  assert.equal(t('서버 {n}',{n:2}),'Server 2');
  assert.equal(t('친구 코드: {code}',{code:'ABC123'}),'Friend code: ABC123');
});

test('First visits follow browser language preferences with English fallback and explicit choices take priority',()=>{
  assert.equal(chooseInitialLanguage(null,null),'en');
  assert.equal(chooseInitialLanguage('invalid',null),'en');
  assert.equal(chooseInitialLanguage(null,null,['ar-SA','en-US']),'ar');
  assert.equal(chooseInitialLanguage(null,null,['en-GB']),'en');
  assert.equal(chooseInitialLanguage(null,null,['id-ID']),'id');
  assert.equal(chooseInitialLanguage(null,null,['de-DE','tr-TR']),'tr');
  assert.equal(chooseInitialLanguage(null,null,['de-DE']),'en');
  assert.equal(chooseInitialLanguage(null,null,['AR_sa']),'ar');
  assert.equal(chooseInitialLanguage(null,null,'ur-PK'),'ur');
  assert.equal(chooseInitialLanguage('invalid','invalid',['ar-SA']),'ar');
  assert.equal(chooseInitialLanguage(null,'ko',['ar-SA']),'ko');
  assert.equal(chooseInitialLanguage('ar','ko',['en-US']),'ar');
});
test('The initial HTML is readable English before JavaScript or a locale download completes',async()=>{
  const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
  assert.equal(/[\uac00-\ud7a3]/.test(html),false);
  assert.match(html,/>Start prayer</);assert.match(html,/>Noor Grand Sanctuary</);
  const importmap=html.match(/<script type="importmap">(.*?)<\/script>/s)[1];
  assert.deepEqual(JSON.parse(importmap),{imports:{three:'/vendor/three.module.js'}});
});
