import {mkdir,writeFile,readFile,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createCanvas} from '@napi-rs/canvas';
import {buildArchitecture} from './hall-geometry.mjs';
import {writeGlb} from './write-glb.mjs';

export async function bakeHalls(){
  const inputs=await Promise.all(['scripts/bake-halls.mjs','scripts/hall-geometry.mjs','scripts/write-glb.mjs','public/textures.js'].map(p=>readFile(p)));
  const fingerprint=createHash('sha256').update(Buffer.concat(inputs)).digest('hex');
  try{
    const old=JSON.parse(await readFile('public/assets/build-info.json','utf8'));
    if(old.fingerprint===fingerprint){
      await Promise.all(old.files.map(p=>access('public/assets/'+p)));console.log('Compiled hall assets unchanged.');return old;
    }
  }catch{}
  await mkdir('public/assets/halls',{recursive:true});
  for(const tier of ['high','low'])await mkdir('public/assets/textures/'+tier,{recursive:true});
  const originalDocument=globalThis.document;
  globalThis.document={createElement:type=>{if(type!=='canvas')throw new Error(type);return createCanvas(1,1);}};
  const textures=await import('../public/textures.js');
  const canvases={
    marble:textures.marbleTexture().image,tile:textures.tileTexture().image,
    'red-carpet':textures.rugTexture(1,'mihrab',true).image,'green-carpet':textures.rugTexture(0,'mihrab',true).image
  };
  function custom(name,w,h,draw){const c=createCanvas(w,h);draw(c.getContext('2d'),w,h);canvases[name]=c;}
  custom('plaster',512,512,(g,w,h)=>{
    g.fillStyle='#eeeadd';g.fillRect(0,0,w,h);const data=g.getImageData(0,0,w,h);
    for(let n=0;n<data.data.length;n+=4){const v=((n*1664525+1013904223)>>>12)%9-4;data.data[n]+=v;data.data[n+1]+=v;data.data[n+2]+=v;}
    g.putImageData(data,0,0);
  });
  custom('column',1024,2048,(g,w,h)=>{
    g.fillStyle='#f1eee3';g.fillRect(0,0,w,h);
    for(let stem=0;stem<4;stem++){
      const x=130+stem*245;
      g.strokeStyle='#728d6f';g.lineWidth=3;g.beginPath();g.moveTo(x,1900);g.bezierCurveTo(x-130,1400,x+160,1000,x,220);g.stroke();
      for(let y=400;y<1800;y+=190){
        const side=((y/190|0)+stem)%2?1:-1;
        g.fillStyle=stem%2?'#9ca98b':'#697f64';g.beginPath();g.ellipse(x+side*28,y,13,47,side*.7,0,Math.PI*2);g.fill();
        const cx=x-side*27,cy=y-75;
        g.fillStyle=stem%2?'#c7aa79':'#bca5a0';
        for(let p=0;p<6;p++){const a=p*Math.PI/3;g.beginPath();g.ellipse(cx+Math.cos(a)*18,cy+Math.sin(a)*18,9,21,a+Math.PI/2,0,Math.PI*2);g.fill();}
        g.fillStyle='#bb9b59';g.beginPath();g.arc(cx,cy,8,0,Math.PI*2);g.fill();
      }
    }
  });
  custom('ceiling',1024,1024,(g,w,h)=>{
    g.fillStyle='#eee8d4';g.fillRect(0,0,w,h);
    g.strokeStyle='#bca66e';g.lineWidth=3;
    for(let y=0;y<h;y+=256)for(let x=0;x<w;x+=256){
      for(const r of [28,64,102]){g.beginPath();g.arc(x+128,y+128,r,0,Math.PI*2);g.stroke();}
      for(let n=0;n<16;n++){const a=n*Math.PI/8;g.beginPath();g.ellipse(x+128+Math.cos(a)*55,y+128+Math.sin(a)*55,10,38,a,0,Math.PI*2);g.stroke();}
    }
  });
  custom('floor-inlay',1024,1536,(g,w,h)=>{
    g.clearRect(0,0,w,h);g.lineCap='round';
    for(const side of [-1,1])for(let row=0;row<6;row++){
      const x=side<0?115:910,y=120+row*250;
      g.strokeStyle='#7e8c6a';g.lineWidth=3;g.beginPath();g.moveTo(x,y+100);g.bezierCurveTo(x+side*40,y+15,x-side*75,y-15,x,y-100);g.stroke();
      for(let leaf=0;leaf<5;leaf++){
        const yy=y-70+leaf*34,xx=x+Math.sin(leaf)*35;
        g.fillStyle=leaf%2?'#9b9d79':'#7c8b70';g.beginPath();g.ellipse(xx,yy,10,26,side*.7,0,Math.PI*2);g.fill();
      }
      g.fillStyle=row%2?'#d7b2ac':'#b5b89c';
      for(let p=0;p<8;p++){const a=p*Math.PI/4;g.beginPath();g.ellipse(x+Math.cos(a)*21,y+Math.sin(a)*21,11,25,a+Math.PI/2,0,Math.PI*2);g.fill();}
      g.fillStyle='#b49a5e';g.beginPath();g.arc(x,y,9,0,Math.PI*2);g.fill();
    }
  });
  custom('floor-ao',512,580,(g,w,h)=>{
    g.clearRect(0,0,w,h);
    for(const [x1,y1,x2,y2,rect]of [[0,0,60,0,[0,0,60,h]],[w,0,w-60,0,[w-60,0,60,h]],[0,0,0,55,[0,0,w,55]],[0,h,0,h-50,[0,h-50,w,50]]]){
      const shade=g.createLinearGradient(x1,y1,x2,y2);shade.addColorStop(0,'rgba(20,25,17,.38)');shade.addColorStop(1,'rgba(20,25,17,0)');g.fillStyle=shade;g.fillRect(...rect);
    }
    for(const x of [-8,8])for(const z of [-9,0,9]){
      const px=(x/30+.5)*w,py=(.5+z/34)*h,r=26,shade=g.createRadialGradient(px,py,2,px,py,r);
      shade.addColorStop(0,'rgba(12,18,12,.48)');shade.addColorStop(1,'rgba(12,18,12,0)');g.fillStyle=shade;g.fillRect(px-r,py-r,2*r,2*r);
    }
  });
  custom('environment',512,256,(g,w,h)=>{
    const sky=g.createLinearGradient(0,0,0,h);sky.addColorStop(0,'#aebcb8');sky.addColorStop(.45,'#f7efdb');sky.addColorStop(.55,'#dfcfa8');sky.addColorStop(1,'#4b5548');g.fillStyle=sky;g.fillRect(0,0,w,h);
    for(let n=0;n<8;n++){const glow=g.createRadialGradient(35+n*67,110,1,35+n*67,110,38);glow.addColorStop(0,'#fff6d8');glow.addColorStop(1,'#d0c9af00');g.fillStyle=glow;g.fillRect(n*67,60,80,100);}
  });
  const files=[],models={};
  for(const [name,c]of Object.entries(canvases)){
    for(const tier of ['high','low']){
      const max=tier==='high'?1024:512,ratio=Math.min(1,max/c.width),out=createCanvas(Math.round(c.width*ratio),Math.round(c.height*ratio)),g=out.getContext('2d');
      g.imageSmoothingEnabled=true;g.drawImage(c,0,0,out.width,out.height);
      const path='textures/'+tier+'/'+name+'.png';await writeFile('public/assets/'+path,out.toBuffer('image/png'));files.push(path);
    }
  }
  if(originalDocument===undefined)delete globalThis.document;else globalThis.document=originalDocument;
  for(const map of ['zayed','blue','nabawi'])for(const tier of ['low','high']){
    const model=buildArchitecture(map,tier),path='halls/'+map+'-'+tier+'.glb',stats=await writeGlb('public/assets/'+path,model,tier);
    model.batches.forEach(p=>p.geometry.dispose());models[map+'-'+tier]=stats;files.push(path);
    if(stats.drawCalls>16||stats.triangles>(tier==='low'?85000:250000)||stats.bytes>(tier==='low'?3500000:9000000))throw new Error('Architecture exceeds budget: '+map+' '+tier+' '+JSON.stringify(stats));
    console.log(map+' '+tier+': '+stats.drawCalls+' draws, '+stats.triangles+' triangles, '+stats.bytes+' bytes');
  }
  const info={fingerprint,models,files};await writeFile('public/assets/build-info.json',JSON.stringify(info,null,2));return info;
}
