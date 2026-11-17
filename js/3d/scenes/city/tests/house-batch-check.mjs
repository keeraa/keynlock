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
  let originalShadowTriangles=0,originalReceiverTriangles=0;
  model.group.traverse(mesh=>{
    if(!mesh.isMesh)return;
    const count=(mesh.geometry.index?.count??mesh.geometry.getAttribute('position').count)/3;
    if(mesh.castShadow)originalShadowTriangles+=count;
    if(mesh.receiveShadow)originalReceiverTriangles+=count;
  });
  const stats=batchHouseGeometry(THREE,model.group);
  const afterBox=new THREE.Box3().setFromObject(model.group);
  assert(stats.before>stats.after*6,`Expected major mesh reduction: ${JSON.stringify(config)}`);
  // Stable facade pieces are a separate batch so the detail LOD can fade.
  assert(stats.after<=30,'Batches must remain bounded while respecting individual shadow settings');
  let batchedShadowTriangles=0,batchedReceiverTriangles=0;
  model.group.traverse(mesh=>{
    if(!mesh.isMesh)return;
    const count=(mesh.geometry.index?.count??mesh.geometry.getAttribute('position').count)/3;
    if(mesh.castShadow)batchedShadowTriangles+=count;
    if(mesh.receiveShadow)batchedReceiverTriangles+=count;
  });
  assert.equal(batchedShadowTriangles,originalShadowTriangles,
    'Batches must not turn non-shadowing glass, plates and details into casters');
  assert.equal(batchedReceiverTriangles,originalReceiverTriangles,
    'Batches must retain the original shadow receivers');
  const invariantMeshes=model.group.children.filter(mesh=>mesh.userData.houseInvariant);
  assert(invariantMeshes.length>=4,'Invariant building shell must survive batching');
  assert.equal(housePolygonCount(model.group),triangles,'Merging must preserve triangle count');
  assert(beforeBox.min.distanceTo(afterBox.min)<.01,'Batch changes house minimum bounds');
  assert(beforeBox.max.distanceTo(afterBox.max)<.01,'Batch changes house maximum bounds');
  originals+=stats.before;optimized+=stats.after;
  models.push(model);
}
// The editor batches a finished house, retints the existing materials and
// replaces those merged meshes only when a structural control changes.
const editable=createHouseModel(THREE,{floors:4,windowStyle:'arched',shutters:true});
const firstBatch=batchHouseGeometry(THREE,editable.group);
const stableMeshes=editable.group.children.slice();
editable.update({floors:4,windowStyle:'arched',shutters:true,woodColor:'#5d444b'});
assert.deepEqual(editable.group.children,stableMeshes,
  'Changing a colour must preserve already-batched window geometry');
editable.update({floors:4,windowStyle:'straight',shutters:true,woodColor:'#5d444b'});
assert.ok(editable.group.children.length>firstBatch.after,
  'Structural edits should reconstruct the full unbatched model');
const nextBatch=batchHouseGeometry(THREE,editable.group);
assert.ok(nextBatch.after<=30,'Edited houses can be batched again after a shape change');
editable.dispose();
assert.equal(houseTextureCacheStats(THREE).houses,3);
assert.equal(houseMaterialCacheStats(THREE).houses,3);
assert.equal(houseMaterialCacheStats(THREE).materials,11);
models[0].dispose();
assert.equal(houseTextureCacheStats(THREE).houses,2);
assert.equal(houseMaterialCacheStats(THREE).houses,2);
models.slice(1).forEach(model=>model.dispose());
assert.equal(houseTextureCacheStats(THREE).houses,0);
assert.equal(houseMaterialCacheStats(THREE).houses,0);
console.log(`House batching: ${originals} → ${optimized} mesh draws; polygons, bounds and shared caches OK`);
