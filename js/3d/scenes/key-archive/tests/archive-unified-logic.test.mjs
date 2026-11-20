import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from '../dist/vendor/three.js';
import { createArchiveTargeting } from '../dist/js/archive-targeting.js';
import { samplePlacement, sampleDiscard } from '../dist/js/archive-key-motion.js';
import { createKeyIndex } from '../dist/js/key-index.js';
import { CABINET_PLACE_SECONDS } from '../dist/js/cabinet-layout.js';
import { RIGHT_HAND_RELEASE } from '../dist/js/held-key-motion.js';
import { createArchiveActions } from '../dist/js/archive-actions.js';
import { createInitialState, pickupKey } from '../dist/js/rules.js';

test('throw has no windup and launches immediately from the right hand', () => {
  assert.equal(RIGHT_HAND_RELEASE.x,.43);
  assert.equal(RIGHT_HAND_RELEASE.y,-.45);
  const webgl=readFileSync(new URL('../dist/js/world-key-animations.js', import.meta.url), 'utf8');
  const fallback=readFileSync(new URL('../dist/js/fallback-world.js', import.meta.url), 'utf8');
  assert.doesNotMatch(webgl,/stage: 'windup'/);
  assert.doesNotMatch(fallback,/stage: 'windup'/);
  assert.match(webgl,/scene\.add\(model\)/);
  assert.match(fallback,/sampleThrow\(motion\.start, motion\.end/);
});

test('dropping a key targets the right-hand release pose, not camera center', () => {
  const state=createInitialState();
  assert.equal(pickupKey(state,state.keys[0].id),true);
  const keyIndex=createKeyIndex(state.keys);
  const camera=new THREE.PerspectiveCamera();
  camera.position.set(0,1.65,0);
  let captured;
  const actions=createArchiveActions({
    state,keyIndex,camera,world:{
      animateThrow(key,start,end){captured={key,start,end};},
    },
    getYaw:()=>0,isPlaying:()=>true,
    save(){},updateHud(){},tone(){},toast(){},showVictory(){},invalidateHover(){},
  });
  actions.drop();
  assert.ok(captured);
  assert.ok(captured.start.x>.4,'release begins right of the camera');
  assert.ok(captured.start.y>1.1&&captured.start.y<1.4);
  assert.ok(captured.start.z<-.8,'release is in front of the player');
  assert.equal(captured.key.status,'floor');
});

test('WebGL and Canvas use the same interaction query and key silhouette', () => {
  const main = readFileSync(new URL('../dist/js/main.js', import.meta.url), 'utf8');
  const fallback = readFileSync(new URL('../dist/js/fallback-world.js', import.meta.url), 'utf8');
  assert.match(main, /createArchiveTargeting\(\{ camera, world, state, keyIndex \}\)/);
  assert.doesNotMatch(fallback, /function pickTarget\(/);
  assert.match(fallback, /scene\.updateMatrixWorld\(true\)/);

  const camera = new THREE.PerspectiveCamera(73, 1, .055, 120);
  camera.position.set(0, 1.68, 1.35);
  camera.lookAt(0, .06, 0);
  camera.updateMatrixWorld(true);
  const key = { id: 'k-01', type: 0, x: 0, z: 0, rotation: 0, status: 'floor' };
  const state = { keys: [key] };
  const keyIndex = createKeyIndex(state.keys);
  const worldShape = { interactables: [], cabinets: [], isThrowing: () => false };
  for (const mode of ['webgl', 'canvas']) {
    assert.deepEqual(createArchiveTargeting({ camera, world: worldShape, state, keyIndex }).targetInView(),
      { kind: 'key', id: 'k-01' }, `${mode} picks the complete key collider`);
  }
  key.status = 'held';
  assert.equal(createArchiveTargeting({ camera, world: worldShape, state, keyIndex }).targetInView(), null);
});

test('the same cabinet placement easing and damped sway is used by both renderers', () => {
  const start = { x: 0, y: 1.3, z: 0 };
  const end = { x: 3, y: 2, z: -2 };
  assert.deepEqual(samplePlacement(start, end, 0),
    { x: 0, y: 1.3, z: 0, ease: 0, sway: 0, contact: false, landed: false });
  const halfway = samplePlacement(start, end, .15);
  assert.ok(halfway.x > 1.5 && halfway.x < 3);
  assert.ok(halfway.y > start.y);
  assert.equal(samplePlacement(start, end, .299).contact, false);
  assert.equal(samplePlacement(start, end, .30).contact, true);
  const sway = samplePlacement(start, end, .4);
  assert.ok(sway.sway > .10 && sway.sway < .19);
  assert.ok(samplePlacement(start, end, .57).sway < 0);
  assert.ok(Math.abs(samplePlacement(start, end, .88).sway) < Math.abs(sway.sway));
  assert.equal(samplePlacement(start, end, CABINET_PLACE_SECONDS).landed, true);
  assert.equal(Math.abs(samplePlacement(start, end, CABINET_PLACE_SECONDS).sway), 0);
});

test('forge key movement follows the same half-second trajectory in both renderers', () => {
  const start = { x: 1, y: 1, z: 2 };
  const end = { x: 0, y: 1.5, z: 0 };
  assert.deepEqual(sampleDiscard(start, end, 0),
    { x: 1, y: 1, z: 2, progress: 0, ease: 0,
      rotationX: 0, rotationY: 0, scale: .42, contact: false, landed: false });
  const midway = sampleDiscard(start, end, .24);
  assert.ok(midway.y > end.y);
  assert.equal(midway.landed, false);
  assert.equal(sampleDiscard(start, end, .439).contact, false);
  assert.equal(sampleDiscard(start, end, .44).contact, true);
  assert.deepEqual(sampleDiscard(start, end, .48), {
    x: 0, y: 1.5, z: 0, progress: 1, ease: 1,
    rotationX: Math.PI * 1.3, rotationY: Math.PI * 1.1, scale: .04, contact: true, landed: true,
  });
});

test('floor aim bridges a small miss and releases the target outside the tolerance', () => {
  const camera = new THREE.PerspectiveCamera();
  const key = { id: 'near', type: 0, x: 0, z: 0, rotation: 0, status: 'floor' };
  const state = { keys: [key] };
  const world = { interactables: [], cabinets: [], isThrowing: () => false };
  const { targetInView, clearAim } = createArchiveTargeting({ camera, world, state, keyIndex: createKeyIndex(state.keys) });
  function aim(x) {
    camera.position.set(x, 1.78, 0);
    camera.lookAt(x, 0, 0);
    return targetInView();
  }
  assert.deepEqual(aim(.185), { kind: 'key', id: key.id });
  assert.deepEqual(aim(.215), { kind: 'key', id: key.id });
  assert.equal(aim(.25), null);
  assert.deepEqual(aim(.185), { kind: 'key', id: key.id });
  clearAim();
  assert.equal(aim(.215), null);
});

test('visible metal wins over a nearer neighboring key with an overlapping pickup area', () => {
  const key = { id: 'under-reticle', type: 9, x: 0, z: 0, rotation: 0, status: 'floor' };
  const neighbor = { ...key, id: 'neighbor', x: .145, layer: .025 };
  const state = { keys: [neighbor, key] };
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 1.78, 0);
  camera.lookAt(0, 0, 0);
  const world = { interactables: [], cabinets: [], isThrowing: () => false };
  const { targetInView } = createArchiveTargeting({ camera, world, state, keyIndex: createKeyIndex(state.keys) });
  assert.deepEqual(targetInView(), { kind: 'key', id: key.id });
  camera.position.x = neighbor.x;
  camera.lookAt(neighbor.x, 0, 0);
  assert.deepEqual(targetInView(), { kind: 'key', id: neighbor.id });
});
