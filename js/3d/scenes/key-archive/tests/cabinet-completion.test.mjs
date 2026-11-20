import test from 'node:test';
import assert from 'node:assert/strict';
import { createCabinetCompletion, sampleCabinetCelebration } from '../dist/js/cabinet-completion.js';
const keys = count => Array.from({ length: count }, (_, cabinetSlot) => ({ cabinetSlot }));

test('loading completed rows and cabinets does not replay their celebrations', () => {
  const tracker = createCabinetCompletion();
  tracker.refresh(keys(96), 1000);
  const frame = tracker.frame(1100);
  assert.deepEqual(frame.rows, []);
  assert.equal(frame.cabinet, null);
  assert.equal(frame.complete, true);
  assert.ok(frame.crownGlow > 0);
  assert.equal(tracker.settledRows(), 0xff);
});

test('the last visible key starts one sweep and repeated refreshes do not restart it', () => {
  const tracker = createCabinetCompletion();
  tracker.refresh(keys(11), 0);
  tracker.refresh(keys(12), 1000);
  tracker.refresh(keys(12), 1300);
  const frame = tracker.frame(1400);
  assert.deepEqual(frame.rows.map(row => row.row), [0]);
  assert.ok(frame.rows[0].sweep > .35 && frame.rows[0].sweep < .4);
  assert.equal(frame.cabinet, null);
  assert.equal(tracker.settledRows(), 0);
  assert.deepEqual(tracker.frame(4000).rows, []);
  assert.equal(tracker.settledRows(), 1);
  tracker.refresh(keys(11), 4100);
  assert.equal(tracker.settledRows(), 0);
  tracker.refresh(keys(12), 4200);
  assert.equal(tracker.frame(4400).rows.length, 1);
});

test('a filled cabinet flashes once and retains crown glow until a key is removed', () => {
  const tracker = createCabinetCompletion();
  tracker.refresh(keys(95), 0);
  tracker.refresh(keys(96), 1000);
  const flash = tracker.frame(2200);
  assert.deepEqual(flash.rows.map(row => row.row), [7]);
  assert.ok(flash.cabinet.flash > .99);
  assert.ok(tracker.frame(7000).crownGlow > .07);
  assert.equal(tracker.frame(7000).cabinet, null);
  tracker.refresh(keys(95), 7100);
  assert.equal(tracker.frame(7200).crownGlow, 0);
  assert.deepEqual(tracker.frame(7200).rows, []);
});

test('duplicate and invalid slot IDs cannot falsely complete a row', () => {
  const tracker = createCabinetCompletion();
  tracker.refresh([], 0);
  tracker.refresh([...keys(11), { cabinetSlot: 0 }, { cabinetSlot: 96 }, { cabinetSlot: -1 }], 10);
  assert.deepEqual(tracker.frame(20).rows, []);
  const early = sampleCabinetCelebration(.15), late = sampleCabinetCelebration(.8);
  assert.ok(early.sweep < late.sweep);
  assert.ok(sampleCabinetCelebration(1.2).flash > .99);
  assert.equal(sampleCabinetCelebration(3), null);
});


test('a slightly older frame timestamp cannot discard a newly earned sweep', () => {
  const tracker = createCabinetCompletion();
  tracker.refresh(keys(11), 0);
  tracker.refresh(keys(12), 1000);
  assert.deepEqual(tracker.frame(998).rows, []);
  assert.equal(tracker.frame(1001).rows.length, 1);
});
