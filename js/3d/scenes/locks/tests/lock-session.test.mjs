import test from 'node:test';
import assert from 'node:assert/strict';
import { createLockState } from '../src/js/state/lock-state.js';
import { createLockSession } from '../src/js/gameplay/lock-session.js';
import { modeDetails } from '../src/js/gameplay/modes.js';
import { createPlatePuzzle } from '../src/js/gameplay/plate-rules.js';

function fixture() {
  const calls = [];
  const modeButtons = ['pin', 'disc', 'code', 'plate'].map(mode => ({ dataset: { mode },
    active: false, classList: { toggle() {} }, setAttribute() {} }));
  const elements = new Map();
  const $ = id => {
    if (!elements.has(id)) elements.set(id, { value: '', style: {}, textContent: '' });
    return elements.get(id);
  };
  const document = { querySelector(selector) {
    if (selector === '#pinPuzzleLevels button.active') return { dataset: { level: '2' } };
    return null;
  }, querySelectorAll: () => modeButtons };
  const state = createLockState([-.6, -.2, .2, .6]);
  let puzzle = null;
  const platePuzzle = createPlatePuzzle(() => .37);
  platePuzzle.reset();
  const pinKey = { blade: { geometry: { dispose() { calls.push('disposeGeometry'); } } }, rig: {} };
  const session = createLockSession({ $, document, state, modeDetails,
    mechanismRegistry: { activate: name => calls.push(`activate:${name}`),
      reset: name => calls.push(`reset:${name}`) },
    getPinPuzzle: () => puzzle, setPinPuzzle: value => { puzzle = value; },
    getPinXs: () => [0, 1, 2, 3],
    pinKey, pickRig: {}, tensionRig: {},
    makeKeyProfile: () => ({ dispose() {} }),
    restoreShackle() { calls.push('shackle'); },
    resetPicking() { calls.push('pickReset'); },
    status: message => calls.push(`status:${message}`),
    startPinPuzzle(type, level) { puzzle = { type, level }; calls.push(`puzzle:${type}:${level}`); },
    renderPinPuzzleUI() { calls.push('renderUI'); },
    updateButtons() { calls.push('buttons'); },
    shackleBody: { released: false, shaking: 0 },
    puzzleReady: game => game.ready,
    puzzleNotice: message => calls.push(`notice:${message}`),
    puzzleDamage: message => calls.push(`damage:${message}`),
    puzzleComplete() { calls.push('complete'); },
    platePuzzle, renderPlateUI() { calls.push('plateUI'); },
  });
  return { $, state, calls, session, platePuzzle, setPuzzle: value => { puzzle = value; },
    puzzle: () => puzzle };
}

test('mode session activates the matching mechanism and restores free state', () => {
  const f = fixture();
  f.$('pinPuzzleSelect').value = 'free';
  f.state.picking = true; f.state.turnP = .9;
  f.session.setMode('disc');
  assert.equal(f.state.mode, 'disc');
  assert.equal(f.state.turnP, 0);
  assert.equal(f.state.picking, false);
  assert.ok(f.calls.includes('activate:disc'));
  assert.equal(f.$('pinGamesSection').style.display, 'none');
  f.$('pinPuzzleSelect').value = 'classic';
  f.session.setMode('pin');
  assert.deepEqual(f.puzzle(), { type: 'classic', level: 2 });
  f.session.reset();
  assert.ok(f.calls.includes('reset:pin'));
  assert.equal(f.calls.filter(call => call === 'puzzle:classic:2').length, 2);
});

test('plate type uses four classic strips and opens only after symbol-matched alignment', () => {
  const f = fixture();
  f.session.setMode('plate');
  assert.equal(f.state.mode, 'plate');
  assert.equal(f.$('modeTitle').textContent, 'Пластинчатый');
  assert.equal(f.$('plateSection').style.display, 'block');
  assert.equal(f.$('wrenchPicker').style.display, '', 'global tension controls stay visible');
  assert.equal(f.$('pinGamesSection').style.display, 'none');
  assert.equal(f.$('lockActionsSection').style.display, 'none');
  assert.equal(f.platePuzzle.model.plates.length, 4);
  assert.equal(f.platePuzzle.model.selectedTool, 0,
    'the active angled tension wrench also starts selected in the plate mode');
  f.session.attemptShackleOpen();
  assert.equal(f.state.unlockTarget, 0);
  for (const plate of f.platePuzzle.model.plates) {
    f.platePuzzle.selectPlate(plate.index);
    f.platePuzzle.selectTool(plate.symbol);
    while (plate.position !== 4)
      f.platePuzzle.shift(Math.sign(4 - plate.position));
  }
  assert.equal(f.platePuzzle.isSolved(), true);
  f.session.attemptShackleOpen();
  assert.equal(f.state.unlockTarget, 1);
  assert.equal(f.state.turnTarget, 1);
  f.session.reset();
  assert.equal(f.state.unlockTarget, 0);
  assert.equal(f.platePuzzle.isSolved(), false);
  assert.ok(f.calls.includes('reset:plate'));
});

test('five or six plate strips still require every one of their pegs at the fourth hole', () => {
  for (const count of [5,6]) {
    const f = fixture();
    f.platePuzzle.setCount(count);
    f.session.setMode('plate');
    assert.equal(f.platePuzzle.model.plates.length,count);
    const symbol = f.platePuzzle.model.symbol;
    f.platePuzzle.selectTool(symbol);
    const moves = [...f.platePuzzle.model.scrambleMoves].reverse();
    for (const {index,delta} of moves.slice(0,-1)) {
      f.platePuzzle.selectPlate(index);
      assert.equal(f.platePuzzle.shift(-delta),true);
    }
    f.session.attemptShackleOpen();
    assert.equal(f.state.unlockTarget,0,`locked until every linked plate is aligned`);
    const lastMove = moves.at(-1);
    f.platePuzzle.selectPlate(lastMove.index);
    assert.equal(f.platePuzzle.shift(-lastMove.delta),true);
    f.session.attemptShackleOpen();
    assert.equal(f.state.unlockTarget,1);
  }
});

test('unlocking remains gated by insertion and the active puzzle objective', () => {
  const f = fixture();
  f.session.attemptShackleOpen();
  assert.equal(f.state.turnTarget, 0);
  assert.equal(f.state.unlockTarget, 0);
  f.state.insertTarget = 1;
  f.state.insertP = 1;
  f.session.attemptShackleOpen();
  assert.equal(f.state.turnTarget, 1);
  f.state.turnTarget = 0; f.state.unlockTarget = 0;
  f.setPuzzle({ type: 'classic', level: 1, ready: false });
  f.session.attemptShackleOpen();
  assert.ok(f.calls.some(call => call.startsWith('damage:')));
  f.setPuzzle({ type: 'classic', level: 1, ready: true });
  f.session.attemptShackleOpen();
  assert.ok(f.calls.includes('complete'));
});
