import * as THREE from '../vendor/three.js';
import { createKeyModel, getKeyDisplayScale, disposeKeySceneModel } from './key-factory.js';
import { windowBeamLightAt } from './archive-window-rays.js';
import { nextHandMotionWeight, samplePickupLift, RIGHT_HAND_RELEASE } from './held-key-motion.js';
import { addHeldKeyWindowLight } from './held-key-light.js';
import { HAND_POSE, createHeldKeyPose } from './held-key-pose.js';
import { createHeldWaxMelt } from './held-wax-melt.js';

// The key in the player's right hand: its model and fill light, walk sway,
// the lift on pickup, pulling back from walls, the glint once it is clean,
// and (via held-key-pose / held-wax-melt) the toss from a bath and the
// melting over a candle.
export function createHeldKey({ camera, windowDaylight, windowWarmth, limitHandReach, candles,
  cleaningEffects, keyIndex, workstations, sceneNow, invalidate = () => {} }) {
  const hand = new THREE.Group();
  hand.position.set(RIGHT_HAND_RELEASE.x, RIGHT_HAND_RELEASE.y, RIGHT_HAND_RELEASE.z);
  camera.add(hand);
  // Soft fill for the key in hand. It sits ~0.4 m from the key, so with
  // physical falloff a strong value washes pale metals (steel, silver) out.
  const handLight = new THREE.PointLight(0xffd6a1, .85, 3);
  handLight.position.set(.3, -.3, -.5);
  camera.add(handLight);
  let displayedHandId = null;
  let displayedHandWax = false;
  let handModel = null;
  let disposeHandLight = null;
  let pendingHandShine = null;
  const heldKeyDaylight = { value: 0 };
  const handWorldPosition = new THREE.Vector3();
  const carryBounds = new THREE.Box3();
  const carryWorldBounds = new THREE.Box3();
  const carryEye = new THREE.Vector3();
  let handReach = 1;
  let handMotion = 0;
  let pickupAt = -Infinity;
  const heldPose = createHeldKeyPose({ hand, camera, candles, sceneNow });
  const heldWax = createHeldWaxMelt({ candles, cleaningEffects, keyIndex, sceneNow });

  function lightAtHand() {
    hand.getWorldPosition(handWorldPosition);
    const { x, y, z } = handWorldPosition;
    return windowDaylight.value * windowBeamLightAt(x, y, z);
  }

  function refreshHand(key) {
    if (displayedHandId === (key?.id || null) && displayedHandWax === Boolean(key?.wax)) return;
    displayedHandWax = Boolean(key?.wax);
    if (handModel) {
      hand.remove(handModel);
      disposeHandLight();
      disposeKeySceneModel(handModel);
    }
    if (displayedHandId !== (key?.id || null)) pickupAt = -Infinity;
    displayedHandId = key?.id || null;
    handModel = null;
    invalidate();
    if (!key) return;
    handModel = createKeyModel(key.type, { id: key.id, scale: getKeyDisplayScale('hand', key.type),
      variation: key.variation, broken: key.broken, mud: key.mud, rust: key.rust, wax: key.wax });
    handModel.rotation.copy(HAND_POSE);
    carryBounds.setFromObject(handModel);
    hand.add(handModel);
    heldKeyDaylight.value = lightAtHand();
    disposeHandLight = addHeldKeyWindowLight(handModel, heldKeyDaylight, windowWarmth);
  }

  function meltHeldWax(progress, candleId, options = {}) {
    heldPose.holdOverCandle(progress > 0 && candleId ? candleId : null);
    heldWax.update(handModel, displayedHandId, progress, candleId, options);
  }

  function update(now, elapsed, moving, playing, playSound) {
    if (pendingHandShine !== displayedHandId) pendingHandShine = null;
    if (playing && pendingHandShine !== null && handModel && hand.visible && !heldPose.flying) {
      pendingHandShine = null;
      cleaningEffects.shine(handModel, 5, { attachTo: hand });
      playSound?.('keyShine', camera.position);
    }
    if (!handModel) {
      handMotion = 0;
      handReach = 1;
      handLight.position.set(.3, -.3, -.5);
      handLight.intensity = .85;
      heldPose.release();
      return;
    }
    hand.visible = !workstations.isLifting(displayedHandId);
    // Blend walk sway in over several frames: an instant amplitude change
    // on the first step looked like a one-frame key flicker.
    handMotion = nextHandMotionWeight(handMotion, moving, elapsed);
    hand.rotation.z = Math.sin(now * .0031) * (.012 + handMotion * .033);
    const pickupOffset = .12 * samplePickupLift((now - pickupAt) / 1000);
    hand.position.set(RIGHT_HAND_RELEASE.x,
      RIGHT_HAND_RELEASE.y + Math.sin(now * .0029) * (.012 + handMotion * .023) - pickupOffset,
      RIGHT_HAND_RELEASE.z);
    hand.scale.setScalar(1);
    if (heldPose.resting) {
      hand.updateWorldMatrix(true, false);
      carryEye.setFromMatrixPosition(camera.matrixWorld);
      carryWorldBounds.copy(carryBounds).applyMatrix4(hand.matrixWorld);
      const safeReach = limitHandReach(carryEye, carryWorldBounds);
      handReach = Math.min(safeReach, handReach + elapsed * 4.5);
      hand.position.multiplyScalar(handReach);
      hand.scale.setScalar(handReach);
    } else handReach = 1;
    handLight.position.set(.3 * handReach, -.3 * handReach, -.5 * handReach);
    handLight.intensity = .85 * handReach * handReach;
    heldKeyDaylight.value += (lightAtHand() - heldKeyDaylight.value) * (1 - Math.exp(-elapsed / .065));
    heldPose.place(handModel, displayedHandId, elapsed);
  }

  return {
    refreshHand, meltHeldWax, update,
    startHandFlight: heldPose.startHandFlight,
    shineHand(keyId) { pendingHandShine = keyId; },
    animatePickup() { pickupAt = sceneNow(); },
    getThrowRelease() { return hand.getWorldPosition(new THREE.Vector3()); },
  };
}
