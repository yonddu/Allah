import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';import {modestyAsset,coveredMaterial} from '../public/modesty.js';
test('The prayer undergarment is opaque, closed at every seam and covers pelvis, waist and both legs',()=>{
 const source=new THREE.Mesh(new THREE.BoxGeometry(.4,1.8,.25).translate(0,.9,0),new THREE.MeshStandardMaterial()),asset=modestyAsset(source,'model01');
 assert.equal(asset.material.transparent,false);assert.equal(asset.material.opacity,1);assert.equal(asset.material.side,THREE.DoubleSide);
 const p=asset.geometry.attributes.position,ix=asset.geometry.index,edges=new Map(),key=i=>[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*1e6)).join(',');
 for(let n=0;n<ix.count;n+=3){const triangle=[ix.getX(n),ix.getX(n+1),ix.getX(n+2)].map(key);if(new Set(triangle).size<3)continue;for(let k=0;k<3;k++){const a=triangle[k],b=triangle[(k+1)%3],e=[a,b].sort().join('|');edges.set(e,(edges.get(e)||0)+1);}}
 for(const count of edges.values())assert.equal(count,2,'No open fabric boundary is allowed');
 assert.deepEqual(new Set(asset.solids.map(s=>s.bone)),new Set([1,2,12,13,15,16]));
 const weights=asset.geometry.attributes.skinWeight,indices=asset.geometry.attributes.skinIndex;for(let i=0;i<p.count;i++){assert.equal(weights.getX(i),1);assert.ok(indices.getX(i)<22);}
 const active={value:1},material=coveredMaterial(source.material,active,asset.color),shader={uniforms:{},vertexShader:'#include <common>\n#include <begin_vertex>',fragmentShader:'#include <common>\n#include <map_fragment>'};material.onBeforeCompile(shader);assert.equal(shader.uniforms.noorCovered,active);assert.ok(shader.fragmentShader.includes('diffuseColor.rgb=noorCloth'));
});
