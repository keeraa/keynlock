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
