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

test('schema 2 measures walking, waiting by the workbench, pauses and reward pacing', () => {
  let now = 0;
  const state = createInitialState();
  const stats = createArchiveStatistics(state, () => now);
  stats.setActive(true);
  for (let i = 0; i < 100; i++) stats.frame(16, { walked: .05 });          // 5 m
  for (let i = 0; i < 50; i++) stats.frame(20, { waitingAtStation: true }); // 1 s
  stats.frame(20, { waitingAtStation: false });
  now = 5000;
  stats.event('rowTimes');
  stats.setActive(false);
  now = 9000;
  stats.setActive(true);
  now = 12000;
  stats.event('cabinetTimes');
  const report = stats.snapshot();
  assert.equal(report.schemaVersion, 2);
  assert.equal(report.walkedM, 5);
  assert.equal(report.stationWaitMs, 1000);
  assert.equal(report.pausedMs, 4000);
  assert.equal(report.counts.pauses, 1);
  assert.deepEqual(report.rowTimes, [5000]);
  assert.deepEqual(report.cabinetTimes, [8000], 'active time, without the pause');
  const reloaded = createArchiveStatistics(JSON.parse(JSON.stringify(state)), () => now).snapshot();
  assert.equal(reloaded.walkedM, 5);
  assert.deepEqual(reloaded.rowTimes, [5000]);
});

test('a thrown key picked up again soon and nearby counts as a likely accidental throw', () => {
  let now = 0;
  const stats = createArchiveStatistics(createInitialState(), () => now);
  stats.setActive(true);
  stats.keyThrown('a', 0, 0);
  now = 3000;
  stats.keyPicked('a', 1, 1);       // quick and close
  stats.keyThrown('b', 0, 0);
  now = 60000;
  stats.keyPicked('b', 0, 0);       // much later
  stats.keyThrown('c', 0, 0);
  now = 61000;
  stats.keyPicked('c', 12, 0);      // soon, but far away: carried on purpose
  stats.keyPicked('d', 0, 0);       // never thrown
  const { counts } = stats.snapshot();
  assert.equal(counts.throwRepicks, 3);
  assert.equal(counts.quickRepicks, 1);
});

test('schema 1 statistics load into schema 2 with the new fields at zero', () => {
  const state = createInitialState();
  state.statistics = { activeMs: 5000, counts: { pickedUp: 7, throws: 2 }, milestones: { firstPickup: 10 } };
  const report = createArchiveStatistics(state, () => 0).snapshot();
  assert.equal(report.counts.pickedUp, 7);
  assert.equal(report.counts.wrongCabinet, 0);
  assert.equal(report.walkedM, 0);
  assert.deepEqual(report.rowTimes, []);
  state.statistics.rowTimes = [5, -1, 'x', 9];
  assert.deepEqual(createArchiveStatistics(state, () => 0).snapshot().rowTimes, [5, 9], 'bad entries dropped');
});

test('game actions report the new counters', async () => {
  const { readFileSync } = await import('node:fs');
  const actions = readFileSync(new URL('../dist/js/archive-actions.js', import.meta.url), 'utf8');
  for (const name of ['wrongCabinet', 'notReadyCabinet', 'takenFromCabinet', 'bundlesBought', 'bundlesPlaced'])
    assert.match(actions, new RegExp(`statistics\\?\\.count\\?\\.\\('${name}'\\)`), name);
  assert.match(actions, /statistics\?\.keyThrown\?\.\(key\.id/);
  assert.match(actions, /statistics\?\.keyPicked\?\.\(target\.id/);
  const main = readFileSync(new URL('../dist/js/main.js', import.meta.url), 'utf8');
  assert.match(main, /statistics\.frame\(Math\.min\(frameMs, 250\)/);
  assert.match(main, /statistics\.event\('rowTimes'\)/);
  assert.match(main, /statistics\.event\('cabinetTimes'\)/);
});
