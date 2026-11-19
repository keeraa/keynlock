import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.js';
import { CABINET_CAPACITY, CABINET_CELL_INNER_HALF_WIDTH, CABINET_CELL_INNER_HALF_HEIGHT,
  CABINET_CELL_BACK_Z, CABINET_BACK_FRONT_Z, cabinetSlotAtLocalPoint, pegForSlot,
} from '../dist/js/cabinet-layout.js';
import { createArchiveTargeting } from '../dist/js/archive-targeting.js';
import { createArchiveActions } from '../dist/js/archive-actions.js';
import { createKeyIndex } from '../dist/js/key-index.js';
import { loadArchiveState } from '../dist/js/archive-persistence.js';
import { STORAGE_KEY, createInitialState, pickupKey, selectedKey, cabinetSlotKey,
  putKeyInCabinet, takeKeyFromCabinet, upgradeCabinetSlots, validateState,
} from '../dist/js/rules.js';

test('all 96 visible cubbies map from the aim point to their exact slot', () => {
  assert.equal(CABINET_CELL_BACK_Z, CABINET_BACK_FRONT_Z);
  assert.ok(CABINET_CELL_INNER_HALF_WIDTH < .12 && CABINET_CELL_INNER_HALF_HEIGHT < .12);
  for (let slot = 0; slot < CABINET_CAPACITY; slot++) {
    const peg = pegForSlot(slot);
    assert.equal(cabinetSlotAtLocalPoint(peg.x, peg.y), slot);
  }
  for (const [x, y] of [[-1.63, 2], [1.62, 2], [0, 1], [0, 3.37]])
    assert.equal(cabinetSlotAtLocalPoint(x, y), null);
});

test('reticle uses the cabinet hit point even when the cabinet is rotated', () => {
  const scene = new THREE.Scene();
  const group = new THREE.Group();
  group.position.set(-11.58, -.035, 0);
  group.rotation.y = Math.PI / 2;
  group.scale.z = .5;
  scene.add(group);
  const collider = new THREE.Mesh(new THREE.BoxGeometry(3.82, 4.65, .15));
  collider.position.set(0, 2.53, .74);
  collider.userData = { kind: 'cabinet', type: 0 };
  group.add(collider);
  const peg = pegForSlot(26);
  const aim = group.localToWorld(new THREE.Vector3(peg.x, peg.y, .74));
  const camera = new THREE.PerspectiveCamera(72, 1, .05, 40);
  camera.position.copy(group.localToWorld(new THREE.Vector3(peg.x, peg.y, 2.6)));
  camera.lookAt(aim);
  scene.updateMatrixWorld(true);
  camera.updateMatrixWorld(true);
  const state = { keys: [] };
  const target = createArchiveTargeting({ camera, world: {
    interactables: [collider], cabinets: [{ group, collider, type: 0 }], isThrowing: () => false,
  }, state, keyIndex: new Map() }).targetInView();
  assert.deepEqual(target, { kind: 'cabinet', type: 0, slot: 26 });
});

test('occupied cabinet cells can be taken and moved to another cell', () => {
  const state = createInitialState();
  const key = state.keys.find(item => item.type === 0 && !item.broken);
  key.mud = false; key.rust = false;
  assert.equal(pickupKey(state, key.id), true);
  assert.equal(putKeyInCabinet(state, 0, 37), true);
  assert.equal(key.cabinetSlot, 37);
  assert.equal(cabinetSlotKey(state, 0, 37), key);
  assert.equal(cabinetSlotKey(state, 0, 38), null);
  assert.equal(takeKeyFromCabinet(state, 0, 37), key);
  assert.equal(key.cabinetSlot, undefined);
  assert.equal(selectedKey(state), key);
  assert.equal(putKeyInCabinet(state, 0, 12), true);
  assert.equal(key.cabinetSlot, 12);
  assert.equal(validateState(state), true);
});

test('aiming and pressing E moves a key between the exact targeted cells', () => {
  const state = createInitialState();
  const key = state.keys.find(item => item.type === 0 && !item.broken);
  key.mud = false; key.rust = false;
  pickupKey(state, key.id);
  let slot = 47;
  const placed = [];
  const world = { animatePlace(item, index) { placed.push([item.id, index]); },
    cancelPlace() {}, refreshCabinet() {} };
  const actions = createArchiveActions({ state, keyIndex: createKeyIndex(state.keys),
    world, camera: new THREE.PerspectiveCamera(),
    targetInView: () => ({ kind: 'cabinet', type: 0, slot }),
    getYaw: () => 0, isPlaying: () => true,
    save() {}, updateHud() {}, tone() {}, toast() {}, showVictory() {}, invalidateHover() {},
  });
  actions.interact();
  assert.equal(cabinetSlotKey(state, 0, 47), key);
  assert.deepEqual(placed, [[key.id, 47]]);
  actions.interact();
  assert.equal(selectedKey(state), key);
  slot = 59;
  actions.interact();
  assert.equal(cabinetSlotKey(state, 0, 47), null);
  assert.equal(cabinetSlotKey(state, 0, 59), key);
  assert.deepEqual(placed, [[key.id, 47], [key.id, 59]]);
});

test('old saves receive stable cabinet cells without losing already placed keys', () => {
  const saved = createInitialState();
  const keys = saved.keys.filter(key => key.type === 3 && !key.broken).slice(0, 3);
  keys.forEach(key => { key.status = 'sorted'; key.mud = false; key.rust = false; });
  keys[1].cabinetSlot = 67;
  assert.equal(validateState(saved), true);
  const loaded = loadArchiveState({ getItem(name) {
    return name === STORAGE_KEY ? JSON.stringify(saved) : null;
  } });
  assert.deepEqual(keys.map(key => loaded.keys.find(item => item.id === key.id).cabinetSlot),
    [0, 67, 1]);
  upgradeCabinetSlots(loaded);
  assert.equal(validateState(loaded), true);
  assert.deepEqual(keys.map(key => loaded.keys.find(item => item.id === key.id).cabinetSlot),
    [0, 67, 1]);
});
