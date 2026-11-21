import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.js';
import {createGrandBridge,grandBridgeArchCount} from '../js/path-builder/grand-bridge.js';
import {KEYNLOCK_FIXED_BRIDGES} from '../js/path-builder/keynlock-fixed-bridges.js';
import {bridgeProfiles,bridgeAt,landscapeCellAllowed,
  normalizeLandscape} from '../js/path-builder/landscape-model.js';

assert.equal(grandBridgeArchCount(100),3);
assert.equal(grandBridgeArchCount(300),9);
const empty=normalizeLandscape();
const bridges=bridgeProfiles(empty);
assert.equal(bridges.filter(item=>item.fixed).length,5,
  'Permanent bridges are present without creating or saving editable bridges');

for(const profile of KEYNLOCK_FIXED_BRIDGES){
  const model=createGrandBridge(THREE,profile);
  assert.match(model.group.name,/большой многопролётный мост/);
  assert.ok(model.group.children.length>=5);
  const arch=model.group.children.find(child=>child.name.includes('открытых каменных арок'));
  assert.ok(model.group.children.some(child=>child.name==='Цельная каменная плита под мостовой'),
    'Monumental bridge paving rests on a watertight masonry deck');
  assert.ok(arch?.geometry.type==='ExtrudeGeometry',
    'A single structural shell contains all masonry arch openings');
  assert.equal(bridgeAt(empty,profile.x,profile.z)?.id,profile.id,
    'Paths and collision should recognize the fixed bridge deck');
  assert.equal(landscapeCellAllowed(empty,profile.x,profile.z,bridges),true,
    'Walking routes may cross the water only on the fixed bridge');
  const count=grandBridgeArchCount(profile.span),bay=profile.span/count;
  const archCenter=-profile.span/2+bay/2;
  model.group.updateMatrixWorld(true);
  const origin=new THREE.Vector3(archCenter,-.1,-25).applyMatrix4(model.group.matrixWorld);
  const direction=new THREE.Vector3(0,0,1).applyQuaternion(model.group.quaternion);
  const ray=new THREE.Raycaster(origin,direction);
  assert.equal(ray.intersectObject(arch,false).length,0,
    'Each vault has a genuine opening for the water beneath');
  model.dispose();
  const sharedRoadMaterial=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});
  const paved=createGrandBridge(THREE,profile,null,sharedRoadMaterial);
  assert.ok(paved.group.children.some(child=>child.name==='Брусчатка дороги на мосту'),
    'Permanent bridge decks carry the city road across the whole river');
  paved.dispose();sharedRoadMaterial.dispose();
}
assert.equal(empty.bridges.length,0,'Immutable crossings must not be serialized as user bridges');
console.log('KEYNLOCK monumental bridges: five real multi-arch spans, open river and navigation OK');
