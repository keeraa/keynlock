import test from 'node:test';
import assert from 'node:assert/strict';
import { createInventoryWheel, logicalKey } from '../dist/js/controls.js';

test('WASD and interaction commands work in the Russian keyboard layout', () => {
  const keys = [
    ['KeyW', 'ц', 'w'], ['KeyA', 'ф', 'a'], ['KeyS', 'ы', 's'],
    ['KeyD', 'в', 'd'], ['KeyE', 'у', 'e'], ['KeyR', 'к', 'r'],
    ['KeyM', 'ь', 'm'], ['KeyH', 'р', 'h'],
  ];
  for (const [code, key, expected] of keys) {
    assert.equal(logicalKey({ code, key }), expected);
    assert.equal(logicalKey({ code: 'Unidentified', key }), expected);
  }
  assert.equal(logicalKey({ code: 'Space', key: ' ' }), ' ');
  assert.equal(logicalKey({ code: 'Digit3', key: '3' }), '3');
});

test('inventory wheel filters small and horizontal gestures and limits rapid switching', () => {
  const step = createInventoryWheel();
  const wheel = (deltaY, at, deltaX = 0, deltaMode = 0) => step({ deltaX, deltaY, deltaMode }, at);
  assert.equal(wheel(20, 0), 0);
  assert.equal(wheel(40, 5, 90), 0);
  assert.equal(wheel(15, 10), 1);
  assert.equal(wheel(120, 30), 0);
  assert.equal(wheel(-120, 50), 0);
  assert.equal(wheel(-3, 200, 0, 1), -1);
  assert.equal(wheel(25, 400), 0);
  assert.equal(wheel(20, 650), 0);
  assert.equal(wheel(-20, 660), 0);
  assert.equal(wheel(-16, 670), -1);
});
