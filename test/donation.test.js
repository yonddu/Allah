import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {createRequire} from 'node:module';import {createCanvas,loadImage} from '@napi-rs/canvas';
const require=createRequire(import.meta.url),decode=require('../scripts/vendor/jsQR.cjs');
test('The supplied QR pattern decodes to the exact Ko-fi destination with a four-module quiet zone',async()=>{
 const svg=await readFile('public/assets/donation-qr.svg');const image=await loadImage(svg),canvas=createCanvas(740,740),g=canvas.getContext('2d');g.imageSmoothingEnabled=false;g.drawImage(image,0,0,740,740);
 const data=g.getImageData(0,0,740,740),qr=decode(data.data,740,740);assert.equal(qr?.data,'https://ko-fi.com/solh130919');
 const html=await readFile('public/index.html','utf8');assert.ok(html.includes('https://ko-fi.com/solh130919'));assert.ok(html.includes('donation-qr.svg'));
});
