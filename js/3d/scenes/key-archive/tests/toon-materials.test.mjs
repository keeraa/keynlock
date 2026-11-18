import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from '../dist/vendor/three.js';
import { createToonMaterials, makeToonRamp } from '../dist/js/toon-materials.js';
import { normalizeVisualSettings } from '../dist/js/visual-settings.js';

test('toon ramp makes distinct painterly light bands and responds to the step slider', () => {
  const four = makeToonRamp(4, 1);
  const eight = makeToonRamp(8, 1);
  assert.equal(four.length, 256 * 4);
  assert.equal(new Set(Array.from({ length: 256 }, (_, i) => four[i * 4])).size, 4);
  assert.equal(new Set(Array.from({ length: 256 }, (_, i) => eight[i * 4])).size, 8);
  assert.notDeepEqual(four, makeToonRamp(4, .2));
});

test('toon toggle changes the actual Three.js materials and restores the originals', () => {
  const scene = new THREE.Scene();
  const texture = new THREE.Texture();
  const steel = new THREE.MeshStandardMaterial({ color: 0xaabbcc, map: texture });
  const glass = new THREE.MeshBasicMaterial({ transparent: true, opacity: .5 });
  const key = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), steel);
  const window = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glass);
  scene.add(key, window);
  const renderer = { toneMappingExposure: 1.76 };
  const controller = createToonMaterials(scene, renderer);
  const on = normalizeVisualSettings({ toonEnabled: true, toonSteps: 4 });
  controller.setSettings(on);
  assert.ok(key.material.isMeshToonMaterial);
  assert.equal(key.material.map, texture);
  assert.equal(window.material, glass);
  assert.ok(renderer.toneMappingExposure < 1.76);
  const gradient = key.material.gradientMap;
  const before = gradient.image.data.slice();
  controller.setSettings({ ...on, toonSteps: 7, toonLight: 100 });
  assert.equal(key.material.gradientMap, gradient);
  assert.notDeepEqual(gradient.image.data, before);

  const newKey = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), steel);
  scene.add(newKey);
  controller.register(newKey);
  assert.ok(newKey.material.isMeshToonMaterial);
  controller.unregister(newKey);
  assert.equal(newKey.material, steel);

  controller.setSettings({ ...on, toonEnabled: false });
  assert.equal(key.material, steel);
  assert.equal(window.material, glass);
  assert.equal(renderer.toneMappingExposure, 1.76);
  controller.setSettings(on);
  assert.ok(key.material.isMeshToonMaterial);
  controller.dispose();
  assert.equal(key.material, steel);
});
