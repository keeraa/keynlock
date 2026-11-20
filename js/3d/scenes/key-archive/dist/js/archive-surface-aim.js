import * as THREE from '../vendor/three.js';
import { findFloorKeyAtReticle } from './key-picking.js?v=5';
import { KEY_REACH, CABINET_REACH, STATION_REACH, KEY_PICK_RADIUS } from './interaction-range.js';
import { createCombinedKeyGeometry, getKeyCrustGeometry, getKeyDisplayScale } from './key-factory.js?v=key-ring';
import { restingKeyY } from './floor-contact.js';
import { CABINET_CAPACITY, CABINET_CELL_BACK_Z, cabinetSlotAtLocalPoint, pegForSlot } from './cabinet-layout.js?v=single-source';

const PICK_ASSIST_RADIUS = KEY_PICK_RADIUS + .04;
const PICK_RETAIN_RADIUS = PICK_ASSIST_RADIUS + .025;
const CABINET_CELLS = Array.from({ length: CABINET_CAPACITY }, (_, slot) => pegForSlot(slot));

// Test the visible geometry for indexed floor candidates before offering pickup assist.
export function createArchiveTargeting({ camera, world, state, keyIndex }) {
  const raycaster = new THREE.Raycaster();
  const center = new THREE.Vector2(0, 0);
  const forward = new THREE.Vector3();
  const targetCenter = new THREE.Vector3();
  const direction = new THREE.Vector3();
  const cabinetEye = new THREE.Vector3();

  const keySearchRadius = KEY_REACH + .65;
  const keyMesh = new THREE.Mesh();
  const keyHits = [];
  let lastFloorKey = null;

  function cabinetTarget(type, local, direct = true) {
    const slot = direct ? cabinetSlotAtLocalPoint(local.x, local.y) : null;
    if (slot !== null) return { kind: 'cabinet', type, slot };

    const held = keyIndex.get(state.held?.[state.selected]);
    if (state.activeBundle?.type !== type &&
        (!held || held.type !== type || held.broken || held.wax || held.mud || held.rust)) {
      return { kind: 'cabinet', type, slot };
    }
    const occupied = new Set();
    for (const key of state.keys) {
      if (key.type === type && key.status === 'sorted') occupied.add(key.cabinetSlot);
    }
    let suggested = null;
    let bestDistance = Infinity;
    for (let index = 0; index < CABINET_CELLS.length; index++) {
      if (occupied.has(index)) continue;
      const cell = CABINET_CELLS[index];
      const distance = (cell.x - local.x) ** 2 + (cell.y - local.y) ** 2;
      if (distance >= bestDistance) continue;
      bestDistance = distance;
      suggested = index;
    }
    return { kind: 'cabinet', type, slot: suggested, assisted: suggested !== null, full: suggested === null };
  }

  // A floor key under the bench (or any other occluder) cannot be aimed at.
  const occlusionRay = new THREE.Raycaster();
  const occlusionPoint = new THREE.Vector3();
  const occlusionDirection = new THREE.Vector3();
  function hiddenBehindFurniture(point) {
    const occluders = world.workstations?.occluders;
    if (!occluders?.length) return false;
    occlusionDirection.copy(point).sub(camera.position);
    const distance = occlusionDirection.length();
    occlusionRay.set(camera.position, occlusionDirection.normalize());
    occlusionRay.far = distance - .02;
    return occlusionRay.intersectObjects(occluders, false).length > 0;
  }

  function targetInView() {
    camera.updateMatrixWorld();
    raycaster.setFromCamera(center, camera);
    let nearest = null;
    let nearestDistance = Infinity;
    for (const hit of raycaster.intersectObjects(world.interactables, false)) {
      const data = hit.object.userData;
      if (hit.distance > (data.kind === 'cabinet' ? CABINET_REACH : STATION_REACH)) continue;
      nearest = data;
      nearestDistance = hit.distance;
      // In a bath, the key under the crosshair is the one to take.
      if (data.kind === 'bath') {
        const keyId = world.workstations?.aimedBathKey?.(data.id, raycaster.ray);
        if (keyId) nearest = { ...data, keyId };
      }
      if (data.kind === 'cabinet') {
        const cabinet = world.cabinets[data.type];
        const local = cabinet.group.worldToLocal(hit.point.clone());
        cabinet.group.worldToLocal(cabinetEye.copy(raycaster.ray.origin));
        // The outer box identifies the cabinet. The cell is on the same
        // recessed plane as its outline, which matters at steep angles.
        const depth = cabinet.cellAimDepth ?? CABINET_CELL_BACK_Z;
        const inward = cabinetEye.z - local.z;
        const ahead = cabinetEye.z - depth;
        if (inward > 1e-5 && ahead > 0) {
          local.lerpVectors(cabinetEye, local, ahead / inward);
          nearest = cabinetTarget(data.type, local);
        } else {
          nearest = cabinetTarget(data.type, local, false);
        }
      }
      break;
    }

    forward.copy(raycaster.ray.direction);
    if (forward.y < 0) {
      const { x, z } = camera.position;
      for (const key of keyIndex.nearby(x, z, keySearchRadius)) {
        if (key.status !== 'floor' || world.isThrowing(key.id) ||
            Math.hypot(key.x - x, key.z - z) > keySearchRadius) continue;
        keyMesh.position.set(key.x, restingKeyY(key.x, key.z) + (key.layer || 0), key.z);
        keyMesh.rotation.set(-Math.PI / 2, key.rotation || 0, 0, 'YXZ');
        keyMesh.scale.setScalar(getKeyDisplayScale('floor', key.type));
        keyMesh.updateMatrixWorld();
        keyMesh.geometry = createCombinedKeyGeometry(key.type, key.broken);
        keyMesh.raycast(raycaster, keyHits);
        for (const kind of [key.mud && 'mud', key.wax && 'wax'].filter(Boolean)) {
          const crust = getKeyCrustGeometry(key.type, key.broken, kind);
          if (!crust) continue;
          keyMesh.geometry = crust;
          keyMesh.raycast(raycaster, keyHits);
        }
        for (const hit of keyHits) {
          if (hit.distance >= nearestDistance || Math.hypot(hit.point.x - x, hit.point.z - z) > KEY_REACH) continue;
          if (hiddenBehindFurniture(hit.point)) continue;
          nearest = { kind: 'key', id: key.id };
          nearestDistance = hit.distance;
        }
        keyHits.length = 0;
      }
    }
    if (nearest) {
      lastFloorKey = nearest.kind === 'key' ? keyIndex.get(nearest.id) : null;
      return nearest;
    }
    const visibleKey = key => key && !hiddenBehindFurniture(
      occlusionPoint.set(key.x, restingKeyY(key.x, key.z), key.z)) ? key : null;
    const assisted = visibleKey(findFloorKeyAtReticle(camera.position, forward, state.keys,
      world.isThrowing, { index: keyIndex, radius: PICK_ASSIST_RADIUS }));
    const floorKey = assisted || visibleKey(lastFloorKey && findFloorKeyAtReticle(camera.position, forward, [lastFloorKey],
      world.isThrowing, { radius: PICK_RETAIN_RADIUS }));
    lastFloorKey = floorKey || null;
    if (floorKey) return { kind: 'key', id: floorKey.id };

    let closest = null;
    let bestDistance = CABINET_REACH;
    for (const cabinet of world.cabinets) {
      cabinet.collider.getWorldPosition(targetCenter);
      direction.copy(targetCenter).sub(camera.position);
      const distance = direction.length();
      if (distance >= bestDistance || forward.dot(direction.normalize()) <= .81) continue;
      bestDistance = distance;
      // The cabinet center is a forgiving fallback when the ray misses its frame.
      // Do not treat that synthetic center as a manually targeted cell.
      const local = cabinet.group.worldToLocal(targetCenter);
      closest = cabinetTarget(cabinet.type, local, false);
    }
    return closest;
  }
  return { targetInView, clearAim: () => { lastFloorKey = null; } };
}
