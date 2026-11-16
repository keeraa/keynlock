import test from 'node:test';
import assert from 'node:assert/strict';
import { createScenarioController } from '../src/js/runtime/scenario-controller.js';

function fixture(search) {
  const history = [];
  const state = { mode: 'pin' };
  const game = { value: null };
  let pins = 4;
  let selectedPuzzle = 'free';
  const position = { x: 5.4, y: 3.2, z: 7.7,
    clone() { return { x: this.x, y: this.y, z: this.z }; },
    set(x, y, z) { Object.assign(this, { x, y, z }); },
  };
  const camera = { position };
  const controls = { target: { set() {} }, update() { history.push('camera'); } };
  const select = { get value() { return selectedPuzzle; }, set value(v) { selectedPuzzle = v; } };
  const level = { dataset: { level: '1' } };
  const document = { querySelector: selector =>
    selector === '#pinPuzzleSelect' ? select : level };
  const window = { location: { search, pathname: '/demo' },
    history: { replaceState(_a, _b, uri) { history.push(uri); } } };
  const rng = { reset(value) { history.push(`seed:${value}`); } };
  const controller = createScenarioController({ window, document, camera, controls,
    rng, state, getPinXs: () => Array(pins).fill(0), getPinPuzzle: () => game.value,
    dispatch(command) {
      if (command.type === 'mode') {
        history.push(`mode:${command.mode}:${selectedPuzzle}`);
        state.mode = command.mode;
        game.value = null;
      } else if (command.type === 'pin-count') {
        pins = command.count; history.push(`pins:${pins}`);
      } else if (command.type === 'puzzle-start') {
        pins = (command.puzzle==='free'?[4,5,6]:[4,5,5])[command.level - 1];
        level.dataset.level=String(command.level);
        game.value = command.puzzle==='free'?null:{ type: command.puzzle, level: command.level };
        history.push(`puzzle:${command.puzzle}:${command.level}`);
      }
    },
  });
  return { history, state, controller, camera };
}

test('shareable scenarios start correct games and preserve seeded state and view', () => {
  const f = fixture('?scenario=symbolpins&level=2&pins=7&seed=9981&view=front&debug=1');
  const applied = f.controller.loadFromUrl();
  assert.deepEqual(applied, { mode: 'pin', puzzle: 'symbolpins', level: 2,
    pins: 5, seed: 9981, view: 'front' });
  assert.ok(f.history.includes('seed:9981'));
  assert.ok(f.history.includes('mode:pin:free'));
  assert.ok(f.history.includes('puzzle:symbolpins:2'));
  assert.equal(f.camera.position.z, 8.4);
  assert.equal(f.controller.current().pins, 5);
  f.controller.apply({ mode: 'disc', puzzle: 'free', seed: 42, view: 'side' }, { updateUrl: true });
  assert.equal(f.state.mode, 'disc');
  assert.equal(f.camera.position.x, -8.2);
  assert.ok(f.history.at(-1).includes('scenario=disc'));
  assert.ok(f.history.at(-1).includes('debug=1'));
});

test('regular launch does not recreate the default game or random sequence', () => {
  const f = fixture('');
  assert.equal(f.controller.loadFromUrl().mode, 'pin');
  assert.deepEqual(f.history, []);
  f.controller.setView('top');
  assert.equal(f.controller.current().view, 'top');
});

test('legacy six-pin free scenarios synchronize the visible difficulty to level three',()=>{
  const f=fixture('?scenario=free&pins=6&seed=97461');
  const applied=f.controller.loadFromUrl();
  assert.equal(applied.pins,6);
  assert.equal(applied.level,3);
  assert.ok(f.history.includes('puzzle:free:3'));
});
