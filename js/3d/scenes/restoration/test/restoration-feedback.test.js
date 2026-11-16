import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateColorAccuracy } from '../src/restoration-feedback.js';

test('color score stays consistent after moving scoring into a module', () => {
  const art = { hue: 14, saturation: 1.2, brightness: .8 };
  assert.equal(calculateColorAccuracy(art, { hue: -14, saturation: 100 / 1.2, brightness: 125 }), 100);
  assert.ok(calculateColorAccuracy(art, { hue: 0, saturation: 100, brightness: 100 }) < 100);
  assert.equal(calculateColorAccuracy(art, { hue: 60, saturation: 165, brightness: 165 }), 0);
});
