import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, Vector3 } from '../dist/vendor/three.js';
import { createHeldKeyClearance } from '../dist/js/held-key-clearance.js';
import { nextHandMotionWeight, samplePickupLift } from '../dist/js/held-key-motion.js';

test('first step does not snap held key to full walking swing', () => {
  const firstFrame = nextHandMotionWeight(0, true, 1 / 60);
  assert.ok(firstFrame > 0 && firstFrame < .1);
  let walking = firstFrame;
  for (let i = 0; i < 70; i++) walking = nextHandMotionWeight(walking, true, 1 / 60);
  assert.ok(walking > .99);
  const stopped = nextHandMotionWeight(walking, false, 1 / 60);
  assert.ok(stopped < walking && stopped > .85);
});

test('picked-up key rises from below and eases into its resting position', () => {
  const offsets = [0, .05, .13, .21, .26].map(samplePickupLift);
  assert.equal(offsets[0], 1);
  assert.equal(offsets.at(-1), 0);
  assert.equal(samplePickupLift(1), 0);
  assert.ok(offsets.slice(1).every((offset, index) => offset < offsets[index]));
});

test('held key retracts before walls, narrow posts and thin obstacles in its path', () => {
  const box = (min, max) => new Box3(new Vector3(...min), new Vector3(...max));
  const eye = new Vector3(0, 0, 0);
  const key = box([.3, -.6, -.95], [.55, -.3, -.7]);
  const missed = box([-.4, -.25, -.9], [-.3, -.15, -.7]);
  const wall = box([-.8, -3, -.65], [.8, 3, -.6]);
  const post = box([.15, -.28, -.48], [.16, -.20, -.42]);
  assert.equal(createHeldKeyClearance([missed])(eye, key), 1);
  assert.equal(createHeldKeyClearance([wall])(eye, key), .6 / .95);
  assert.equal(createHeldKeyClearance([wall, post])(eye, key), .42 / .95);
});
