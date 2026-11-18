import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.js';
import { createPlayerMovement } from '../dist/js/player-movement.js';

test('movement uses camera coordinates and stops at walls and workstations', () => {
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 1.78, 20);
  const player = createPlayerMovement(camera, { x: 11.12, z: 22.53 });
  assert.equal(player.positionBlocked(12, 0), true);
  assert.equal(player.positionBlocked(0, 21), false);
  assert.equal(player.positionBlocked(-10.9, 8.5), true);
  assert.equal(player.positionBlocked(10.9, -17), true);
  assert.equal(player.positionBlocked(10, 8.5), false);
  assert.equal(player.positionBlocked(0, 22), true);
  assert.equal(player.positionBlocked(0, 0), true);
  assert.equal(player.move(new Set(['w']), 0, .04), true);
  assert.ok(camera.position.z < 20);
  assert.equal(player.move(new Set(), 0, .04), false);
});
