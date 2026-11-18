import { test } from 'node:test';
import assert from 'node:assert/strict';
import { edgeLookRate } from '../dist/js/mouse-look.js';

test('fallback mouse-look keeps turning at the screen edges', () => {
  assert.equal(edgeLookRate(0, 1200), -1);
  assert.equal(edgeLookRate(1200, 1200), 1);
  assert.equal(edgeLookRate(600, 1200), 0);
  assert.equal(edgeLookRate(28, 1200), -.5);
  assert.equal(edgeLookRate(1172, 1200), .5);
});

test('fallback edge look handles narrow windows and bad values', () => {
  assert.equal(edgeLookRate(10, 80), -.5);
  assert.equal(edgeLookRate(70, 80), .5);
  assert.equal(edgeLookRate(10, 0), 0);
  assert.equal(edgeLookRate(NaN, 1200), 0);
});
