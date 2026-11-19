import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from '../dist/vendor/three.js';
import { createArchiveTargeting } from '../dist/js/archive-targeting.js';
import { samplePlacement, sampleDiscard } from '../dist/js/archive-key-motion.js';
import { createKeyIndex } from '../dist/js/key-index.js';
import { CABINET_PLACE_SECONDS } from '../dist/js/cabinet-layout.js';

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
  const key = { id: 'k-01', x: 0, z: 0, rotation: 0, status: 'floor' };
  const collider = new THREE.Mesh(new THREE.BoxGeometry(.3, .14, .8));
  collider.position.set(0, .1, 0);
  collider.userData = { kind: 'key', id: key.id };
  collider.updateMatrixWorld(true);
  const state = { keys: [key] };
  const keyIndex = createKeyIndex(state.keys);
  const worldShape = { interactables: [collider], cabinets: [], isThrowing: () => false };
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
    { x: 0, y: 1.3, z: 0, ease: 0, sway: 0, landed: false });
  const halfway = samplePlacement(start, end, .15);
  assert.ok(halfway.x > 1.5 && halfway.x < 3);
  assert.ok(halfway.y > start.y);
  const sway = samplePlacement(start, end, .4);
  assert.ok(Math.abs(sway.sway) < .055);
  assert.equal(samplePlacement(start, end, CABINET_PLACE_SECONDS).landed, true);
  assert.equal(Math.abs(samplePlacement(start, end, CABINET_PLACE_SECONDS).sway), 0);
});

test('forge key movement follows the same half-second trajectory in both renderers', () => {
  const start = { x: 1, y: 1, z: 2 };
  const end = { x: 0, y: 1.5, z: 0 };
  assert.deepEqual(sampleDiscard(start, end, 0),
    { x: 1, y: 1, z: 2, progress: 0, ease: 0,
      rotationX: 0, rotationY: 0, scale: .42, landed: false });
  const midway = sampleDiscard(start, end, .24);
  assert.ok(midway.y > end.y);
  assert.equal(midway.landed, false);
  assert.deepEqual(sampleDiscard(start, end, .48), {
    x: 0, y: 1.5, z: 0, progress: 1, ease: 1,
    rotationX: Math.PI * 1.3, rotationY: Math.PI * 1.1, scale: .04, landed: true,
  });
});
