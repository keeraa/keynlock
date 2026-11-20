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
  assert.match(stations, /onLiftDone\?\.\(key, from\)/);
  assert.match(world, /function startHandFlight\(key, from\)/, 'a bath key flies into the hand');
  assert.match(world, /status !== 'floor'\) \{\s*keyHoverOpacity = 0;/, 'a picked-up key loses its outline at once');
  assert.match(world, /function meltHeldWax\(progress, candleId/);
  assert.match(world, /function placeHeldKey\(elapsed\)/, 'the key leaves the hand for the flame');
  assert.match(actions, /world\.meltHeldWax\?\.\(0, null, \{ restoreCoat: false \}\)/);
  assert.match(world, /child\.userData\.coatKind === 'wax'/, 'held wax is found even with copied materials');
  assert.match(actions, /world\.meltHeldWax\?\.\(1 - \(melting\.until - now\) \/ WAX_MELT_MS/);
  assert.match(actions, /world\.shineHand\?\.\(\)/);
});

test('coat meshes are tagged so a held key with copied materials still finds its wax', () => {
  const provider = createForgeKeyProvider(source.profiles ?? source);
  const model = provider.createModel(2, { id: 'k', wax: true, mud: true });
  const kinds = model.children.map(child => child.userData.coatKind).filter(Boolean).sort();
  assert.deepEqual(kinds, ['mud', 'wax']);
  // Simulate the held-key light swapping materials for copies.
  model.traverse(object => { if (object.isMesh) object.material = object.material.clone(); });
  assert.ok(model.children.find(child => child.userData.coatKind === 'wax'));
});

test('wax melts where the flame is, and the flame gutters meanwhile', async () => {
  const world = readFileSync(new URL('../dist/js/world.js', import.meta.url), 'utf8');
  assert.match(world, /melt\.heat\[index\] = Math\.min\(1, melt\.heat\[index\] \+ rate \* dt\)/);
  assert.match(world, /candle\?\.disturb\?\.\(meltPose\.candleId \? meltPose\.blend : 0\)/);
  const { createArchiveCandles } = await import('../dist/js/archive-candles.js');
  const scene = new THREE.Scene();
  const { candles } = createArchiveCandles(scene);
  assert.equal(typeof candles[0].disturb, 'function');
  candles[0].disturb(1);
  candles[0].update(true, 1000);
});

test('rust tray: smoke rises and fades; bath keys aim along their length; bench hides floor keys', () => {
  const scene = new THREE.Scene();
  const effects = createCleaningEffects(scene, new THREE.PerspectiveCamera());
  effects.smoke(new THREE.Vector3(0, 1, 0));
  assert.equal(effects.active, 1);
  for (let i = 0; i < 200; i++) effects.update(.02);
  assert.equal(effects.active, 0);
  const stations = readFileSync(new URL('../dist/js/wash-forge-stations.js', import.meta.url), 'utf8');
  const aim = readFileSync(new URL('../dist/js/archive-surface-aim.js', import.meta.url), 'utf8');
  assert.match(stations, /function trayKey\(bath, slot, key, index, wallTime\)/);
  assert.match(stations, /ray\.intersectsBox\(keyBox\)/);
  assert.match(stations, /occluders\.push\(block\(group, \[4\.92/);
  assert.match(aim, /if \(hiddenBehindFurniture\(hit\.point\)\) continue;/);
  assert.match(aim, /const assisted = visibleKey\(/);
});

test('row chime starts with the shimmer; rust splash sounds when the key lands', async () => {
  const { createCabinetCompletion } = await import('../dist/js/cabinet-completion.js');
  const { CABINET_COLUMNS } = await import('../dist/js/cabinet-layout.js');
  const completion = createCabinetCompletion();
  completion.refresh([], 0);
  assert.equal(completion.rowsStarted(), 0);
  const row = Array.from({ length: CABINET_COLUMNS * 2 }, (_, slot) => ({ cabinetSlot: slot }));
  completion.refresh(row, 100);
  assert.equal(completion.rowsStarted(), 1, 'counted the moment the row fills');
  const main = readFileSync(new URL('../dist/js/main.js', import.meta.url), 'utf8');
  assert.match(main, /if \(started > startedRows\[cabinet\.type\]\) playAt\('row'/);
  assert.doesNotMatch(main, /else if \(started >/, 'the final row chimes as well as the cabinet');
  const stations = readFileSync(new URL('../dist/js/wash-forge-stations.js', import.meta.url), 'utf8');
  assert.match(stations, /playSound\?\.\('rust', slotWorld\.clone\(\)\)/);
  const actions = readFileSync(new URL('../dist/js/archive-actions.js', import.meta.url), 'utf8');
  assert.doesNotMatch(actions, /tone\('rust'\)/, 'no early splash at the moment of the action');
});

test('the rust bath hisses from the real recording and fades out gradually', () => {
  const audio = readFileSync(new URL('../dist/js/archive-audio.js', import.meta.url), 'utf8');
  assert.match(audio, /function fizz\(level = 1\)/);
  assert.match(audio, /const sizzle = recordings\.waxStart\[0\]/);
  assert.match(audio, /volume\.gain\.setTargetAtTime\(0, now \+ layer\.attack \+ \.4, layer\.decay \/ 4\)/);
  assert.match(audio, /if \(kind === 'rust' && .*fizz\(level\)\) return;/);
});
