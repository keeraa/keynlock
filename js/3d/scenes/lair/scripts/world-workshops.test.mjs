import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ALCHEMY_TABLE } from '@keynlock/alchemy/room-assets';
import {createWorldWorkshopRegistry, WORKSHOP_PLACEMENTS} from '../src/rendering/world-workshops.js';

test('three unchanged source scenes occupy one physically connected world',()=>{
  const world=new THREE.Scene();
  const registry=createWorldWorkshopRegistry(world);
  const sources={};
  for (const id of ['atelier','alchemy','workbench']) {
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
  assert.equal(registry.roots.get('atelier').visible,true,
    'the original Atelier is visible inside the main Lair renderer');
  assert.equal(registry.roots.get('alchemy').visible,true,
    'the original laboratory must remain visible from the common Lair camera');
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
  assert.ok(sources.atelier.camera.getWorldPosition(new THREE.Vector3()).x>0,
    'Atelier editing camera faces the left Lair wall from INSIDE the building');
  assert.ok(sources.atelier.camera.getWorldPosition(new THREE.Vector3()).x<8.55);
  assert.ok(sources.alchemy.camera.getWorldPosition(new THREE.Vector3()).x<8.39,
    'the source alchemy camera must be inside the Lair, facing the right tiled wall');
  const sourceAlchemyWallX=WORKSHOP_PLACEMENTS.alchemy.position[0]
    - (-5.25)*WORKSHOP_PLACEMENTS.alchemy.scale;
  assert.ok(sourceAlchemyWallX>8.25 && sourceAlchemyWallX<8.39,
    'original tiled backdrop aligns with the Lair right wall');
  assert.ok(sources.workbench.camera.getWorldPosition(new THREE.Vector3()).x>8.55);
});

test('alchemy backdrop and both workbench tools persist under one parent',()=>{
  const registry=createWorldWorkshopRegistry(new THREE.Scene());
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

test('alchemy furniture feet rest on the Lair floor and the camera uses the original orbit pivot',()=>{
  const registry=createWorldWorkshopRegistry(new THREE.Scene());
  const original=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(37,1.6,.1,100);
  registry.register('alchemy',{scene:original,camera});
  const localTarget=new THREE.Vector3(0,1.7,-.45);
  camera.position.set(0,5.2,13.6);
  camera.lookAt(localTarget);
  camera.userData.keynlockLocalTarget=localTarget;
  const root=registry.roots.get('alchemy');
  const bottom=root.localToWorld(new THREE.Vector3(0,ALCHEMY_TABLE.lairFootY,0));
  const tabletop=root.localToWorld(new THREE.Vector3(0,ALCHEMY_TABLE.topY,0));
  assert.ok(Math.abs(bottom.y-.0385)<1e-6,
    'the shortened table feet touch the common Lair timber floor');
  assert.ok(Math.abs(tabletop.y-bottom.y-.95)<1e-6,
    'the embedded tabletop is .95 m above the floor');
  const pose=registry.pose('alchemy');
  const expectedPosition=root.localToWorld(new THREE.Vector3(0,5.2,13.6));
  const expectedTarget=root.localToWorld(localTarget.clone());
  assert.ok(pose.position.distanceTo(expectedPosition)<1e-6);
  assert.ok(pose.target.distanceTo(expectedTarget)<1e-6,
    'the visible camera must orbit the source alchemy pivot, not a synthetic 9m point');
  assert.equal(pose.fov,37,'preserve original laboratory field of view');
});

test('embedded lab suppresses its second background rig and scales point lights only during drawing',()=>{
  const registry=createWorldWorkshopRegistry(new THREE.Scene());
  const foreground=new THREE.Scene(),background=new THREE.Scene();
  const bulb=new THREE.PointLight(0xffffff,10,4,2);
  const backdrop=new THREE.HemisphereLight(0xffffff,0x222222,2.5);
  foreground.add(bulb);
  background.add(backdrop);
  registry.register('alchemy',{scene:foreground,additionalScenes:[background],
    camera:new THREE.PerspectiveCamera()});
  registry.update();
  registry.setLighting('alchemy');
  assert.equal(bulb.visible,true);
  assert.equal(backdrop.visible,false,
    'background-only source lights must not illuminate the combined Lair twice');
  registry.prepareLightsForRender();
  assert.ok(Math.abs(bulb.intensity-10*.28**2)<1e-8);
  assert.ok(Math.abs(bulb.distance-4*.28)<1e-8);
  registry.restoreLightsAfterRender();
  assert.equal(bulb.intensity,10,'restore the source simulation intensity after drawing');
  assert.equal(bulb.distance,4);
  bulb.intensity=12;
  registry.prepareLightsForRender();
  assert.ok(Math.abs(bulb.intensity-12*.28**2)<1e-8,
    'new source candle intensity is scaled for each rendered frame');
  registry.restoreLightsAfterRender();
  assert.equal(bulb.intensity,12);
  registry.setLighting(null);
  assert.equal(bulb.visible,false);
});

