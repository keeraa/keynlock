import assert from 'node:assert/strict';
import * as BaseTHREE from '../vendor/three.js';
import { createHouseModel } from '../js/buildings/house-model.js';
import { houseTextureCacheStats } from '../js/buildings/house-textures.js';

let canvases=0,loads=0;
const fakeCanvasContext={
  fillRect(){},strokeRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},
  quadraticCurveTo(){},bezierCurveTo(){},fill(){},
};
const THREE={
  ...BaseTHREE,
  TextureLoader:class {
    load(url,onLoad){
      assert(url.endsWith('.webp'));
      loads++;
      const texture=new BaseTHREE.Texture();
      queueMicrotask(()=>onLoad(texture));
      return texture;
    }
  },
};
globalThis.document={createElement(tag){
  assert.equal(tag,'canvas');canvases++;
  return {width:0,height:0,getContext(){return fakeCanvasContext;}};
}};
try {
  const houses=Array.from({length:10},(_,i)=>createHouseModel(THREE,{floors:1,plasterColor:i%2?'#eeeeee':'#d2b68f'}));
  assert.equal(canvases,3,'Only three fallback paint maps should be generated');
  assert.equal(loads,3,'Each image is requested once for all houses');
  assert.deepEqual(houseTextureCacheStats(THREE),{houses:10,textures:6,imageLoads:3});
  await Promise.resolve();
  houses.forEach(house=>house.dispose());
  assert.equal(houseTextureCacheStats(THREE).houses,0);
  createHouseModel(THREE,{floors:1}).dispose();
  assert.equal(canvases,6,'Cache may be freshly created after final release');
  assert.equal(loads,6);
} finally {delete globalThis.document;}
console.log('House textures: 10 houses share 3 painted maps and 3 fetched maps, refs released OK');
