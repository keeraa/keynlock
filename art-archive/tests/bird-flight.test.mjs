import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.js';
import {createBirdFlight} from '../src/environment/bird-flight.js';

test('flight changes altitude and turns both ways while staying above the glass dome',()=>{
  let seed=7;
  const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  for(let index=0;index<6;index++){
    const flight=createBirdFlight(THREE,index,25,random);
    let min=Infinity,max=-Infinity,left=false,right=false,radius=0,previous=flight.update(0,false);
    for(let i=0;i<7200;i++){
      const state=flight.update(1/60,i%300<120);
      min=Math.min(min,state.position.y);max=Math.max(max,state.position.y);
      left ||=state.bank>.1;right ||=state.bank<-.1;
      radius=Math.max(radius,Math.hypot(state.position.x,state.position.z));
      assert(Math.abs(state.heading-previous.heading)<=.7/60+1e-8);
      assert(state.position.y>26);
      previous={...state};
    }
    assert(max-min>3);
    assert(left && right);
    assert(radius<33);
  }
});
