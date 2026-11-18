import test from 'node:test';
import assert from 'node:assert/strict';
import { findFloorKeyAtReticle } from '../dist/js/key-picking.js';
import { createInitialState, pickupKey } from '../dist/js/rules.js';

test('tiny star keys can be picked up by aiming at the nearby floor', () => {
  const state = createInitialState();
  const star = state.keys.find(key => key.type === 6);
  const eye = { x: star.x, y: 1.68, z: star.z + 3 };
  const forward = { x: 0, y: -1.58 / 3, z: -1 };
  assert.equal(findFloorKeyAtReticle(eye, forward, [star])?.id, star.id);
  assert.equal(pickupKey(state, star.id), true);
  assert.equal(findFloorKeyAtReticle(eye, forward, [star]), null);
});

test('floor picking skips distant, thrown and already sorted keys', () => {
  const eye = { x: 0, y: 1.68, z: 3 };
  const forward = { x: 0, y: -.53, z: -1 };
  const near = { id: 'near', x: .2, z: 0, status: 'floor' };
  const far = { id: 'far', x: 2, z: 0, status: 'floor' };
  assert.equal(findFloorKeyAtReticle(eye, forward, [far]), null);
  assert.equal(findFloorKeyAtReticle(eye, forward, [far, near])?.id, 'near');
  assert.equal(findFloorKeyAtReticle(eye, forward, [near], id => id === 'near'), null);
  assert.equal(findFloorKeyAtReticle(eye, { x: 0, y: 0, z: -1 }, [near]), null);
});
