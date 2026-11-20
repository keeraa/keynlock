import test from 'node:test';
import assert from 'node:assert/strict';
import { bathReadiness } from '../dist/js/archive-bath-progress.js';
import { createStationClock } from '../dist/js/archive-station-clock.js';
import { bathContents, createInitialState, pickupKey, smeltingState, settleSmelting, startSoak,
  trashSelectedKey } from '../dist/js/rules.js';

test('readiness shows an empty bath, the next key, and any ready key without changing timers', () => {
  assert.deepEqual(bathReadiness([], 'rust', 10000), { progress: 0, status: 'empty' });
  const keys = [{ bathUntil: 25000 }, { bathUntil: 31000 }];
  const snapshot = JSON.stringify(keys);
  assert.deepEqual(bathReadiness(keys, 'rust', 10000), { progress: .5, status: 'processing' });
  assert.deepEqual(bathReadiness([...keys, { bathUntil: 9000 }], 'rust', 10000),
    { progress: 1, status: 'ready' });
  assert.equal(JSON.stringify(keys), snapshot);
});

test('station deadlines count only active play, including after restoring a checkpoint', () => {
  let elapsed = 0;
  const clock = createStationClock(100_000, () => elapsed);
  const state = createInitialState();
  clock.setActive(true);
  const muddy = state.keys.find(key => key.mud && !key.wax && !key.broken);
  const broken = state.keys.find(key => key.broken);
  assert.ok(pickupKey(state, muddy.id));
  assert.ok(startSoak(state, 'center-mud', 'mud', clock.now()));
  assert.ok(pickupKey(state, broken.id));
  assert.ok(trashSelectedKey(state, clock.now()));
  elapsed = 2_000;
  clock.setActive(false);
  const pauseTime = clock.now();
  elapsed = 70_000;
  clock.setActive(false);
  assert.equal(clock.now(), pauseTime);
  assert.equal(bathContents(state, 'center-mud', clock.now()).ready.length, 0);
  assert.equal(smeltingState(state, clock.now()).secondsLeft, 28);
  assert.equal(settleSmelting(state, clock.now()), 0);

  const resumed = createStationClock(pauseTime, () => elapsed);
  elapsed += 15_000;
  assert.equal(resumed.now(), pauseTime);
  resumed.setActive(true);
  elapsed += 3_000;
  assert.equal(bathContents(state, 'center-mud', resumed.now()).ready.length, 1);
  assert.equal(smeltingState(state, resumed.now()).secondsLeft, 25);
  elapsed += 25_000;
  assert.equal(settleSmelting(state, resumed.now()), 1);
});
