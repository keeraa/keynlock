import * as THREE from '../vendor/three.js';
import { createKeyModel, disposeKeySceneModel, getKeyDisplayScale } from './key-factory.js?v=3';
import { cabinetKeyPose } from './cabinet-layout.js?v=22';
import { sampleThrow } from './throw-physics.js?v=3';
import { samplePlacement, sampleDiscard } from './archive-key-motion.js';

// The WebGL representation of the same trajectories used by Canvas.
export function createWorldKeyAnimations({ scene, camera, cabinets, workstations, invalidate, syncKey, refreshCabinet }) {
  const thrownKeys = new Map();
  const placingKeys = new Map();
  const discardingKeys = new Map();
  const swayAxis = new THREE.Vector3(0, 0, 1);
  const swayRotation = new THREE.Quaternion();

  function animateThrow(key, start, end) {
    invalidate();
    const model = createKeyModel(key.type, { id: key.id, variation: key.variation,
      broken: key.broken, mud: key.mud, rust: key.rust,
      scale: getKeyDisplayScale('floor', key.type) });
    scene.add(model);
    thrownKeys.set(key.id, { key, start, end, startTime: performance.now(), model });
    syncKey(key);
  }
  function isThrowing(keyId) { return thrownKeys.has(keyId); }

  function animatePlace(key, slotIndex) {
    invalidate();
    camera.updateMatrixWorld(true);
    const start = camera.localToWorld(new THREE.Vector3(.42, -.37, -.84));
    const cabinet = cabinets[key.type];
    cabinet.group.updateMatrixWorld(true);
    const peg = cabinetKeyPose(slotIndex, getKeyDisplayScale('cabinet', key.type));
    const end = cabinet.group.localToWorld(new THREE.Vector3(peg.x, peg.y, peg.z));
    const model = createKeyModel(key.type, { id: key.id, variation: key.variation });
    const pivot = new THREE.Group();
    pivot.add(model);
    scene.add(pivot);
    placingKeys.set(key.id, {
      key, start, end, endScale: peg.scale, pivot, model, startTime: performance.now(),
      startRotation: camera.quaternion.clone(),
      endRotation: cabinet.group.getWorldQuaternion(new THREE.Quaternion()),
    });
    refreshCabinet(key.type);
  }

  function animateDiscard(key, stationId = 'center') {
    invalidate();
    workstations.startMelt(stationId);
    camera.updateMatrixWorld(true);
    const start = camera.localToWorld(new THREE.Vector3(.42, -.37, -.84));
    const station = workstations.stations.find(item => item.id === stationId) || workstations.stations[0];
    station.group.updateMatrixWorld(true);
    const end = station.group.localToWorld(new THREE.Vector3(0, 1.48, .08));
    const model = createKeyModel(key.type, { id: key.id, variation: key.variation, broken: true });
    scene.add(model);
    discardingKeys.set(key.id, { start, end, model, startTime: performance.now() });
  }

  function update(now) {
    for (const [id, motion] of thrownKeys) {
      const elapsed = (now - motion.startTime) / 1000;
      const pose = sampleThrow(motion.start, motion.end, elapsed);
      if (pose.landed) {
        invalidate();
        thrownKeys.delete(id);
        scene.remove(motion.model);
        disposeKeySceneModel(motion.model);
        syncKey(motion.key);
        continue;
      }
      motion.model.position.set(pose.x, pose.y, pose.z);
      const settle = Math.min(1, Math.max(0, (elapsed - .5) / 1.2));
      const eased = 1 - (1 - settle) ** 3;
      motion.model.rotation.set(
        pose.spin - Math.PI * .5 * eased,
        pose.spin * .11 * (1 - eased) + motion.key.rotation * eased,
        Math.sin(pose.spin) * .18 * (1 - eased),
        'YXZ',
      );
    }
    for (const [id, motion] of placingKeys) {
      const elapsed = (now - motion.startTime) / 1000;
      const pose = samplePlacement(motion.start, motion.end, elapsed);
      motion.pivot.position.set(pose.x, pose.y, pose.z);
      motion.pivot.quaternion.slerpQuaternions(motion.startRotation, motion.endRotation, pose.ease);
      const startScale = getKeyDisplayScale('floor', motion.key.type);
      motion.model.scale.setScalar(motion.endScale + (startScale - motion.endScale) * (1 - pose.ease));
      if (pose.sway) motion.pivot.quaternion.multiply(swayRotation.setFromAxisAngle(swayAxis, pose.sway));
      if (!pose.landed) continue;
      invalidate();
      scene.remove(motion.pivot);
      disposeKeySceneModel(motion.model);
      placingKeys.delete(id);
      refreshCabinet(motion.key.type);
    }
    for (const [id, motion] of discardingKeys) {
      const elapsed = (now - motion.startTime) / 1000;
      const pose = sampleDiscard(motion.start, motion.end, elapsed);
      if (pose.landed) {
        invalidate();
        scene.remove(motion.model);
        disposeKeySceneModel(motion.model);
        discardingKeys.delete(id);
        continue;
      }
      motion.model.position.set(pose.x, pose.y, pose.z);
      motion.model.rotation.set(pose.rotationX, pose.rotationY, 0);
      motion.model.scale.setScalar(pose.scale);
    }
  }
  return { thrownKeys, placingKeys, discardingKeys, animateThrow, animatePlace,
    animateDiscard, isThrowing, update };
}
