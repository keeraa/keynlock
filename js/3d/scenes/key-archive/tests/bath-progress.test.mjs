import test from 'node:test';
import assert from 'node:assert/strict';
import { bathReadiness } from '../dist/js/archive-bath-progress.js';

test('readiness shows an empty bath, the next key, and any ready key without changing timers', () => {
  assert.deepEqual(bathReadiness([], 'rust', 10000), { progress: 0, status: 'empty' });
  const keys = [{ bathUntil: 25000 }, { bathUntil: 31000 }];
  const snapshot = JSON.stringify(keys);
  assert.deepEqual(bathReadiness(keys, 'rust', 10000), { progress: .5, status: 'processing' });
  assert.deepEqual(bathReadiness([...keys, { bathUntil: 9000 }], 'rust', 10000),
    { progress: 1, status: 'ready' });
  assert.equal(JSON.stringify(keys), snapshot);
});
