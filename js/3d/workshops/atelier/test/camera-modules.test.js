import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createCameraFraming } from '../src/navigation/camera-framing.js';
import { createCameraTransition } from '../../../core/navigation/camera-transition.js';

test('gallery framing stays close and clamps both edges on a portrait viewport', () => {
  const camera = new THREE.PerspectiveCamera(44, .8, .1, 65);
  const controls = { target: new THREE.Vector3(0, 1.91, 0), minPolarAngle: 1.23,
    maxPolarAngle: 1.67, update() {} };
  const bounds = { minX: -15, maxX: 15, minY: 3.695, maxY: 11.85, width: 30, columnWidth: 2.5 };
  const framing = createCameraFraming({ THREE, camera, controls, easelX: 1.28,
    getPaintingCenterY: () => 1.91, getWallBounds: () => bounds });
  const distance = framing.galleryDistance();
  assert.ok(distance < 13, 'portrait screens do not zoom into the empty room');
  const visibleWidth = framing.galleryVisibleWidth(distance);
  const overview = framing.galleryOverview();
  assert.ok(overview.target.x - visibleWidth / 2 >= -15 - 1e-6);
  assert.ok(overview.target.x + visibleWidth / 2 < -5);
  assert.ok(framing.clampGalleryX(-100) > -15);
  assert.ok(framing.clampGalleryX(100) < 15);

  let pose = overview;
  for (let i = 0; i < 12; i++) pose = framing.galleryStep(1, pose);
  assert.ok(pose.target.x + visibleWidth / 2 <= 15 + 1e-6,
    'moving across every exhibition column never reveals an empty margin');
  camera.position.copy(pose.position);
  controls.target.copy(pose.target);
  camera.position.x += 100;
  controls.target.x += 100;
  assert.equal(framing.clampGalleryPose(), true);
  assert.ok(controls.target.x + visibleWidth / 2 <= 15 + 1e-6);
});

test('one flight controller accepts interruptions without camera jumps', () => {
  const camera = new THREE.PerspectiveCamera(39, 1, .1, 65);
  camera.position.set(0, 2.31, 8);
  const controls = { target: new THREE.Vector3(0, 1.91, 0), enabled: true,
    enableDamping: true, update() { camera.lookAt(this.target); } };
  const flight = createCameraTransition({ camera, controls });
  const origin = camera.position.clone();
  const start = performance.now();
  flight.start({ position: new THREE.Vector3(0, 8, 10), target: new THREE.Vector3(0, 8, -4) }, 1000);
  assert.ok(camera.position.distanceTo(origin) < 1e-6);
  flight.update(start + 500);
  const interruptedPose = camera.position.clone();
  flight.start({ position: new THREE.Vector3(2, 2.1, 5), target: new THREE.Vector3(2, 2, 0) }, 300);
  assert.ok(camera.position.distanceTo(interruptedPose) < 1e-6);
  flight.update(performance.now() + 400);
  assert.equal(flight.isTraveling(), false);
  assert.equal(controls.enabled, true);
  assert.ok(camera.position.distanceTo(new THREE.Vector3(2, 2.1, 5)) < 1e-6);
  flight.cancel();
  assert.equal(controls.enabled, true);
});
