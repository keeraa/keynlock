import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.js';
import { createHouseModel, housePolygonCount } from '../js/buildings/house-model.js';
import { batchHouseGeometry } from '../js/buildings/house-batch.js';
import { houseTextureCacheStats } from '../js/buildings/house-textures.js';
import { houseMaterialCacheStats } from '../js/buildings/house-materials.js';

const configs=[
  {floors:1,roofType:'gable',plasterDamage:true},
  {floors:3,roofType:'hip',windowStyle:'arched',balcony:true,plasterDamage:true,damageAmount:60},
  {floors:4,width:12,depth:10,roofType:'flat',timberFrame:true},
];
const models=[];
let originals=0,optimized=0;
for(const config of configs) {
  const model=createHouseModel(THREE,config);
  const beforeBox=new THREE.Box3().setFromObject(model.group);
  const triangles=housePolygonCount(model.group);
  const stats=batchHouseGeometry(THREE,model.group);
  const afterBox=new THREE.Box3().setFromObject(model.group);
  assert(stats.before>stats.after*7,`Expected major mesh reduction: ${JSON.stringify(config)}`);
  // Stable facade pieces are a separate batch so the detail LOD can fade.
  assert(stats.after<=17,'Batch material count must stay bounded');
  const invariantMeshes=model.group.children.filter(mesh=>mesh.userData.houseInvariant);
  assert(invariantMeshes.length>=4,'Invariant building shell must survive batching');
  assert.equal(housePolygonCount(model.group),triangles,'Merging must preserve triangle count');
  assert(beforeBox.min.distanceTo(afterBox.min)<.01,'Batch changes house minimum bounds');
  assert(beforeBox.max.distanceTo(afterBox.max)<.01,'Batch changes house maximum bounds');
  originals+=stats.before;optimized+=stats.after;
  models.push(model);
}
assert.equal(houseTextureCacheStats(THREE).houses,3);
assert.equal(houseMaterialCacheStats(THREE).houses,3);
assert.equal(houseMaterialCacheStats(THREE).materials,9);
models[0].dispose();
assert.equal(houseTextureCacheStats(THREE).houses,2);
assert.equal(houseMaterialCacheStats(THREE).houses,2);
models.slice(1).forEach(model=>model.dispose());
assert.equal(houseTextureCacheStats(THREE).houses,0);
assert.equal(houseMaterialCacheStats(THREE).houses,0);
console.log(`House batching: ${originals} → ${optimized} mesh draws; polygons, bounds and shared caches OK`);
