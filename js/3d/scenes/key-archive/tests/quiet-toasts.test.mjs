import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.js';
import { createArchiveActions } from '../dist/js/archive-actions.js';
import { createKeyIndex } from '../dist/js/key-index.js';
import { createInitialState, upgradeKeyConditions } from '../dist/js/rules.js';

// No message echoes what the player just did and already saw and heard:
// taking a key, throwing it, putting it in its cabinet. Messages are for why
// something did not work, hidden rules, and events that happen on their own.
function setup(target) {
  const state = createInitialState();
  upgradeKeyConditions(state);
  const toasts = [];
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 1.78, 10);
  camera.updateMatrixWorld(true);
  const actions = createArchiveActions({ state, keyIndex: createKeyIndex(state.keys), camera,
    world: { syncKey() {}, animatePickup() {}, animatePlace() {}, refreshCabinet() {}, cancelPlace() {},
      animateThrow(key, flight, landed) { landed(flight.landing); }, workstations: {} },
    targetInView: () => target.current, getYaw: () => 0, isPlaying: () => true, stationNow: () => 1000,
    save() {}, updateHud() {}, tone() {}, toast: message => toasts.push(message), showVictory() {}, invalidateHover() {} });
  return { state, actions, toasts };
}

test('taking, throwing and filing a clean key say nothing', () => {
  const target = { current: null };
  const { state, actions, toasts } = setup(target);
  const key = state.keys.find(item => item.status === 'floor' && !item.mud && !item.rust && !item.broken && !item.wax);
  target.current = { kind: 'key', id: key.id };
  actions.interact();
  assert.equal(key.status, 'held');
  actions.drop();
  assert.equal(key.status, 'floor');
  target.current = { kind: 'key', id: key.id };
  actions.interact();
  target.current = { kind: 'cabinet', type: key.type, slot: 0 };
  actions.interact();
  assert.equal(key.status, 'sorted');
  assert.deepEqual(toasts, []);
});

test('a key offered to the wrong cabinet still explains why', () => {
  const target = { current: null };
  const { state, actions, toasts } = setup(target);
  const key = state.keys.find(item => item.status === 'floor' && !item.mud && !item.rust && !item.broken && !item.wax);
  target.current = { kind: 'key', id: key.id };
  actions.interact();
  target.current = { kind: 'cabinet', type: (key.type + 1) % 10, slot: 0 };
  actions.interact();
  assert.equal(toasts.length, 1);
  assert.match(toasts[0], /шкаф|cabinet/i);
});
