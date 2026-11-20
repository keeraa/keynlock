import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from '../dist/vendor/three.js';
import { createCleaningEffects } from '../dist/js/cleaning-effects.js';
import { rustFlakingPaint, RUST_FLAKING_BASE } from '../dist/js/key-instance-finish.js';
import { createForgeKeyProvider } from '../dist/js/key-forge-adapter.js';

const source = JSON.parse(readFileSync(new URL('../dist/assets/key-design-profiles.json', import.meta.url), 'utf8'));

test('falling pieces land on the liquid, leave a ring and are removed', () => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera();
  const effects = createCleaningEffects(scene, camera);
  let landed = 0;
  for (const kind of ['mud', 'rust', 'wax'])
    effects.drop(kind, new THREE.Vector3(0, 1.6, 0), .01, 1.2, { onLand: p => { landed++; effects.ripple(p.x, 1.2, p.z); } });
  assert.equal(effects.active, 3);
  for (let i = 0; i < 200 && landed < 3; i++) effects.update(.02);
  assert.equal(landed, 3, 'mud, rust flake and wax bead all reach the surface');
  for (let i = 0; i < 60; i++) effects.update(.02);
  assert.equal(effects.active, 0, 'rings fade and nothing is left behind');
});

test('a cleaned key glints with stars that follow the hand and then vanish', () => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera();
  const hand = new THREE.Group();
  camera.add(hand);
  scene.add(camera);
  const model = new THREE.Mesh(new THREE.BoxGeometry(.1, .4, .02), new THREE.MeshStandardMaterial());
  hand.add(model);
  const effects = createCleaningEffects(scene, camera);
  effects.shine(model, 5, { attachTo: hand });
  assert.equal(hand.children.length, 6, 'stars ride on the hand');
  for (let i = 0; i < 80; i++) effects.update(.02);
  assert.equal(hand.children.length, 1);
  assert.equal(effects.active, 0);
});

test('rust flaking is encoded apart from rust strength and handled by the shader', () => {
  assert.ok(rustFlakingPaint(0) >= RUST_FLAKING_BASE - .5);
  assert.ok(rustFlakingPaint(1) > rustFlakingPaint(.5));
  assert.ok(rustFlakingPaint(0) > 2, 'never mistaken for a rust strength (at most 2)');
  const shader = readFileSync(new URL('../dist/js/key-materials.js', import.meta.url), 'utf8');
  assert.match(shader, /float rustErode = keyRust >= 9\.5/);
  assert.match(shader, /rustCoverage \*= smoothstep\(rustErode/);
});

test('coat API rebuilds washed or melted coats in the family model space', () => {
  const provider = createForgeKeyProvider(source.profiles ?? source);
  for (const kind of ['mud', 'wax']) {
    const layout = provider.getCoatLayout(3, false, kind);
    assert.ok(layout.length > 3);
    const full = provider.buildCoatGeometry(3, false, kind, { blobs: layout });
    const cached = provider.getCrustGeometry(3, { kind });
    assert.equal(full.getAttribute('position').count, cached.getAttribute('position').count);
    const fewer = provider.buildCoatGeometry(3, false, kind, { blobs: layout.slice(0, 2) });
    assert.ok(fewer.getAttribute('position').count < full.getAttribute('position').count);
    const metal = provider.getGeometry(3);
    metal.computeBoundingBox();
    const box = metal.boundingBox.clone().expandByScalar(.15);
    for (const blob of layout) assert.ok(box.containsPoint(provider.getCoatPoint(3, false, blob.x, blob.y, 0)));
  }
});

test('baths and candle drive the new cleaning animations', () => {
  const stations = readFileSync(new URL('../dist/js/wash-forge-stations.js', import.meta.url), 'utf8');
  const world = readFileSync(new URL('../dist/js/world.js', import.meta.url), 'utf8');
  const actions = readFileSync(new URL('../dist/js/archive-actions.js', import.meta.url), 'utf8');
  assert.match(stations, /cleaning\.clods\(slot, key/);
  assert.match(stations, /cleaning\.flakes\(slot, key/);
  assert.match(stations, /onLiftDone\?\.\(key\)/);
  assert.match(world, /function meltHeldWax\(progress, candleId\)/);
  assert.match(actions, /world\.meltHeldWax\?\.\(1 - \(melting\.until - now\) \/ WAX_MELT_MS/);
  assert.match(actions, /world\.shineHand\?\.\(\)/);
});
