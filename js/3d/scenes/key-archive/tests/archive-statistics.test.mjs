import assert from 'node:assert/strict';
import test from 'node:test';
import { createArchiveStatistics } from '../dist/js/archive-statistics.js';
import { createInitialState, TOTAL_KEYS } from '../dist/js/rules.js';

test('statistics persist active time and actions across pause and reload', () => {
  let now = 100;
  const state = createInitialState();
  const stats = createArchiveStatistics(state, () => now);
  stats.setActive(true);
  now += 21000;
  assert.equal(stats.shouldCheckpoint(), true);
  stats.record('throw', { throws: 1 });
  stats.setActive(false);
  now += 50000;
  const resumed = createArchiveStatistics(JSON.parse(JSON.stringify(state)), () => now);
  assert.equal(resumed.snapshot().activeMs, 21000);
  assert.equal(resumed.snapshot().counts.throws, 1);
  assert.equal(resumed.snapshot().stage, 'throw');
});

test('final completion time is measured once and existing progress is carried forward', () => {
  const state = createInitialState();
  state.keys[0].status = 'sorted';
  let now = 100;
  const stats = createArchiveStatistics(state, () => now);
  stats.setActive(true);
  now += 125000;
  for (const key of state.keys) key.status = key.broken ? 'trashed' : 'sorted';
  stats.record('forge');
  now += 35000;
  stats.record('throw', { throws: 1 });
  const report = stats.snapshot();
  assert.equal(report.trackedFromProcessed, 1);
  assert.equal(report.lastProgress.processed, TOTAL_KEYS);
  assert.equal(report.completionMs, 125000);
  assert.equal(report.activeMs, 160000);
  assert.equal(report.stage, 'complete');
});
