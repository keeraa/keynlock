import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createCombinedKeyGeometry, createKeyModel, getKeyColliderSize,
  getKeyDisplayScale, getKeyMetal, getKeyProviderName,
} from '../dist/js/key-factory.js';

test('legacy key provider preserves archive asset conventions', () => {
  assert.equal(getKeyProviderName(), 'archive-legacy');
  assert.deepEqual(getKeyColliderSize(0), [.43, .21, .65]);
  assert.equal(getKeyDisplayScale('floor', 0), .455);
  assert.equal(getKeyDisplayScale('hand', 0), .52);
  assert.equal(getKeyDisplayScale('cabinet', 0), .185);
  assert.equal(getKeyDisplayScale('bath', 0), .22);
  assert.equal(typeof getKeyMetal(0), 'string');
  assert.ok(createCombinedKeyGeometry(0).isBufferGeometry);
  assert.ok(createKeyModel(0, { scale: .52 }).isObject3D);
});
