import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from '../dist/vendor/three.js';
import { createArchiveActions } from '../dist/js/archive-actions.js';
import { createKeyIndex } from '../dist/js/key-index.js';
import { BUNDLE_COST, MAX_HELD, createInitialState, upgradeKeyConditions } from '../dist/js/rules.js';
import { createCleaningEffects } from '../dist/js/cleaning-effects.js';

const source = file => readFileSync(new URL(`../dist/js/${file}`, import.meta.url), 'utf8');

function rustBathWith(readyCount, { aimedIndex = 0, held = 0 } = {}) {
  const state = createInitialState();
  upgradeKeyConditions(state);
  const rusty = state.keys.filter(key => key.rust && !key.mud && !key.broken && !key.wax).slice(0, readyCount);
  rusty.forEach((key, slot) => Object.assign(key, { status: 'bath', bathId: 'center-rust', bathSlot: slot, bathUntil: 1000 }));
  const clean = state.keys.filter(key => key.status === 'floor' && !key.mud && !key.rust && !key.broken && !key.wax);
  for (const key of clean.slice(0, held)) { key.status = 'held'; state.held.push(key.id); }
  const lifted = [], toasts = [];
  const actions = createArchiveActions({
    state, keyIndex: createKeyIndex(state.keys), camera: new THREE.PerspectiveCamera(),
    world: { workstations: { liftKey: (id, key) => lifted.push(key.id), isLifting: () => false }, syncKey() {} },
    targetInView: () => ({ kind: 'bath', id: 'center-rust', bathKind: 'rust', keyId: rusty[aimedIndex]?.id }),
    getYaw: () => 0, isPlaying: () => true, stationNow: () => 5000,
    save() {}, updateHud() {}, tone() {}, toast: message => toasts.push(message), showVictory() {}, invalidateHover() {},
  });
  return { state, rusty, actions, lifted, toasts };
}

test('one press takes every ready key from the rust tray; the aimed one rises last', () => {
  const { state, rusty, actions, lifted } = rustBathWith(3, { aimedIndex: 1 });
  actions.interact();
  assert.equal(state.held.length, 3);
  assert.ok(rusty.every(key => key.status === 'held' && !key.rust));
  assert.deepEqual(lifted, [rusty[1].id], 'a single lift animation, for the aimed key');
  assert.equal(state.held.at(-1), rusty[1].id, 'the aimed key is the one in hand');
});

test('taking from the tray stops when the hands are full', () => {
  const { state, rusty, actions } = rustBathWith(4, { held: MAX_HELD - 2 });
  actions.interact();
  assert.equal(state.held.length, MAX_HELD);
  assert.equal(rusty.filter(key => key.status === 'bath').length, 2);
});

test('the rust tray lift is short', () => {
  const [, ms] = source('wash-forge-stations.js').match(/TRAY_LIFT_MS = (\d+)/);
  assert.ok(Number(ms) <= 1500, `tray lift ${ms} ms`);
});

test('the ring costs 25 metal; rings bought for 15 under the old price are kept', () => {
  assert.equal(BUNDLE_COST, 25);
  const state = createInitialState();
  state.keys.filter(key => key.broken).slice(0, 17).forEach(key => { key.status = 'trashed'; });
  state.metal = 2;
  upgradeKeyConditions(state);
  assert.equal(state.bundles, 1);
});

test('edge turning only runs where the browser never grants pointer lock', () => {
  const main = source('main.js');
  assert.match(main, /if \(!lockUnavailable\) \{ edgeLook\.until = 0; return; \}/);
  assert.match(main, /const EDGE_LOOK_HOLD_MS = 300;/);
  assert.match(main, /'mouseleave', \(\) => \{ lastPointer = null; edgeLook\.until = 0; \}/);
});

test('an unlit shelf candle tells the player when it will burn', async () => {
  const prompts = source('archive-interaction-prompts.js');
  assert.match(prompts, /if \(!target\.lit\) return t\('prompt\.candleUnlit'\)/);
  const { default: ru } = await import('../dist/js/locales/ru.js');
  assert.ok(ru['prompt.candleUnlit']);
});

test('the catalog shows each cabinet\'s fill and lights up finished ones', async () => {
  const catalog = source('archive-key-catalog.js');
  assert.match(catalog, /article\.classList\.toggle\('is-complete', complete\)/);
  assert.match(catalog, /t\('catalog\.count', \{ sorted, required \}\)/);
  const css = readFileSync(new URL('../dist/styles.css', import.meta.url), 'utf8');
  assert.match(css, /\.ledger-spread article\.is-complete\{/);
});

test('a finished cabinet gets a fanfare and stars; the finale opens the forgotten door', () => {
  const main = source('main.js');
  assert.match(main, /tone\('fanfare'\);\s*world\.celebrateCabinet\?\.\(cabinet\.type\);/);
  assert.match(main, /showVictory: celebrateCompletion/);
  assert.match(main, /world\.startFinale\?\.\(\);\s*tone\('finale'\);/);
  const audio = source('archive-audio.js');
  assert.match(audio, /fanfare: \[/);
  assert.match(audio, /finale: \[/);
  const effects = createCleaningEffects(new THREE.Scene(), new THREE.PerspectiveCamera());
  const cabinet = new THREE.Mesh(new THREE.BoxGeometry(4, 6, 1));
  effects.shine(cabinet, 3, { size: .34 });
  assert.equal(effects.active, 3);
});

// makeHall paints labels and loads textures: a minimal stand-in for the DOM.
function stubDocument() {
  const gradient = { addColorStop() {} };
  const context = new Proxy({}, {
    get: (target, name) => name in target ? target[name]
      : name === 'measureText' ? () => ({ width: 10 })
      : name === 'getImageData' || name === 'createImageData' ? (x, y, w, h) => ({ data: new Uint8ClampedArray((w ?? x) * (h ?? y) * 4) })
      : () => gradient,
    set: (target, name, value) => { target[name] = value; return true; },
  });
  const element = () => ({ width: 0, height: 0, style: {}, getContext: () => context,
    addEventListener() {}, removeEventListener() {}, setAttribute() {} });
  globalThis.document ??= { createElement: element, createElementNS: element };
}

test('the forgotten door swings open and its glow appears only when opened', async () => {
  stubDocument();
  const { makeHall } = await import('../dist/js/world-architecture.js');
  // Any material will do: only the door's structure is under test.
  const material = new THREE.MeshStandardMaterial();
  const shadow = { width: 1, depth: 1, material };
  const mat = new Proxy({}, { get: (_, name) => name === 'furnitureShadows'
    ? new Proxy({}, { get: () => shadow }) : material });
  const scene = new THREE.Group();
  const { forgottenDoor } = makeHall(scene, mat);
  const glow = [];
  scene.traverse(object => { if (object.userData.forgottenDoorGlow) glow.push(object); });
  const leaves = [];
  scene.traverse(object => { if (object.userData.forgottenDoorLeaf) leaves.push(object); });
  assert.equal(glow.length, 1);
  assert.ok(leaves.length >= 9, 'leaf parts are tagged, so static batching skips them');
  const leafRoot = leaves[0].parent.parent;
  assert.equal(glow[0].visible, false);
  forgottenDoor.setOpen(1);
  assert.ok(Math.abs(leafRoot.rotation.y + 1.25) < 1e-9, 'swung towards the hall');
  assert.equal(glow[0].visible, true);
  forgottenDoor.setOpen(0);
  assert.equal(Math.abs(leafRoot.rotation.y), 0);
  assert.equal(glow[0].visible, false, "closed again");
});
