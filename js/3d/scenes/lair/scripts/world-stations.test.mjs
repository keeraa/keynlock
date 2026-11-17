import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createWorldStationRegistry, WORKSHOP_PLACEMENTS} from '../src/world-stations.js';

test('three unchanged source scenes occupy one physically connected world',()=>{
  const world=new THREE.Scene();
  const registry=createWorldStationRegistry(world);
  const sources={};
  for (const id of ['restoration','alchemy','workbench']) {
    const original=new THREE.Scene(),camera=new THREE.PerspectiveCamera(40,1,.1,100);
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial());
    original.add(mesh);
    camera.position.set(0,2,7);
    registry.register(id,{scene:original,camera});
    camera.lookAt(new THREE.Vector3(0,1,0));
    sources[id]={original,camera,mesh};
  }
  registry.update();
  assert.equal(world.children.length,3);
  assert.equal(registry.entries.size,3);
  assert.equal(registry.roots.get('restoration').visible,true,
    'the original Atelier is visible inside the main Lair renderer');
  assert.equal(registry.roots.get('alchemy').visible,false);
  assert.equal(registry.roots.get('workbench').visible,false);
  assert.equal(new Set(Object.values(sources).map(({original})=>original)).size,3);
  for(const [id,{original,camera,mesh}] of Object.entries(sources)){
    assert.equal(original.parent.parent.parent,world);
    assert.equal(mesh.parent,original,'the original mesh object itself is retained');
    const pose=registry.pose(id);
    const worldMesh=mesh.getWorldPosition(new THREE.Vector3());
    const expected=new THREE.Vector3(...WORKSHOP_PLACEMENTS[id].position);
    assert.ok(worldMesh.distanceTo(expected)<.0001);
    const toward=worldMesh.clone().add(new THREE.Vector3(0,1,0).multiplyScalar(WORKSHOP_PLACEMENTS[id].scale||1))
      .sub(pose.position).normalize();
    const actual=camera.getWorldDirection(new THREE.Vector3());
    assert.ok(actual.dot(toward)>.999,'original local lookAt works in translated/rotated room');
  }
  assert.ok(sources.restoration.camera.getWorldPosition(new THREE.Vector3()).x>0,
    'Atelier editing camera faces the left Lair wall from INSIDE the building');
  assert.ok(sources.restoration.camera.getWorldPosition(new THREE.Vector3()).x<8.55);
  const galleryWall=new THREE.Mesh(new THREE.BoxGeometry(32,14.21,.2),new THREE.MeshStandardMaterial());
  galleryWall.position.set(0,5.555,-4.7);
  sources.restoration.original.add(galleryWall);
  world.updateMatrixWorld(true);
  const wallBounds=new THREE.Box3().setFromObject(galleryWall);
  assert.ok(wallBounds.min.x < -8.39 && wallBounds.max.x > -8.41,
    'the exact original gallery wall overlays the left Lair plaster');
  assert.ok(wallBounds.min.z > -5.8 && wallBounds.max.z < 26.5,
    'the whole original 32m gallery fits the original Lair room without doors');
  assert.ok(sources.alchemy.camera.getWorldPosition(new THREE.Vector3()).x>8.55);
  assert.ok(sources.workbench.camera.getWorldPosition(new THREE.Vector3()).x>8.55);
});

test('alchemy backdrop and both workbench tools persist under one parent',()=>{
  const registry=createWorldStationRegistry(new THREE.Scene());
  const alchemy=new THREE.Scene(),background=new THREE.Scene(),camera=new THREE.PerspectiveCamera();
  registry.register('alchemy',{scene:alchemy,additionalScenes:[background],camera});
  assert.equal(alchemy.parent,background.parent,'the original two-stage room has one world transform');
  const bench=new THREE.Scene(),benchCamera=new THREE.PerspectiveCamera();
  registry.register('workbench',{scene:bench,camera:benchCamera});
  registry.selectSlot('workbench','mechanism');
  const mechanism=new THREE.Scene();
  const mechanismCamera=new THREE.PerspectiveCamera();
  registry.register('workbench',{scene:mechanism,camera:mechanismCamera,slot:'mechanism'});
  assert.equal(bench.parent.visible,false);
  assert.equal(mechanism.parent.visible,true);
  registry.selectSlot('workbench','main');
  assert.equal(bench.parent.visible,true);
  assert.equal(mechanism.parent.visible,false);
  const light=new THREE.DirectionalLight();
  bench.add(light);
  registry.update();
  assert.equal(light.target.parent,bench.parent,'directional light is aimed inside the same room');
  assert.equal(light.visible,false,'inactive workshop illumination does not wash out the Lair');
  registry.setLighting('workbench');
  assert.equal(light.visible,true,'entering the workshop restores its original lighting');
  registry.setLighting(null);
  assert.equal(light.visible,false,'returning to the Lair restores corridor lighting');
});
