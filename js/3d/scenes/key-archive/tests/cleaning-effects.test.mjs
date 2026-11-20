import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from '../dist/vendor/three.js';
import { createCleaningEffects } from '../dist/js/cleaning-effects.js';
import { rustFlakingPaint, RUST_FLAKING_BASE } from '../dist/js/key-instance-finish.js';
import { createForgeKeyProvider } from '../dist/js/key-forge-adapter.js';
import { worldSource } from './helpers/world-source.mjs';

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
  const world = worldSource();
  const pose = readFileSync(new URL('../dist/js/held-key-pose.js', import.meta.url), 'utf8');
  const wax = readFileSync(new URL('../dist/js/held-wax-melt.js', import.meta.url), 'utf8');
  const actions = readFileSync(new URL('../dist/js/archive-actions.js', import.meta.url), 'utf8');
  assert.match(stations, /cleaning\.clods\(slot, key/);
  assert.match(stations, /cleaning\.flakes\(slot, key/);
  assert.match(stations, /onLiftDone\?\.\(key, from\)/);
  assert.match(world, /heldKey\.startHandFlight\(key, from\)/, 'a bath key flies into the hand');
  assert.match(pose, /function startHandFlight\(key, from\)/);
  assert.match(world, /status !== 'floor'\) \{\s*keyHoverOpacity = 0;/, 'a picked-up key loses its outline at once');
  assert.match(world, /function meltHeldWax\(progress, candleId/);
  assert.match(world, /heldPose\.place\(handModel, displayedHandId, elapsed\)/, 'the key leaves the hand for the flame');
  assert.match(actions, /world\.meltHeldWax\?\.\(0, null, \{ restoreCoat: false \}\)/);
  assert.match(wax, /child\.userData\.coatKind === 'wax'/, 'held wax is found even with copied materials');
  assert.match(actions, /world\.meltHeldWax\?\.\(1 - \(melting\.until - now\) \/ WAX_MELT_MS/);
  assert.match(actions, /world\.shineHand\(key\.id\)/);
  assert.match(world, /cleaningEffects\.shine\(handModel, 5, \{ attachTo: hand \}\);\s*playSound\?\.\('keyShine', camera\.position\)/);
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
  const wax = readFileSync(new URL('../dist/js/held-wax-melt.js', import.meta.url), 'utf8');
  assert.match(wax, /melt\.heat\[index\] = Math\.min\(1, melt\.heat\[index\] \+ rate \* dt\)/);
  const pose = readFileSync(new URL('../dist/js/held-key-pose.js', import.meta.url), 'utf8');
  assert.match(pose, /candle\?\.disturb\?\.\(meltPose\.candleId \? meltPose\.blend : 0\)/);
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
  // One slab (no separate board on top) that still hides floor keys under it.
  assert.match(stations, /occluders\.push\(top\)/);
  assert.doesNotMatch(stations, /apron/);
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

test('the held key flies into the hand, lies over the candle, and the flame calms after', async () => {
  const { createHeldKeyPose } = await import('../dist/js/held-key-pose.js');
  let now = 0;
  const camera = new THREE.PerspectiveCamera();
  const hand = new THREE.Group();
  camera.add(hand);
  const disturbed = [];
  const candles = [{ id: 'c1', x: 1, y: 0, z: -2, disturb: level => disturbed.push(level) }];
  const pose = createHeldKeyPose({ hand, camera, candles, sceneNow: () => now });
  const model = new THREE.Object3D();
  assert.ok(pose.resting);
  pose.startHandFlight({ id: 'k' }, new THREE.Matrix4().makeTranslation(0, -1, -1));
  pose.place(model, 'k', .016);
  assert.ok(pose.flying && !pose.resting);
  assert.ok(model.position.length() > .5, 'starts where the bath lifted it');
  now = 500;
  pose.place(model, 'k', .016);
  assert.ok(!pose.flying);
  pose.holdOverCandle('c1');
  for (let i = 0; i < 60; i++) pose.place(model, 'k', .05);
  assert.ok(disturbed.at(-1) > .9, 'the flame gutters under the melting wax');
  assert.ok(model.position.length() > 1, 'the key has left the hand for the flame');
  pose.holdOverCandle(null);
  for (let i = 0; i < 60; i++) pose.place(model, 'k', .05);
  assert.ok(pose.resting);
  assert.equal(model.position.length(), 0);
  pose.release();
  assert.equal(disturbed.at(-1), 0);
});

test('the workbench is one narrow slab that still holds the widest bowl', async () => {
  const { BENCH, RUST_TRAY } = await import('../dist/js/wash-forge-stations.js');
  const { FORGE_SURFACE_Y } = await import('../dist/js/station-layout.js');
  assert.ok(BENCH.depth <= 1.3, 'narrower than the old 1.48 m top');
  const waterBowl = .57, forge = .55;
  assert.ok(BENCH.depth >= 2 * waterBowl, 'the water bowl stands on the wood');
  assert.ok(BENCH.depth >= 2 * forge && BENCH.depth >= RUST_TRAY.depth);
  // Legs and rails stay under the slab.
  for (const offset of [...BENCH.legs, ...BENCH.rails]) assert.ok(Math.abs(offset) + .08 < BENCH.depth / 2);
  assert.ok(Math.abs(BENCH.surfaceY - .9275) < 1e-9, 'vessels keep standing where they did');
  assert.ok(FORGE_SURFACE_Y > BENCH.surfaceY);
});
