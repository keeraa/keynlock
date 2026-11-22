import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createCameraFraming } from '../../../workshops/atelier/src/navigation/camera-framing.js';

test('in-room easel close-ups use the original framing with the easel depth offset', () => {
  const camera = new THREE.PerspectiveCamera(39, 16 / 9, .1, 65);
  camera.position.set(0, 2.27, 4.4);
  const controls = { target: new THREE.Vector3(0, 1.87, -3.25),
    minPolarAngle: 1.23, maxPolarAngle: 1.67 };
  const framing = createCameraFraming({ THREE, camera, controls, easelX: 1.28,
    getPaintingCenterY: () => 1.91, getWallBounds: () => ({ width: 30, minY: 3, maxY: 12 }),
    easelOffsetZ: -3.25 });
  const original = framing.easelFocus('original');
  const atelier = framing.easelFocus('copy');
  assert.equal(original.target.x, -1.28);
  assert.equal(atelier.target.x, 1.28);
  assert.ok(Math.abs(original.target.z + 2.86) < 1e-9);
  assert.ok(Math.abs(atelier.position.z - 1.18) < 1e-9);
  const overview = framing.easelOverview();
  assert.equal(overview.target.z, -3.25);
  assert.ok(overview.position.z > atelier.position.z);
});

