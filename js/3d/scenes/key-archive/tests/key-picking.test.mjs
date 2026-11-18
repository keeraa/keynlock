import test from 'node:test';
import assert from 'node:assert/strict';
import { findFloorKeyAtReticle } from '../dist/js/key-picking.js';
import { createInitialState, pickupKey } from '../dist/js/rules.js';

test('tiny star keys can be picked up by aiming at the nearby floor', () => {
  const state = createInitialState();
  const star = state.keys.find(key => key.type === 6);
  const eye = { x: star.x, y: 1.68, z: star.z + 1.3 };
  const forward = { x: 0, y: -1.68 / 1.3, z: -1 };
  assert.equal(findFloorKeyAtReticle(eye, forward, [star])?.id, star.id);
  assert.equal(pickupKey(state, star.id), true);
  assert.equal(findFloorKeyAtReticle(eye, forward, [star]), null);
});

test('floor picking skips distant, thrown and already sorted keys', () => {
  const eye = { x: 0, y: 1.68, z: 1.4 };
  const forward = { x: 0, y: -1.68 / 1.4, z: -1 };
  const near = { id: 'near', x: .12, z: 0, status: 'floor' };
  const far = { id: 'far', x: 2, z: 0, status: 'floor' };
  assert.equal(findFloorKeyAtReticle(eye, forward, [far]), null);
  assert.equal(findFloorKeyAtReticle(eye, forward, [far, near])?.id, 'near');
  assert.equal(findFloorKeyAtReticle(eye, forward, [near], id => id === 'near'), null);
  assert.equal(findFloorKeyAtReticle(eye, { x: 0, y: 0, z: -1 }, [near]), null);
});

test('reticle selects any visible part of a rotated floor key', () => {
  const eye = { x: 0, y: 1.68, z: 1.2 };
  const directionTo = (x, z) => ({ x, y: -1.68, z: z - eye.z });
  const key = { id: 'long', x: 0, z: 0, rotation: 0, status: 'floor' };
  assert.equal(findFloorKeyAtReticle(eye, directionTo(0, -.29), [key])?.id, 'long');
  assert.equal(findFloorKeyAtReticle(eye, directionTo(0, .29), [key])?.id, 'long');
  assert.equal(findFloorKeyAtReticle(eye, directionTo(.29, 0), [key]), null);
  key.rotation = Math.PI / 2;
  assert.equal(findFloorKeyAtReticle(eye, directionTo(.29, 0), [key])?.id, 'long');
});

test('floor picking has a firm half-distance reach and a narrow sideways margin', () => {
  const eye = { x: 0, y: 1.68, z: 1.4 };
  const forward = { x: 0, y: -1.68 / 1.4, z: -1 };
  const key = { id: 'edge', x: .28, z: 0, status: 'floor' };
  assert.equal(findFloorKeyAtReticle(eye, forward, [key]), null);
  assert.equal(findFloorKeyAtReticle(eye, forward, [key], () => false, { radius: .34 })?.id, 'edge');
  const farEye = { x: 0, y: 1.68, z: 3 };
  assert.equal(findFloorKeyAtReticle(farEye, { x: 0, y: -.56, z: -1 },
    [{ id: 'far', x: 0, z: 0, rotation: 0, status: 'floor' }]), null);
});
