import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.js';
import { createArchiveActions } from '../dist/js/archive-actions.js';
import { createKeyIndex } from '../dist/js/key-index.js';
import { createInitialState, upgradeKeyConditions, keyCondition, MAX_HELD, heldBatch } from '../dist/js/rules.js';

function setup(heldKeys) {
  const state = createInitialState();
  upgradeKeyConditions(state);
  for (const key of heldKeys(state)) { key.status = 'held'; state.held.push(key.id); }
  const placed = [], toasts = [];
  const target = { current: null };
  const actions = createArchiveActions({ state, keyIndex: createKeyIndex(state.keys), camera: new THREE.PerspectiveCamera(),
    world: { animatePlace(key, slot, options) { placed.push({ id: key.id, slot, delay: options?.delay ?? 0 }); },
      refreshCabinet() {}, cancelPlace() {}, syncKey() {}, workstations: {} },
    targetInView: () => target.current, getYaw: () => 0, isPlaying: () => true,
    save() {}, updateHud() {}, tone() {}, toast: message => toasts.push(message), showVictory() {}, invalidateHover() {} });
  return { state, actions, placed, toasts, target };
}
const clean = (state, type) => state.keys.filter(key => key.type === type && key.status === 'floor' && keyCondition(key) === 'clean');

test('four clean keys of one family in hand go into the cabinet together', () => {
  const { state, actions, placed, target } = setup(state => clean(state, 2).slice(0, MAX_HELD));
  assert.equal(state.bundles, 0, 'no ring needed');
  target.current = { kind: 'cabinet', type: 2, slot: 10 };
  actions.interact();
  assert.deepEqual(placed.map(item => item.slot), [10, 11, 12, 13], 'from the aimed cell onwards');
  assert.deepEqual(placed.map(item => item.delay > 0), [false, true, true, true], 'one after another');
  assert.equal(state.held.length, 0);
  assert.ok(placed.every(item => state.keys.find(key => key.id === item.id).status === 'sorted'));
});

test('fewer than four, or a mixed hand, still files one key at a time', () => {
  const three = setup(state => clean(state, 4).slice(0, 3));
  three.target.current = { kind: 'cabinet', type: 4, slot: 0 };
  three.actions.interact();
  assert.equal(three.placed.length, 1);
  assert.equal(three.state.held.length, 2);
  const mixed = setup(state => [...clean(state, 5).slice(0, 3), clean(state, 6)[0]]);
  assert.equal(heldBatch(mixed.state, 5), null);
  mixed.state.selected = 0;
  mixed.target.current = { kind: 'cabinet', type: 5, slot: 0 };
  mixed.actions.interact();
  assert.equal(mixed.placed.length, 1);
});

test('a batch skips occupied cells and fills the nearest free ones', () => {
  const { state, actions, placed, target } = setup(state => clean(state, 1).slice(0, MAX_HELD));
  const sorted = clean(state, 1).slice(0, 2);
  sorted[0].status = 'sorted'; sorted[0].cabinetSlot = 94;
  sorted[1].status = 'sorted'; sorted[1].cabinetSlot = 95;
  target.current = { kind: 'cabinet', type: 1, slot: 92 };
  actions.interact();
  assert.equal(placed.length, 4);
  assert.ok(placed.every(item => ![94, 95].includes(item.slot)));
  assert.deepEqual(placed.slice(0, 2).map(item => item.slot), [92, 93]);
});

test('the cabinet prompt says all four will go in', async () => {
  const { createArchivePrompts } = await import('../dist/js/archive-interaction-prompts.js');
  const { setLanguage } = await import('../dist/js/i18n.js');
  setLanguage('ru', { reload: false });
  const { state } = setup(state => clean(state, 2).slice(0, MAX_HELD));
  const promptFor = createArchivePrompts(state, createKeyIndex(state.keys), () => false, () => 0);
  assert.match(promptFor({ kind: 'cabinet', type: 2, slot: 10 }), /Положить все четыре с ячейки 11/);
});
