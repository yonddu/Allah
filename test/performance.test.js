import test from 'node:test';
import assert from 'node:assert/strict';
import {QUALITY_BUDGETS,chooseQuality,pixelRatioFor,nextResolutionScale} from '../public/performance.js';
test('The reference entry-level phone uses the low 30fps profile',()=>{
  assert.equal(chooseQuality('auto',{mobile:true,memory:3,cores:8}),'low');
  assert.equal(chooseQuality('auto',{mobile:true,memory:4,cores:8}),'low');
  assert.equal(chooseQuality('auto',{mobile:false,memory:4,cores:8}),'low');
  assert.equal(QUALITY_BUDGETS.low.fps,30);assert.equal(QUALITY_BUDGETS.low.shadows,false);
  assert.equal(chooseQuality('high',{mobile:true,memory:3}),'high');
});
test('High-DPI and large displays stay within their render-pixel budget',()=>{
  for(const budget of Object.values(QUALITY_BUDGETS))for(const [w,h,dpr]of [[390,844,3],[1920,1080,2],[2560,1440,2]]){
    const ratio=pixelRatioFor(w,h,dpr,budget);
    assert.ok(w*h*ratio*ratio<=budget.maxPixels+1);
    assert.ok(ratio<=dpr);assert.ok(ratio<=budget.dpr);
  }
  assert.equal(nextResolutionScale(1,30),1);assert.equal(nextResolutionScale(1,60),.85);assert.equal(nextResolutionScale(.85,100),.85);
});


test('Capable phones keep the balanced profile and automatic resolution retains readable edges',()=>{
 assert.equal(chooseQuality('auto',{mobile:true,memory:8,cores:8}),'balanced');
 let scale=1;for(let n=0;n<20;n++)scale=nextResolutionScale(scale,80);assert.equal(scale,.85);
 assert.equal(QUALITY_BUDGETS.balanced.fps,30);
});
