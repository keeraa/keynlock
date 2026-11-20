import { FORGE_SURFACE_Y } from './station-layout.js?v=working-baths';
import * as THREE from '../vendor/three.js';
import { floorSurfaceY, RUG_TOP } from './floor-contact.js';
import { createKeyModel, disposeKeySceneModel, getKeyDisplayScale } from './key-factory.js?v=key-ring';
import { cabinetKeyPose } from './cabinet-layout.js?v=cabinet-cell-glow';
import { sampleThrow } from './archive-throw-trajectory.js?v=archive-foley';
import { playMotionContact, samplePlacement, sampleDiscard, cabinetContactGlow } from './archive-key-motion.js?v=key-ring';
import { RIGHT_HAND_RELEASE } from './held-key-motion.js?v=2';

// The WebGL representation of the same trajectories used by Canvas.
export function createWorldKeyAnimations({ scene, camera, cabinets, workstations, invalidate, syncKey, refreshCabinet, sceneNow = () => performance.now() }) {
  const thrownKeys = new Map();
  const placingKeys = new Map();
  const discardingKeys = new Map();
  const swayAxis = new THREE.Vector3(0, 0, 1);
  const swayRotation = new THREE.Quaternion();
  const bounceAxis = new THREE.Vector3(0, 1, 0);
  const bounceRotation = new THREE.Quaternion();

  function animateThrow(key, start, end) {
    invalidate();
    const model = createKeyModel(key.type, { id: key.id, variation: key.variation,
      broken: key.broken, mud: key.mud, rust: key.rust, wax: key.wax,
      scale: getKeyDisplayScale('floor', key.type) });
    model.position.set(start.x, start.y, start.z);
    const releaseQuaternion = camera.quaternion.clone().multiply(
      new THREE.Quaternion().setFromEuler(new THREE.Euler(
        RIGHT_HAND_RELEASE.rotationX, RIGHT_HAND_RELEASE.rotationY, RIGHT_HAND_RELEASE.rotationZ)));
    model.quaternion.copy(releaseQuaternion);
    scene.add(model);
    const floorRotation = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(-Math.PI / 2, key.rotation, 0, 'YXZ'));
    thrownKeys.set(key.id, { key, start, end, startTime: sceneNow(), model, releaseQuaternion, floorRotation });
    syncKey(key);
  }
  function isThrowing(keyId) { return thrownKeys.has(keyId); }

  function cancelPlace(keyId) {
    const motion = placingKeys.get(keyId);
    if (!motion) return;
    scene.remove(motion.pivot);
    disposeKeySceneModel(motion.model);
    placingKeys.delete(keyId);
    invalidate();
  }

  function animatePlace(key, slotIndex, { fromRing = false, delay = 0 } = {}) {
    invalidate();
    camera.updateMatrixWorld(true);
    const start = camera.localToWorld(new THREE.Vector3(fromRing ? -.49 : .42, -.37, -.84));
    const cabinet = cabinets[key.type];
    cabinet.group.updateMatrixWorld(true);
    const peg = cabinetKeyPose(slotIndex, getKeyDisplayScale('cabinet', key.type));
    const end = cabinet.group.localToWorld(new THREE.Vector3(peg.x, peg.y, peg.z));
    const model = createKeyModel(key.type, { id: key.id, variation: key.variation });
    const pivot = new THREE.Group();
    pivot.position.copy(start);
    pivot.visible = !delay;
    pivot.add(model);
    scene.add(pivot);
    placingKeys.set(key.id, {
      key, slotIndex, fromRing, start, end, endScale: peg.scale, cabinetDepthScale: cabinet.group.scale.z, pivot, model, startTime: sceneNow() + delay,
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
    const end = station.group.localToWorld(new THREE.Vector3(0, FORGE_SURFACE_Y, .08));
    const model = createKeyModel(key.type, { id: key.id, variation: key.variation, broken: true });
    scene.add(model);
    discardingKeys.set(key.id, { start, end, model, startTime: sceneNow() });
  }

  function update(now, playSound) {
    for (const [id, motion] of thrownKeys) {
      const elapsed = (now - motion.startTime) / 1000;
      const pose = sampleThrow(motion.start, motion.end, elapsed);
      if (pose.contact && !motion.soundPlayed)
        playMotionContact(motion, true, floorSurfaceY(pose.x, pose.z) === RUG_TOP ? 'dropRug' : 'dropWood', playSound);
      if (pose.landed) {
        invalidate();
        thrownKeys.delete(id);
        scene.remove(motion.model);
        disposeKeySceneModel(motion.model);
        syncKey(motion.key);
        continue;
      }
      motion.model.position.set(pose.x, pose.y, pose.z);
      motion.model.quaternion.slerpQuaternions(motion.releaseQuaternion, motion.floorRotation, pose.settle);
      if (pose.wobble) motion.model.quaternion.multiply(bounceRotation.setFromAxisAngle(bounceAxis, pose.wobble));
    }
    for (const [id, motion] of placingKeys) {
      const elapsed = (now - motion.startTime) / 1000;
      if (elapsed < 0) continue;
      motion.pivot.visible = true;
      const pose = samplePlacement(motion.start, motion.end, elapsed);
      if (motion.fromRing && pose.contact)
        cabinets[motion.key.type].flashCell(motion.slotIndex, cabinetContactGlow(elapsed));
      playMotionContact(motion, pose.contact, 'place', playSound);
      const pivotHeight = .07 * pose.ease;
      motion.pivot.position.set(pose.x, pose.y + pivotHeight, pose.z);
      motion.model.position.y = -pivotHeight;
      motion.pivot.quaternion.slerpQuaternions(motion.startRotation, motion.endRotation, pose.ease);
      const startScale = getKeyDisplayScale('floor', motion.key.type);
      const scale = motion.endScale + (startScale - motion.endScale) * (1 - pose.ease);
      motion.model.scale.set(scale, scale, scale * (1 + (motion.cabinetDepthScale - 1) * pose.ease));
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
      playMotionContact(motion, pose.contact, 'melt', playSound);
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
    animateDiscard, isThrowing, cancelPlace, update };
}
