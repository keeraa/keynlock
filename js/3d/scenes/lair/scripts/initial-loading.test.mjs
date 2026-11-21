import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createInitialLoadingGate } from '../src/initial-loading.js';

function fakeClock() {
  let time = 0;
  let nextId = 0;
  const timers = new Map();
  return {
    now: () => time,
    setTimer: (callback, delay) => {
      const id = ++nextId;
      timers.set(id, { callback, at: time + delay });
      return id;
    },
    clearTimer: (id) => timers.delete(id),
    advance(ms) {
      const target = time + ms;
      while (true) {
        const due = [...timers].filter(([, timer]) => timer.at <= target)
          .sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        time = due[1].at;
        timers.delete(due[0]);
        due[1].callback();
      }
      time = target;
    },
  };
}

test('the Lair stays covered until all wall previews settle, with real progress', () => {
  const clock = fakeClock();
  const updates = [];
  const finishes = [];
  const gate = createInitialLoadingGate({ ...clock,
    onProgress: (value) => updates.push(value),
    onDone: (reason) => finishes.push(reason),
  });
  clock.advance(200);
  gate.progress(0, 3);
  gate.progress(1, 3);
  gate.progress(3, 3);
  assert.deepEqual(updates, [
    { loaded: 0, total: 3 }, { loaded: 1, total: 3 }, { loaded: 3, total: 3 },
  ]);
  assert.deepEqual(finishes, [], 'the room must remain covered during thumbnail loading');
  gate.finish();
  gate.progress(0, 3);
  assert.equal(updates.length, 3, 'late image callbacks cannot restart progress');
  clock.advance(699);
  assert.deepEqual(finishes, []);
  clock.advance(1);
  assert.deepEqual(finishes, ['ready']);
  clock.advance(100000);
  assert.deepEqual(finishes, ['ready'], 'the timeout cannot reopen or finish twice');
});

test('a failed Atelier module cannot trap the visitor under the loading veil', () => {
  const clock = fakeClock();
  const finishes = [];
  createInitialLoadingGate({ ...clock, minimumMs: 10, timeoutMs: 30,
    onProgress: () => {}, onDone: (reason) => finishes.push(reason),
  });
  clock.advance(30);
  assert.deepEqual(finishes, ['timeout']);
});

test('the initial Lair loading waits for the Atelier exhibition completion event', () => {
  const room = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const atelier = readFileSync(new URL('../../../workshops/atelier/src/main.js', import.meta.url), 'utf8');
  assert.match(atelier, /const galleryReady = await exhibition\.refresh/);
  assert.match(atelier, /if \(!galleryReady\) throw/);
  assert.match(atelier, /notifyLair\('initial-gallery-ready'\)/);
  assert.match(room, /if \(type === 'initial-gallery-ready'\) \{galleryLoaded = true;completeInitialLoad\(\);\}/);
  assert.match(room, /galleryLoaded && alchemyLoaded/,
    'the original laboratory should finish initialization during the initial loading screen');
  assert.doesNotMatch(room, /setTimeout\(\(\) => loading\.classList\.add\('done'\), 900\)/);
});
