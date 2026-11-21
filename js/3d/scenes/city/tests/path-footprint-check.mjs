import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.js';
import {MODEL_TYPES,referenceFootprint} from '../js/path-builder/model-types.js';
import {createHouseModel} from '../modules/house-builder/index.js';
import {createLandmarkModel} from '../js/landmarks/landmark-model.js';
import {batchHouseGeometry} from '../modules/house-builder/core/house-batch.js';

// Rebuild the exact low-detail models used by the current 3D construction
// scene, and detect any geometry/entrance drift from the fallback catalog.
for(const [type,definition] of Object.entries(MODEL_TYPES)){
  const model=definition.kind==='landmark'
    ?createLandmarkModel(THREE,type,{detail:'low'})
    :createHouseModel(THREE,definition.config,{detail:'low'});
  batchHouseGeometry(THREE,model.group);
  const group=model.group;
  group.scale.setScalar(definition.scale);group.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(group);
  const expected=referenceFootprint(type);
  const actualWidth=2*Math.max(Math.abs(box.min.x),Math.abs(box.max.x));
  const actualDepth=2*Math.max(Math.abs(box.min.z),Math.abs(box.max.z));
  const path=group.userData.pathAccess;
  const entrance=path?{x:path.x*definition.scale,z:path.z*definition.scale}:
    {x:0,z:(definition.config.depth/2+1.27)*definition.scale};
  assert.ok(Math.abs(actualWidth-expected.width)<.002,`${type}: 2D width matches approved 3D geometry`);
  assert.ok(Math.abs(actualDepth-expected.depth)<.002,`${type}: 2D depth matches approved 3D geometry`);
  assert.ok(Math.abs(entrance.x-expected.pathAccess.x)<.002,`${type}: entrance X matches 3D`);
  assert.ok(Math.abs(entrance.z-expected.pathAccess.z)<.002,`${type}: entrance Z matches 3D`);
  assert.equal(expected.kind,definition.kind);
  model.dispose();
}
assert.equal(Object.keys(MODEL_TYPES).length,10);
for(const config of [
  {width:6,depth:5,floors:2,balcony:true,plasterDamage:true},
  {width:12,depth:10,floors:4,roofType:'hip',shutters:false},
  {width:8,depth:8,floors:1,roofType:'flat',balcony:false},
]){
  const custom=createHouseModel(THREE,config,{detail:'low'});
  const group=custom.group;
  group.scale.setScalar(MODEL_TYPES['custom-house'].scale);
  group.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(group),footprint=referenceFootprint('custom-house',config);
  const actualWidth=2*Math.max(-box.min.x,box.max.x);
  const actualDepth=2*Math.max(-box.min.z,box.max.z);
  assert.ok(actualWidth<=footprint.width+.002&&footprint.width-actualWidth<.36,
    'Generated house footprint safely contains its 3D width');
  assert.ok(actualDepth<=footprint.depth+.002&&footprint.depth-actualDepth<.36,
    'Generated house footprint safely contains its 3D depth');
  custom.dispose();
}
assert.throws(()=>referenceFootprint('unknown'),/Неизвестное/);
console.log('KEYNLOCK path-builder: 10 geometry-measured 2D/3D footprints and configurable house shapes match');
