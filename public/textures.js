import * as THREE from 'three';
import {COLORS} from './core.js';
let anisotropy=4;
export function setAnisotropy(v){anisotropy=Math.min(v,8);}
const cache=new Map();
function rng(seed){return ()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
function canvas(w,h=w){const c=document.createElement('canvas');c.width=w;c.height=h;return [c,c.getContext('2d')];}
function texture(c,color=true){const t=new THREE.CanvasTexture(c);if(color)t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=anisotropy;return t;}
function grain(ctx,w,h,seed,strength=8){
  const random=rng(seed),img=ctx.getImageData(0,0,w,h),d=img.data;
  for(let i=0;i<d.length;i+=4){const n=(random()-.5)*strength;d[i]+=n;d[i+1]+=n;d[i+2]+=n;}
  ctx.putImageData(img,0,0);
}
export function marbleTexture(){
  if(cache.has('marble'))return cache.get('marble');
  const [c,g]=canvas(1024),random=rng(401);
  g.fillStyle='#e9e6da';g.fillRect(0,0,1024,1024);
  // Layer broad, translucent mineral clouds beneath hairline veins.
  for(let n=0;n<45;n++){
    const x=random()*1024,y=random()*1024,r=70+random()*300;
    const grad=g.createRadialGradient(x,y,0,x,y,r);grad.addColorStop(0,n%3?'rgba(174,178,162,.08)':'rgba(255,255,245,.25)');grad.addColorStop(1,'rgba(220,221,207,0)');
    g.fillStyle=grad;g.fillRect(x-r,y-r,2*r,2*r);
  }
  for(let n=0;n<55;n++){
    const y=random()*1500-250,amp=15+random()*120;
    g.beginPath();g.moveTo(-60,y);
    g.bezierCurveTo(250,y+amp,460,y-amp,1100,y+160);
    g.strokeStyle=n%5?'rgba(105,124,112,.065)':'rgba(155,139,102,.11)';
    g.lineWidth=n%5?.4+random()*2.2:2+random()*8;
    g.shadowBlur=n%5?0:16;g.shadowColor='rgba(113,127,114,.15)';g.stroke();
    if(n%5===0){g.lineWidth=.6;g.strokeStyle='rgba(142,132,101,.15)';g.shadowBlur=0;g.stroke();}
  }
  g.shadowBlur=0;grain(g,1024,1024,93,5);
  const t=texture(c);cache.set('marble',t);return t;
}
export function weaveTexture(){
  if(cache.has('weave'))return cache.get('weave');
  const [c,g]=canvas(256);g.fillStyle='#9b9b9b';g.fillRect(0,0,256,256);
  for(let y=0;y<256;y+=4){g.fillStyle=y%8?'#aaa':'#888';g.fillRect(0,y,256,1);}
  for(let x=0;x<256;x+=3){g.fillStyle=x%6?'#a3a3a3':'#8f8f8f';g.fillRect(x,0,1,256);}
  const t=texture(c,false);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(3,5);cache.set('weave',t);return t;
}
export function metalTexture(){
  if(cache.has('metal'))return cache.get('metal');
  const [c,g]=canvas(256),random=rng(12);g.fillStyle='#aaa';g.fillRect(0,0,256,256);
  for(let n=0;n<1600;n++){g.fillStyle='rgba(255,255,255,'+(random()*.12)+')';g.fillRect(random()*256,random()*256,20+random()*80,.5);}
  grain(g,256,256,9,8);const t=texture(c,false);cache.set('metal',t);return t;
}
function star(ctx,cx,cy,r,points,rotation=0){
  ctx.beginPath();
  for(let n=0;n<points*2;n++){const a=n*Math.PI/points+rotation,rr=n%2?r*.46:r;const x=cx+Math.cos(a)*rr,y=cy+Math.sin(a)*rr;n?ctx.lineTo(x,y):ctx.moveTo(x,y);}
  ctx.closePath();ctx.stroke();
}
function arch(ctx,x,y,w,h){
  ctx.beginPath();ctx.moveTo(x,y+h);ctx.lineTo(x,y+w*.56);ctx.bezierCurveTo(x,y+w*.2,x+w*.3,y+w*.2,x+w*.5,y);ctx.bezierCurveTo(x+w*.7,y+w*.2,x+w,y+w*.2,x+w,y+w*.56);ctx.lineTo(x+w,y+h);ctx.closePath();
}
export function rugTexture(color,pattern,high=true){
  const key=color+':'+pattern+':'+high;
  if(cache.has(key))return cache.get(key);
  const w=high?1024:512,h=w*2,[c,g]=canvas(w,h),scale=w/1024;
  g.scale(scale,scale);
  const W=1024,H=2048,gold='#c8ac72',pale='#e0c995',base=COLORS.rug[color]||COLORS.rug[0];
  g.fillStyle=base;g.fillRect(0,0,W,H);
  const glow=g.createRadialGradient(512,900,40,512,1000,1100);
  glow.addColorStop(0,'rgba(220,218,162,.13)');glow.addColorStop(1,'rgba(0,0,0,.3)');g.fillStyle=glow;g.fillRect(0,0,W,H);
  g.strokeStyle=gold;g.lineWidth=3;g.strokeRect(19,20,986,2008);g.strokeRect(31,33,962,1982);
  g.fillStyle='rgba(9,19,16,.35)';g.fillRect(46,47,932,1954);
  g.fillStyle=base;g.fillRect(115,116,794,1816);
  g.strokeStyle=pale;g.lineWidth=2;g.strokeRect(105,106,814,1836);g.strokeRect(121,122,782,1804);
  // Interlaced borders and floral embroidery.
  g.strokeStyle=gold;g.lineWidth=2;
  for(let y=78;y<H-60;y+=51){
    for(const x of [77,947]){
      star(g,x,y,15,4,Math.PI/4);
      g.beginPath();g.moveTo(x,y+16);g.bezierCurveTo(x-18,y+30,x+18,y+38,x,y+51);g.stroke();
    }
  }
  for(const y of [77,1971])for(let x=130;x<930;x+=52)star(g,x,y,16,8);
  if(pattern==='mihrab'){
    g.fillStyle='rgba(5,20,17,.2)';arch(g,180,230,664,1580);g.fill();
    g.strokeStyle=gold;g.lineWidth=7;g.stroke();g.lineWidth=2;arch(g,198,256,628,1530);g.stroke();
    g.strokeStyle='#b99557';g.lineWidth=3;star(g,512,1000,175,8,Math.PI/8);star(g,512,1000,130,8);
    for(let n=0;n<8;n++){const a=n*Math.PI/4;star(g,512+Math.cos(a)*100,1000+Math.sin(a)*100,24,8);}
    for(const x of [245,779])for(let y=700;y<1640;y+=95){
      g.beginPath();g.ellipse(x,y,12,29,x<500?.5:-.5,0,Math.PI*2);g.stroke();
    }
    star(g,512,455,45,8);g.beginPath();g.moveTo(512,335);g.lineTo(512,400);g.stroke();
  }else if(pattern==='geometry'){
    g.strokeStyle=gold;g.lineWidth=2;
    for(let y=240;y<1850;y+=160)for(let x=230;x<850;x+=190){
      star(g,x+(Math.floor(y/160)%2?0:25),y,67,8,Math.PI/8);
      star(g,x+(Math.floor(y/160)%2?0:25),y,38,4,Math.PI/4);
    }
  }else{
    g.strokeStyle=gold;g.lineWidth=3;
    for(let col=0;col<5;col++){
      const x=230+col*142;g.beginPath();g.moveTo(x,1820);g.bezierCurveTo(x+100,1300,x-100,900,x,270);g.stroke();
      for(let y=370;y<1780;y+=160){g.beginPath();g.ellipse(x+(y%320<160?-24:24),y,15,42,y%320<160?-.7:.7,0,Math.PI*2);g.stroke();star(g,x,y-55,20,6);}
    }
  }
  // Fine cross-woven thread highlights, visible at close range.
  g.globalAlpha=.095;g.lineWidth=1;
  for(let y=0;y<H;y+=3){g.strokeStyle=y%6?'#f9e8c7':'#110e0a';g.beginPath();g.moveTo(0,y);g.lineTo(W,y);g.stroke();}
  g.globalAlpha=.055;
  for(let x=0;x<W;x+=3){g.strokeStyle=x%6?'#ffffff':'#050703';g.beginPath();g.moveTo(x,0);g.lineTo(x,H);g.stroke();}
  g.globalAlpha=1;g.resetTransform();grain(g,w,h,80+color,8);
  const t=texture(c);cache.set(key,t);return t;
}
export function robeTexture(){
  if(cache.has('robe'))return cache.get('robe');
  const [c,g]=canvas(256);g.fillStyle='#f5f2e8';g.fillRect(0,0,256,256);
  for(let x=0;x<256;x++){const l=235+Math.round(Math.sin(x*.19)*6+Math.sin(x*1.7)*3);g.fillStyle='rgb('+l+','+l+','+(l-4)+')';g.fillRect(x,0,1,256);}
  for(let y=0;y<256;y+=3){g.fillStyle='#00000007';g.fillRect(0,y,256,1);}
  const t=texture(c);cache.set('robe',t);return t;
}

export function tileTexture(){
  if(cache.has('tiles'))return cache.get('tiles');
  const [c,g]=canvas(1024);g.fillStyle='#e7e1cb';g.fillRect(0,0,1024,1024);
  for(let y=0;y<1024;y+=256)for(let x=0;x<1024;x+=256){
    g.strokeStyle='#285e89';g.lineWidth=8;g.strokeRect(x+8,y+8,240,240);
    g.strokeStyle='#4c8c9b';g.lineWidth=3;g.strokeRect(x+20,y+20,216,216);
    g.strokeStyle='#1c5880';g.lineWidth=6;star(g,x+128,y+128,91,8,Math.PI/8);
    g.strokeStyle='#7eacb1';g.lineWidth=3;star(g,x+128,y+128,58,8);
    for(let n=0;n<8;n++){
      const a=n*Math.PI/4;g.beginPath();g.ellipse(x+128+Math.cos(a)*63,y+128+Math.sin(a)*63,10,23,a,0,Math.PI*2);g.stroke();
    }
  }
  grain(g,1024,1024,66,5);const t=texture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(5,2);cache.set('tiles',t);return t;
}
