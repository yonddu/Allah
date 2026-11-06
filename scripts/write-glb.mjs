import {writeFile} from 'node:fs/promises';
export async function writeGlb(path,model,tier='low'){
  const chunks=[],bufferViews=[],accessors=[],images=[],textures=[],materialIndices=new Map(),materials=[];
  let bytes=0,triangles=0;
  function append(array,target){
    const pad=(4-bytes%4)%4;if(pad){chunks.push(Buffer.alloc(pad));bytes+=pad;}
    const view={buffer:0,byteOffset:bytes,byteLength:array.byteLength,target};
    const index=bufferViews.push(view)-1;chunks.push(Buffer.from(array.buffer,array.byteOffset,array.byteLength));bytes+=array.byteLength;return index;
  }
  function attribute(attr,type,bounds=false){
    const view=append(attr.array,34962),data={bufferView:view,componentType:5126,count:attr.count,type};
    if(bounds){const a=attr.array;data.min=[Infinity,Infinity,Infinity];data.max=[-Infinity,-Infinity,-Infinity];for(let n=0;n<a.length;n+=3)for(let k=0;k<3;k++){data.min[k]=Math.min(data.min[k],a[n+k]);data.max[k]=Math.max(data.max[k],a[n+k]);}}
    return accessors.push(data)-1;
  }
  for(const [key,m]of Object.entries(model.materials)){
    const pbr={baseColorFactor:m.color,metallicFactor:m.metallic||0,roughnessFactor:m.roughness??.8};
    if(m.map){const image=images.push({uri:'../textures/'+tier+'/'+m.map+'.png'})-1;const texture=textures.push({source:image,sampler:0})-1;pbr.baseColorTexture={index:texture};}
    const json={name:m.name,pbrMetallicRoughness:pbr};
    if(m.doubleSided)json.doubleSided=true;if(m.alpha)json.alphaMode='BLEND';if(m.emissive)json.emissiveFactor=m.emissive;if(m.unlit)json.extensions={KHR_materials_unlit:{}};
    materialIndices.set(key,materials.push(json)-1);
  }
  const primitives=model.batches.map(({material,geometry:g})=>{
    const primitive={attributes:{POSITION:attribute(g.getAttribute('position'),'VEC3',true),NORMAL:attribute(g.getAttribute('normal'),'VEC3'),TEXCOORD_0:attribute(g.getAttribute('uv'),'VEC2')},material:materialIndices.get(material),mode:4};
    if(g.getAttribute('color'))primitive.attributes.COLOR_0=attribute(g.getAttribute('color'),'VEC3');
    const index=g.getIndex();primitive.indices=accessors.push({bufferView:append(index.array,34963),componentType:index.array.BYTES_PER_ELEMENT===2?5123:5125,count:index.count,type:'SCALAR'})-1;
    triangles+=index.count/3;return primitive;
  });
  const pad=(4-bytes%4)%4;if(pad){chunks.push(Buffer.alloc(pad));bytes+=pad;}
  const gltf={asset:{version:'2.0',generator:'Noor offline architectural asset compiler'},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0}],meshes:[{name:'Batched sanctuary architecture',primitives}],materials,images,textures,samplers:[{magFilter:9729,minFilter:9987,wrapS:10497,wrapT:10497}],buffers:[{byteLength:bytes}],bufferViews,accessors,extensionsUsed:['KHR_materials_unlit']};
  let json=Buffer.from(JSON.stringify(gltf));const padding=(4-json.length%4)%4;if(padding)json=Buffer.concat([json,Buffer.alloc(padding,32)]);
  const bin=Buffer.concat(chunks),header=Buffer.alloc(20),binHeader=Buffer.alloc(8);
  header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(12+8+json.length+8+bin.length,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);
  binHeader.writeUInt32LE(bin.length,0);binHeader.writeUInt32LE(0x004e4942,4);
  const result=Buffer.concat([header,json,binHeader,bin]);await writeFile(path,result);
  return {bytes:result.length,triangles,drawCalls:primitives.length};
}
