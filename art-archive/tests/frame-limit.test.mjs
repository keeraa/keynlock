import test from 'node:test';
import assert from 'node:assert/strict';
import {createFrameLimit} from '../src/app/frame-limit.js';

test('optional frame limit tracks 60 FPS across refresh rates and resumes cleanly after stalls',()=>{
 const gate=createFrameLimit();
 for(const refresh of [50,60,75,120,144]){
  for(const enabled of [false,true]){
   gate.setEnabled(enabled);
   let rendered=0;
   for(let tick=0;tick<refresh*10;tick++){
    const jitter=(tick%3-1)*.2;
    if(gate.shouldRender(tick*1000/refresh+jitter))rendered++;
   }
   const expected=(enabled?Math.min(refresh,60):refresh)*10;
   assert(Math.abs(rendered-expected)<=1,`${refresh} Hz with limit=${enabled}: ${rendered}`);
  }
 }
 gate.setEnabled(true);
 assert(gate.shouldRender(0));
 assert(gate.shouldRender(1000));
 assert(!gate.shouldRender(1008));
 gate.setEnabled(false);
 assert(gate.shouldRender(1008));
});
