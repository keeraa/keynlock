import * as THREE from '../vendor/three.js';
import { KEY_TYPES } from './rules.js';
import {
  createCombinedKeyGeometry, getKeyCrustGeometry, getKeyCrustMaterial, getKeyRustStrength, getKeyDisplayScale,
} from './key-factory.js';
import { createPaintedInstanceGeometry, setKeyInstanceFinish } from './key-instance-finish.js';
import { restingKeyY } from './floor-contact.js';

// Keys lying on the floor. Each family is a few instanced batches (whole
// keys, broken keys, mud crusts, wax crusts), so 1000 keys stay a handful of
// draw calls. A key that leaves the floor keeps its instance, scaled to zero.
//   materialFor(type)     the family's metal material
//   isHidden(id)          true while the key is drawn elsewhere (in flight)
//   onSync(key, visible)  after a key's instance is updated
export function createFloorKeys(scene, keys, { materialFor, isHidden = () => false, onSync = () => {} }) {
  const floorKeys = new Map(); // key ID -> its family batch and instance index
  const keysByType = KEY_TYPES.map(() => []);
  for (const key of keys) keysByType[key.type].push(key);
  const floorBatches = KEY_TYPES.map((_, type) => {
    const material = materialFor(type);
    // A small depth bias keeps thin metal faces stable against the painted
    // floor during the transition from a flying model to its pooled instance.
    material.polygonOffset = true;
    material.polygonOffsetFactor = -1;
    material.polygonOffsetUnits = -1;
    const healthyKeys = keysByType[type].filter(key => !key.broken);
    const damagedKeys = keysByType[type].filter(key => key.broken);
    const muddyKeys = healthyKeys.filter(key => key.mud);
    const waxedKeys = healthyKeys.filter(key => key.wax);
    const healthy = new THREE.InstancedMesh(
      createPaintedInstanceGeometry(createCombinedKeyGeometry(type), healthyKeys.length),
      material, healthyKeys.length);
    const damaged = new THREE.InstancedMesh(
      createPaintedInstanceGeometry(createCombinedKeyGeometry(type, true), damagedKeys.length),
      material, damagedKeys.length);
    const mudGeometry = getKeyCrustGeometry(type, false, 'mud');
    const mudMaterial = getKeyCrustMaterial('mud');
    const mudCrust = mudGeometry && mudMaterial ?
      new THREE.InstancedMesh(mudGeometry, mudMaterial, muddyKeys.length) : null;
    const waxGeometry = getKeyCrustGeometry(type, false, 'wax');
    const waxCrust = waxGeometry && waxedKeys.length
      ? new THREE.InstancedMesh(waxGeometry, getKeyCrustMaterial('wax'), waxedKeys.length) : null;
    for (const instance of [healthy, damaged, mudCrust, waxCrust].filter(Boolean)) {
      instance.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      instance.frustumCulled = false;
    }
    scene.add(...[healthy, damaged, mudCrust, waxCrust].filter(Boolean));
    keysByType[type].forEach(key => {
      const list = key.broken ? damagedKeys : healthyKeys;
      const visibleIndex = list.indexOf(key);
      floorKeys.set(key.id, { type, broken: key.broken, visibleIndex,
        mudIndex: muddyKeys.indexOf(key), waxIndex: waxedKeys.indexOf(key) });
      const mesh = key.broken ? damaged : healthy;
      mesh.setColorAt(visibleIndex, new THREE.Color().setScalar([.94, 1, .83][key.variation % 3]));
      setKeyInstanceFinish(mesh, visibleIndex, key, getKeyRustStrength(type));
    });
    if (healthy.instanceColor) healthy.instanceColor.needsUpdate = true;
    if (damaged.instanceColor) damaged.instanceColor.needsUpdate = true;
    return { healthy, damaged, mudCrust, waxCrust };
  });
  const dummy = new THREE.Object3D();

  function syncKey(key) {
    const instance = floorKeys.get(key.id);
    if (!instance) return;
    const batch = floorBatches[instance.type];
    const mesh = instance.broken ? batch.damaged : batch.healthy;
    const visible = key.status === 'floor' && !isHidden(key.id);
    onSync(key, visible);
    const restingY = restingKeyY(key.x, key.z) + (key.layer || 0);
    dummy.position.set(key.x, restingY, key.z);
    dummy.rotation.set(-Math.PI / 2, key.rotation, 0, 'YXZ');
    dummy.scale.setScalar(visible ? getKeyDisplayScale('floor', key.type) : .000001);
    dummy.updateMatrix();
    mesh.setMatrixAt(instance.visibleIndex, dummy.matrix);
    mesh.instanceMatrix.needsUpdate = true;
    setKeyInstanceFinish(mesh, instance.visibleIndex, key, getKeyRustStrength(key.type));
    const floorScale = getKeyDisplayScale('floor', key.type);
    if (batch.mudCrust && instance.mudIndex >= 0) {
      dummy.position.set(key.x, restingY, key.z);
      dummy.rotation.set(-Math.PI / 2, key.rotation, 0, 'YXZ');
      dummy.scale.setScalar(visible && key.mud && !key.wax ? floorScale : .000001);
      dummy.updateMatrix();
      batch.mudCrust.setMatrixAt(instance.mudIndex, dummy.matrix);
      batch.mudCrust.instanceMatrix.needsUpdate = true;
    }
    if (batch.waxCrust && instance.waxIndex >= 0) {
      dummy.scale.setScalar(visible && key.wax ? floorScale : .000001);
      dummy.updateMatrix();
      batch.waxCrust.setMatrixAt(instance.waxIndex, dummy.matrix);
      batch.waxCrust.instanceMatrix.needsUpdate = true;
    }
  }

  return { floorKeys, syncKey };
}
