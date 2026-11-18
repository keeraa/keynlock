import test from 'node:test';
import assert from 'node:assert/strict';
import { logicalKey } from '../dist/js/controls.js';

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
