// @ts-check
import * as THREE from '../vendor/three.js';
import { CANDLE_WICK_Y, CANDLE_FLAME_HEIGHT } from './archive-candles.js';

// Where the held key sits relative to the hand:
//  * the resting pose in the hand;
//  * a short toss into the hand when a key is lifted out of a bath;
//  * lying flat over a candle flame while its wax melts, sweeping left and
//    right so the flame passes under the whole key, then back to the hand.
export const HAND_POSE = new THREE.Euler(-.12, -.34, -.53);
const HAND_FLIGHT_MS = 420;

export function createHeldKeyPose({ hand, camera, candles, sceneNow }) {
  // `blend` eases between the hand (0) and the candle (1).
  const meltPose = { candleId: null, lastCandleId: null, blend: 0 };
  const scratch = { quaternion: new THREE.Quaternion(), hand: new THREE.Quaternion(),
    base: new THREE.Quaternion(), target: new THREE.Vector3(), yaw: new THREE.Euler() };
  let flight = null;
  const candleById = id => candles.find(item => item.id === id);

  function startHandFlight(key, from) {
    if (!from) return;
    const position = new THREE.Vector3(), quaternion = new THREE.Quaternion(), scale = new THREE.Vector3();
    from.decompose(position, quaternion, scale);
    flight = { keyId: key.id, position, quaternion, scale: scale.x, startedAt: sceneNow() };
  }

  function flyToHand(model, keyId) {
    if (!flight || keyId !== flight.keyId) { flight = null; return false; }
    const t = Math.min(1, (sceneNow() - flight.startedAt) / HAND_FLIGHT_MS);
    const ease = 1 - Math.pow(1 - t, 3);
    hand.updateMatrixWorld(true);
    const local = hand.worldToLocal(flight.position.clone());
    const handTurn = hand.getWorldQuaternion(new THREE.Quaternion()).invert();
    const localTurn = handTurn.multiply(flight.quaternion);
    const localScale = flight.scale / hand.getWorldScale(new THREE.Vector3()).x;
    // A small arc on the way, so it reads as a toss rather than a slide.
    model.position.copy(local).multiplyScalar(1 - ease);
    model.position.y += Math.sin(Math.PI * t) * .08;
    model.quaternion.copy(localTurn).slerp(scratch.base.setFromEuler(HAND_POSE), ease);
    model.scale.setScalar(localScale + (model.userData.handScale - localScale) * ease);
    if (t >= 1) flight = null;
    return true;
  }

  function holdOverCandle(candleId) {
    meltPose.candleId = candleId || null;
    if (meltPose.candleId) meltPose.lastCandleId = meltPose.candleId;
  }

  function place(model, keyId, elapsed) {
    if (!model) return;
    model.userData.handScale ??= model.scale.x;
    if (flyToHand(model, keyId)) return;
    const goal = meltPose.candleId ? 1 : 0;
    meltPose.blend += (goal - meltPose.blend) * (1 - Math.exp(-elapsed / .12));
    if (Math.abs(goal - meltPose.blend) < .002) meltPose.blend = goal;
    scratch.base.setFromEuler(HAND_POSE);
    const candle = candleById(meltPose.lastCandleId);
    // The flame gutters while the wax over it melts.
    candle?.disturb?.(meltPose.candleId ? meltPose.blend : 0);
    if (!candle || meltPose.blend <= 0) {
      model.position.set(0, 0, 0);
      model.quaternion.copy(scratch.base);
      model.scale.setScalar(model.userData.handScale);
      return;
    }
    // Target: flat, face up, lying across the view (head left, teeth right).
    // The wax sits in the tip of the flame.
    scratch.target.set(candle.x, candle.y + CANDLE_WICK_Y + CANDLE_FLAME_HEIGHT * .8, candle.z);
    camera.getWorldQuaternion(scratch.quaternion);
    scratch.yaw.setFromQuaternion(scratch.quaternion, 'YXZ');
    // Slide the key back and forth along its length, so the flame passes
    // under the wax from the head to the teeth.
    const sweep = Math.sin(sceneNow() * .0042) * .14 * meltPose.blend;
    scratch.target.x += Math.cos(scratch.yaw.y) * sweep;
    scratch.target.z -= Math.sin(scratch.yaw.y) * sweep;
    hand.updateMatrixWorld(true);
    const local = hand.worldToLocal(scratch.target.clone());
    // Yaw +90°: the key's length runs left to right in front of the player.
    const flat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, scratch.yaw.y + Math.PI / 2, 0, 'YXZ'));
    hand.getWorldQuaternion(scratch.hand);
    const localTurn = scratch.hand.invert().multiply(flat);
    const t = meltPose.blend * meltPose.blend * (3 - 2 * meltPose.blend);
    model.position.set(0, 0, 0).lerp(local, t);
    model.quaternion.copy(scratch.base).slerp(localTurn, t);
    // A little smaller over the small candle than up close in the hand.
    model.scale.setScalar(model.userData.handScale * (1 - .3 * t));
  }

  // Nothing held any more: a flame left mid-melt calms down.
  function release() {
    if (meltPose.lastCandleId) candleById(meltPose.lastCandleId)?.disturb?.(0);
  }

  return {
    startHandFlight, holdOverCandle, place, release,
    get flying() { return flight !== null; },
    // The hand is in its ordinary carry pose (not flying, not over a candle).
    get resting() { return !flight && !meltPose.candleId && meltPose.blend === 0; },
  };
}
