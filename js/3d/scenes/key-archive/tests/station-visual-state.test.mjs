import test from 'node:test';
import assert from 'node:assert/strict';
import { bathVisualState, meltVisualIntensity } from '../dist/js/station-visual-state.js';
import * as THREE from '../dist/vendor/three.js';
import { createBathEffects, createForgeEffects } from '../dist/js/station-visual-effects.js';

test('bath visual progress follows stored timers without modifying game keys', () => {
  const now = 20_000;
  const key = { id: 'a', bathUntil: now + 2500, mud: true };
  const before = JSON.stringify(key);
  const mid = bathVisualState([key], 'mud', now);
  assert.equal(mid.active, 1);
  assert.equal(mid.progress, .5);
  assert.ok(mid.pigment > 0);
  assert.deepEqual(bathVisualState([key], 'mud', now + 2500),
    { active: 0, progress: 1, pigment: 0 });
  assert.equal(JSON.stringify(key), before);
  assert.deepEqual(bathVisualState([], 'rust', now), { active: 0, progress: 0, pigment: 0 });
});

test('forge flash starts at the key impact, decays and fully expires', () => {
  assert.equal(meltVisualIntensity(100, 200), 0);
  assert.ok(meltVisualIntensity(400, 200) > meltVisualIntensity(1200, 200));
  assert.equal(meltVisualIntensity(1700, 200), 0);
});

test('pooled bath and forge graphics activate only for their processing windows', () => {
  const group = new THREE.Group();
  const spot = new THREE.Texture();
  const bath = createBathEffects(group, -1.48, 'mud', spot);
  const bathMeshes = [...group.children];
  bath.update(100, [], 20_000);
  assert.ok(bathMeshes.every(mesh => !mesh.visible));
  bath.update(300, [{ bathUntil: 22_500 }], 20_000);
  assert.ok(bathMeshes.some(mesh => mesh.visible));
  bath.update(2300, [{ bathUntil: 22_500 }], 23_000);
  assert.ok(bathMeshes.every(mesh => !mesh.visible));
  const metal = { opacity: .8 };
  const forge = createForgeEffects(group, 0, spot, metal);
  const flareMeshes = group.children.slice(bathMeshes.length);
  forge.ignite(1000);
  forge.update(1200);
  assert.ok(flareMeshes.every(mesh => !mesh.visible));
  forge.update(1600);
  assert.ok(flareMeshes.some(mesh => mesh.visible));
  assert.ok(metal.opacity > .8);
  forge.update(4000);
  assert.ok(flareMeshes.every(mesh => !mesh.visible));
});
