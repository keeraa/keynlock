import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { addRoomLighting } from '../src/room-lighting.js';

test('the salon keeps warm modelling but only short overhead contact shadows', () => {
  const scene = new THREE.Scene();
  const { sideSun, contactSun } = addRoomLighting({ THREE, scene });
  scene.updateMatrixWorld(true);
  assert.equal(sideSun.castShadow, false, 'warm angled light no longer creates wall streaks');
  const shadowLights = scene.children.filter(object => object.isLight && object.castShadow);
  assert.deepEqual(shadowLights, [contactSun]);
  const lightPosition = contactSun.getWorldPosition(new THREE.Vector3());
  const targetPosition = contactSun.target.getWorldPosition(new THREE.Vector3());
  const direction = lightPosition.clone().sub(targetPosition);
  const horizontal = Math.hypot(direction.x, direction.z);
  const maxShadowRunFromCeiling = 13.6 * horizontal / direction.y;
  assert.ok(maxShadowRunFromCeiling < .10,
    `ceiling-height shadows must fall almost straight down, got ${maxShadowRunFromCeiling.toFixed(2)} m`);
  assert.ok(contactSun.shadow.camera.top - contactSun.shadow.camera.bottom >= 40,
    'the shadow camera includes both halves of the long room');
});
