import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../vendor/three.js';
import {paperPalette} from '../src/paintings/watercolor-placement.js';

test('paper watercolor keeps the hall color and four related shades dominant',()=>{
 const {halls}=JSON.parse(fs.readFileSync(new URL('../config/scene.json',import.meta.url)));
 const hue=color=>new THREE.Color(color).getHSL({},THREE.SRGBColorSpace).h;
 for(const {color} of [...halls,{color:'#d8b766'}]){
  const palette=paperPalette(THREE,color),center=hue(color);
  assert.equal(palette.length,7);
  assert.equal(palette[0],color);
  const distance=palette.map(tint=>Math.abs(hue(tint)-center)).map(d=>Math.min(d,1-d));
  assert(distance.slice(0,5).every(d=>d<.05));
  assert(distance.slice(5).every(d=>d>.09));
 }
});

test('original watercolor smoke uses the same hall-dominant palette as paper and keeps its fluid solver',async()=>{
 const {placementWatercolorOptions}=await import('../src/paintings/watercolor-placement.js');
 for(const color of ['#548791','#7b608e','#5c8066']){
  const smoke=placementWatercolorOptions(THREE,'smoke',color),paper=placementWatercolorOptions(THREE,'paper',color);
  assert.deepEqual(smoke.palette,paper.palette);assert.equal(smoke.palette[0],color);
  assert.equal(smoke.appearance,'smoke');assert.equal(smoke.pressureIterations,7);assert.equal(smoke.substeps,undefined);
 }
});
