import test from 'node:test';
import assert from 'node:assert/strict';
import { nextHandMotionWeight } from '../dist/js/held-key-motion.js';

test('first step does not snap held key to full walking swing', () => {
  const firstFrame = nextHandMotionWeight(0, true, 1 / 60);
  assert.ok(firstFrame > 0 && firstFrame < .1);
  let walking = firstFrame;
  for (let i = 0; i < 70; i++) walking = nextHandMotionWeight(walking, true, 1 / 60);
  assert.ok(walking > .99);
  const stopped = nextHandMotionWeight(walking, false, 1 / 60);
  assert.ok(stopped < walking && stopped > .85);
});
