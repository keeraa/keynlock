import test from 'node:test';
import assert from 'node:assert/strict';
import { createKeyIndex } from '../dist/js/key-index.js';
import { findFloorKeyAtReticle } from '../dist/js/key-picking.js';

test('indexed nearby lookup matches the full scan and reacts to state changes', () => {
  const keys = [{ id: 'a', status: 'floor', x: 0, z: 1 },
    { id: 'b', status: 'floor', x: 5, z: 5 },
    { id: 'c', status: 'held', x: 0, z: 1 }];
  const index = createKeyIndex(keys);
  const eye = { x: 0, y: 2, z: 2 };
  const forward = { x: 0, y: -1, z: -.5 };
  const options = { radius: .76, reach: 5.8, index };
  assert.equal(index.get('c'), keys[2]);
  assert.equal(index.nearby(0, 1, .76).length, 1);
  assert.equal(findFloorKeyAtReticle(eye, forward, keys, () => false, options),
    findFloorKeyAtReticle(eye, forward, keys));
  keys[0].status = 'held';
  keys[1].x = 0;
  keys[1].z = 1;
  index.rebuild();
  assert.deepEqual(index.nearby(0, 1, .76).map(key => key.id), ['b']);
});

test('bath membership follows game actions and timers without a frame-time rebuild', async () => {
  const { bathContents, collectSoakedKey, createInitialState, pickupKey, startSoak } =
    await import('../dist/js/rules.js');
  const state = createInitialState();
  const key = state.keys.find(key => key.mud && !key.broken);
  const index = createKeyIndex(state.keys);
  const bath = 'center-mud';
  assert.equal(index.bathKeys(bath).length, 0);
  pickupKey(state, key.id);
  assert.ok(startSoak(state, bath, 'mud', 1000));
  index.rebuild();
  const contents = index.bathKeys(bath);
  assert.deepEqual(contents, [key]);
  assert.deepEqual(index.bathContents(bath, 5999), bathContents(state, bath, 5999));
  assert.equal(index.bathContents(bath, 6000).ready[0], key);
  assert.equal(index.bathKeys(bath), contents);
  assert.equal(index.bathKeys('center-rust').length, 0);
  assert.equal(collectSoakedKey(state, bath, 6000), key);
  index.rebuild();
  assert.equal(index.bathKeys(bath).length, 0);
  assert.deepEqual(state.held, [key.id]);
});
