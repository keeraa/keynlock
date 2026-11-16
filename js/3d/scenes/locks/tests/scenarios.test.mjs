import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeededRandom, parseScenario, scenarioSearch,
  normalizeScenario, createScenarioTape, validateActionTape } from '../src/js/runtime/scenarios.js';

test('repeated seeds generate identical puzzle randomness', () => {
  const a = createSeededRandom(123), b = createSeededRandom(123);
  assert.deepEqual(Array.from({ length: 20 }, () => a.next()),
    Array.from({ length: 20 }, () => b.next()));
  const nextState = a.state;
  b.reset(nextState);
  assert.equal(a.next(), b.next());
});

test('scenario links normalize lock, puzzle, camera and pin counts', () => {
  const source = normalizeScenario({ mode: 'pin', puzzle: 'springtumblers',
    level: 3, pins: 6, seed: 76821, view: 'side' });
  const url = scenarioSearch(source, { debug: true });
  assert.ok(url.includes('debug=1'));
  assert.deepEqual(parseScenario(url), source);
  assert.deepEqual(parseScenario('?scenario=code&level=20&pins=99&seed=-1'),
    { mode: 'code', puzzle: 'free', level: 3, pins: 6,
      seed: 4294967295, view: 'default' });
  assert.equal(parseScenario('?scenario=classic').puzzle, 'classic');
  assert.equal(parseScenario('?scenario=plate&view=front').mode, 'plate');
});

test('action tapes record ordered actions and replay with injected timing', async () => {
  let now = 1000;
  const delays = [], actions = [], resets = [];
  const recorder = createScenarioTape({ now: () => now,
    wait: async ms => { delays.push(ms); } });
  const initial = parseScenario('?scenario=classic&seed=987&level=2');
  recorder.start(initial);
  now += 110;
  recorder.record({ type: 'command', command: { type: 'puzzle-adjust', delta: 1 } });
  now += 250;
  recorder.record({ type: 'command', command: { type: 'puzzle-select', index: 3, press: true } });
  const tape = recorder.stop();
  assert.equal(tape.actions.length, 2);
  assert.deepEqual(tape.actions.map(action => action.t), [110, 360]);
  assert.deepEqual(validateActionTape(JSON.parse(JSON.stringify(tape))), tape);
  await recorder.replay(tape, {
    reset: async scenario => resets.push(scenario),
    dispatch: async action => actions.push(action), speed: 2,
  });
  assert.deepEqual(delays, [55, 125]);
  assert.deepEqual(resets, [initial]);
  assert.deepEqual(actions.map(action => action.command), [
    { type: 'puzzle-adjust', delta: 1 },
    { type: 'puzzle-select', index: 3, press: true },
  ]);
  assert.equal(recorder.isPlaying, false);
});

test('invalid replay inputs cannot address arbitrary elements or unbounded sequences', () => {
  assert.throws(() => validateActionTape({ version: 1,
    actions: [{ t: 0, type: 'click', selector: 'body *' }] }), /селектор/);
  assert.throws(() => validateActionTape({ version: 1,
    actions: [{ t: 0, type: 'key', code: 'Meta+R' }] }), /клавиша/);
  assert.throws(() => validateActionTape({ version: 1,
    actions: Array.from({ length: 501 }, () => ({ t: 0, type: 'click', selector: '#resetButton' }))
  }), /формат/);
  assert.throws(() => validateActionTape({ version: 1,
    actions: [{ t: 0, type: 'click', selector: '#loading' }] }), /селектор/);
  assert.throws(() => validateActionTape({ version: 1,
    actions: [{ t: 0, type: 'input', selector: '#modeButtons' }] }), /селектор/);
  assert.throws(() => validateActionTape({ version: 1,
    actions: [{ t: 0, type: 'input', selector: '#pinCountSlider', value: 'Infinity' }] }), /значение/);
  assert.throws(() => validateActionTape({ version: 1,
    actions: [{ t: 0, type: 'change', selector: '#pinPuzzleSelect', value: 'unknown' }] }), /головоломки/);
  assert.throws(() => validateActionTape({ version: 1,
    actions: [{ t: 0, type: 'command', command: { type: 'wrench', index: 900 } }] }), /команд/);
  assert.throws(() => validateActionTape({ version: 1,
    actions: [{ t: 0, type: 'command', command: { type: 'reset', extra: 'unsafe' } }] }), /команд/);
});

test('legacy selector tapes still validate for imported recordings', () => {
  assert.deepEqual(validateActionTape({ version: 1,
    actions: [{ t: 15, type: 'click', selector: '#insertButton' }] }).actions[0],
  { t: 15, type: 'click', selector: '#insertButton', value: undefined, code: '' });
  assert.deepEqual(validateActionTape({ version: 1,
    actions: [{ t: 0, type: 'click', selector: '#cartoonToggle' },
      { t: 1, type: 'input', selector: '#cartoonOutlineSlider', value: '85' }] }).actions,
  [{ t: 0, type: 'click', selector: '#cartoonToggle', value: undefined, code: '' },
    { t: 1, type: 'input', selector: '#cartoonOutlineSlider', value: '85', code: '' }]);
  assert.equal(validateActionTape({ version: 1,
    actions: [{ t: 0, type: 'click', selector: '#paperToggle' },
      { t: 1, type: 'input', selector: '#paperScaleSlider', value: '160' }] }).actions.length, 2);
});
