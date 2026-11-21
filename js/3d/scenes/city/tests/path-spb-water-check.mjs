import assert from 'node:assert/strict';
import {LANDSCAPE_BOUNDS,normalizeLandscape,createLandscapeSampler,
  landscapeCellAllowed,landscapePlacementCheck,treePlacementCheck,starterTrees} from '../js/path-builder/landscape-model.js';
import {GROUND_MAP} from '../js/path-builder/ground-art.js';
import {PAVING_MAP} from '../js/path-builder/paving-art.js';
import {SPB_MAP_BOUNDS,spbWaterAtPixel,spbWaterAt,
  spbWaterNear} from '../js/path-builder/spb-water-layout.js';

assert.deepEqual(LANDSCAPE_BOUNDS,SPB_MAP_BOUNDS);
assert.deepEqual(LANDSCAPE_BOUNDS,{width:2640,depth:1800});
assert.equal(4224/LANDSCAPE_BOUNDS.width,1.6,
  'The map width is reduced by exactly 1.6 without cropping islands');
assert.equal(2880/LANDSCAPE_BOUNDS.depth,1.6,
  'The map depth is reduced by exactly 1.6 without cropping canals');
assert.equal(GROUND_MAP.width*GROUND_MAP.pixelsPerMetre,2112,
  'Resizing the physical world must not change the ground atlas VRAM');
assert.equal(GROUND_MAP.depth*GROUND_MAP.pixelsPerMetre,1440);
assert.equal(PAVING_MAP.width*PAVING_MAP.pixelsPerMetre,2640,
  'Street texture atlas keeps its existing GPU resolution');
assert.equal(PAVING_MAP.depth*PAVING_MAP.pixelsPerMetre,1800);

// Verified map landmarks in the user-supplied 1788×1284 Petersburg plan:
// the main Neva body, smaller southern canals, and intervening dry islands.
const wet=[[450,500],[850,580],[1000,400],[1200,260],
  [200,1000],[818,1000],[1375,800],[1315,700]];
const dry=[[894,642],[890,650],[1400,950],[1000,790],
  [800,260],[1500,1000],[700,940],[900,830]];
const world=([x,y])=>[(x/1788-.5)*LANDSCAPE_BOUNDS.width,
  (y/1284-.5)*LANDSCAPE_BOUNDS.depth];
for(const p of wet){
  assert.ok(spbWaterAtPixel(...p),`Mapped water pixel ${p}`);
  assert.ok(spbWaterAt(...world(p)),`Mapped water world location ${p}`);
}
for(const p of dry){
  assert.equal(spbWaterAtPixel(...p),false,`Dry island pixel ${p}`);
  assert.equal(spbWaterAt(...world(p)),false,`Dry island world location ${p}`);
}
assert.equal(spbWaterAtPixel(-1,450),false);
assert.equal(spbWaterAtPixel(1788,450),false);

const empty=normalizeLandscape();
const sampler=createLandscapeSampler(empty);
const [channelX,channelZ]=world([450,500]);
assert.ok(sampler.heightAt(channelX,channelZ)<-.1,
  'Permanent Neva channels retain shallow terrain relief without hard bank cliffs');
assert.equal(landscapeCellAllowed(empty,channelX,channelZ),false,
  'Nav paths cannot cross the reference Neva without a bridge');
assert.equal(landscapePlacementCheck(empty,{x:channelX,z:channelZ,width:8,depth:8}).valid,false,
  'Houses cannot stand in permanent channels');
assert.equal(treePlacementCheck(empty,{x:channelX,z:channelZ}).valid,false,
  'Tree tool also obeys the permanent shoreline');

const [islandX,islandZ]=world([1500,1000]);
assert.ok(Math.abs(sampler.heightAt(islandX,islandZ))<.01);
assert.equal(spbWaterNear(islandX,islandZ,3),false);
assert.equal(landscapeCellAllowed(empty,islandX,islandZ),true);
assert.ok(starterTrees().every(t=>!spbWaterNear(t.x,t.z,0)),
  'All 28 initial trees remain on land after the smaller map migration');

console.log('KEYNLOCK map: approved river reference, canal islands, collision mask and VRAM budget OK');
