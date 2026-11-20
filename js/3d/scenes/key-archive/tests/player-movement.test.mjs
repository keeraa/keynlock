import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.js';
import { createPlayerMovement } from '../dist/js/player-movement.js';
import { CABINET_BODY_WIDTH } from '../dist/js/cabinet-layout.js';

test('movement uses camera coordinates and stops at walls and workstations', () => {
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 1.78, 20);
  const player = createPlayerMovement(camera, { x: 11.12, z: 22.53 });
  assert.equal(player.positionBlocked(12, 0), true);
  assert.equal(player.positionBlocked(0, 21), false);
  assert.equal(player.positionBlocked(-10.9, 8.5), true);
  assert.equal(player.positionBlocked(10.9, -17), true);
  assert.equal(player.positionBlocked(10.9, -17 + CABINET_BODY_WIDTH / 2 + .1), true, 'cabinet edge blocks walking');
  assert.equal(player.positionBlocked(10.9, -12.75), false, 'passage between cabinets remains open');
  assert.equal(player.positionBlocked(10, 8.5), false);
  assert.equal(player.positionBlocked(0, 22), true);
  assert.equal(player.positionBlocked(0, 0), true);
  assert.equal(player.positionBlocked(0, -12.5), false);
  assert.equal(player.positionBlocked(0, 12.5), false);
  assert.equal(player.move(new Set(['w']), 0, .04), true);
  assert.ok(camera.position.z < 20);
  assert.equal(player.move(new Set(), 0, .04), false);
});

test('the player cannot walk into the candle sconces beside the cabinets', async () => {
  const { createPlayerMovement, SCONCE_X } = await import('../dist/js/player-movement.js');
  const { createArchiveCandles } = await import('../dist/js/archive-candles.js');
  const THREE = await import('../dist/vendor/three.js');
  const player = createPlayerMovement(new THREE.PerspectiveCamera(), { x: 11.12, z: 22.53 });
  const sconces = createArchiveCandles(new THREE.Scene()).candles.filter(candle => candle.type !== null);
  assert.equal(sconces.length, 20);
  for (const candle of sconces) {
    assert.equal(Math.abs(candle.x), SCONCE_X, 'movement knows where the sconces are');
    for (const dz of [-.3, 0, .3]) assert.equal(player.positionBlocked(candle.x, candle.z + dz), true, candle.id);
    assert.equal(player.positionBlocked(Math.sign(candle.x) * 10.3, candle.z), true, `${candle.id} from the front`);
  }
  // The hall in front of the cabinets and the passages between them stay open.
  assert.equal(player.positionBlocked(9.8, 8.5), false);
  assert.equal(player.positionBlocked(10.9, -12.75), false);
});
