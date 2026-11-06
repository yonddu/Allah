import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildArchitecture} from '../scripts/hall-geometry.mjs';
import {writeGlb} from '../scripts/write-glb.mjs';
test('All three outdoor courtyard maps compile to bounded valid GLB assets with baked shading',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'noor-assets-'));
  try{
    for(const map of ['mecca','taj','makkah'])for(const tier of ['low','high']){
      const model=buildArchitecture(map,tier),path=join(dir,map+'-'+tier+'.glb');
      for(const batch of model.batches){
        for(const name of ['position','normal','uv','color'])for(const value of batch.geometry.getAttribute(name).array)assert.ok(Number.isFinite(value),map+' invalid '+name);
      }
      const stats=await writeGlb(path,model,tier),bytes=await readFile(path);
      assert.equal(bytes.readUInt32LE(0),0x46546c67);assert.equal(bytes.readUInt32LE(4),2);assert.equal(bytes.readUInt32LE(8),bytes.length);
      const jsonLength=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+jsonLength).toString());
      assert.equal(json.asset.version,'2.0');assert.equal(json.meshes[0].primitives.length,stats.drawCalls);
      assert.ok(stats.drawCalls<=16);assert.ok(stats.triangles<=(tier==='low'?60000:200000));
      assert.ok(json.meshes[0].primitives.every(p=>p.attributes.COLOR_0!==undefined));
      for(const view of json.bufferViews)assert.equal(view.byteOffset%4,0);
      for(const primitive of json.meshes[0].primitives)assert.ok(json.accessors[primitive.attributes.POSITION].min.every(Number.isFinite));
      model.batches.forEach(p=>p.geometry.dispose());
    }
  }finally{await rm(dir,{recursive:true,force:true});}
});
