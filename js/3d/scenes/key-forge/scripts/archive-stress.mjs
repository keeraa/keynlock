import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { defaultDesign, createInstancedKeyCollection, moveKeyInstance,
  setKeyInstanceRust, removeKeyInstance, disposeInstancedKeyCollection } from '../dist/js/key-model.js';

// A deterministic synthetic archive. Geometry variations stay at four families
// per template; every physical key has its own rust paint and transform.
const entries=Array.from({length:1000},(_,i)=>{
  const variant=Math.floor(i/10)%4;
  return {
    id:'archive-'+i,
    design:{...defaultDesign(i%10),rustAmount:(i*97)%201,
      dirtAmount:variant%2?100:0,broken:variant>=2,breakAngle:variant===2?60:80},
    placement:{mode:i%5?'floor':'hang',position:[(i%40)*5,1.1,Math.floor(i/40)*5],
      yaw:i*1.618,tilt:(i%7)*.04},
  };
});

const begin=performance.now();
const hall=createInstancedKeyCollection(entries,{castShadow:false});
const buildMs=performance.now()-begin;
assert.equal(hall.userData.keyCount,1000);
assert.equal(hall.userData.uniqueDesigns,40);
assert.ok(hall.userData.drawCalls<=60,`${hall.userData.drawCalls} draw calls`);
const initial={...hall.userData};

const updateStart=performance.now();
for(let i=0;i<100;i++) {
  const id='archive-'+(i*9);
  moveKeyInstance(hall,id,[i*4,.2,i*2]);
  setKeyInstanceRust(hall,id,i*2);
}
for(let i=0;i<50;i++)assert.ok(removeKeyInstance(hall,'archive-'+(i*19)));
const updateMs=performance.now()-updateStart;
assert.equal(hall.userData.keyCount,950);
assert.ok(hall.userData.drawCalls<=60);

console.log(JSON.stringify({keys:initial.keyCount,drawCalls:initial.drawCalls,
  shadowCasterBatches:initial.shadowCasterBatches,
  geometryFamilies:initial.uniqueDesigns,renderedTriangles:initial.renderedTriangles,
  uniqueTriangles:initial.uniqueTriangles,buildMs:Math.round(buildMs),
  movePaintRemoveMs:Math.round(updateMs),keysAfterUpdates:hall.userData.keyCount,
  drawCallsAfterUpdates:hall.userData.drawCalls},null,2));
disposeInstancedKeyCollection(hall);
