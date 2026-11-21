import test from 'node:test';
import assert from 'node:assert/strict';
import { createDayNight } from '../src/room/day-night.js';

test('the saved setting applies at once; switching later fades over the given time', () => {
  const applied = [];
  const dayNight = createDayNight(value => applied.push(value), { seconds: 1 });
  dayNight.set(true);
  assert.deepEqual(applied, [1], 'loading at night does not fade in from day');
  dayNight.set(false);
  dayNight.update(.5);
  assert.ok(applied.at(-1) > 0 && applied.at(-1) < 1, 'halfway through the change');
  dayNight.update(.5);
  assert.equal(applied.at(-1), 0, 'day after the full duration');
  const count = applied.length;
  dayNight.update(.5);
  assert.equal(applied.length, count, 'nothing to do once the change is over');
});
