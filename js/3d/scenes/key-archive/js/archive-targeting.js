import * as THREE from '../vendor/three.js';
import { findFloorKeyAtReticle } from './key-picking.js?v=5';
import { KEY_REACH, CABINET_REACH, STATION_REACH } from './interaction-range.js';
import { cabinetSlotAtLocalPoint } from './cabinet-layout.js?v=23';

// Both graphical backends expose the same world-space interaction meshes.
// Keeping this query shared prevents Canvas and WebGL from disagreeing about
// which part of a key, cabinet or bath the player is aiming at.
export function createArchiveTargeting({ camera, world, state, keyIndex }) {
  const raycaster = new THREE.Raycaster();
  const center = new THREE.Vector2(0, 0);
  const forward = new THREE.Vector3();
  const targetCenter = new THREE.Vector3();
  const direction = new THREE.Vector3();

  function targetInView() {
    camera.updateMatrixWorld();
    raycaster.setFromCamera(center, camera);
    for (const hit of raycaster.intersectObjects(world.interactables, false)) {
      const data = hit.object.userData;
      if (!data?.kind) continue;
      const isKey = data.kind === 'key' || data.kind === 'key-batch';
      const distance = isKey
        ? Math.hypot(hit.point.x - camera.position.x, hit.point.z - camera.position.z)
        : hit.distance;
      if (distance > (data.kind === 'cabinet' ? CABINET_REACH :
        data.kind === 'bath' || data.kind === 'forge' ? STATION_REACH : KEY_REACH)) continue;
      if (data.kind === 'key-batch') {
        const id = world.keyIdFromHit(data.type, hit.instanceId);
        if (!id || world.isThrowing(id) || keyIndex.get(id)?.status !== 'floor') continue;
        return { kind: 'key', id };
      }
      if (data.kind === 'key' && (world.isThrowing(data.id) || keyIndex.get(data.id)?.status !== 'floor')) continue;
      if (data.kind === 'cabinet') {
        const cabinet = world.cabinets[data.type];
        const local = cabinet.group.worldToLocal(hit.point.clone());
        return { kind: 'cabinet', type: data.type,
          slot: cabinetSlotAtLocalPoint(local.x, local.y) };
      }
      return data;
    }

    forward.set(0, 0, -1).applyQuaternion(camera.quaternion);
    const floorKey = findFloorKeyAtReticle(camera.position, forward, state.keys,
      world.isThrowing, { index: keyIndex });
    if (floorKey) return { kind: 'key', id: floorKey.id };

    let closest = null;
    let bestDistance = CABINET_REACH;
    for (const cabinet of world.cabinets) {
      cabinet.collider.getWorldPosition(targetCenter);
      direction.copy(targetCenter).sub(camera.position);
      const distance = direction.length();
      if (distance >= bestDistance || forward.dot(direction.normalize()) <= .81) continue;
      bestDistance = distance;
      closest = { kind: 'cabinet', type: cabinet.type };
    }
    return closest;
  }
  return { targetInView };
}
