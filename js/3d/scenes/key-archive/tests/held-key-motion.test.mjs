import test from 'node:test';
import assert from 'node:assert/strict';
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
