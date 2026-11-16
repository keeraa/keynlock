import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../src/vendor/three-core.js';
import { createLockState } from '../src/js/state/lock-state.js';
import { createPinPuzzleRules } from '../src/js/gameplay/pin-rules.js';
import { createPinPuzzleController } from '../src/js/gameplay/pin-controller.js';
import { pinPuzzleModes, modeDetails } from '../src/js/gameplay/modes.js';

function fixture({unlimitedTools}={}) {
  const elements = new Map();
  const element = (id) => {
    if (!elements.has(id)) elements.set(id, {
      value: '', disabled: false, textContent: '',
      classList: { toggle() {} },
    });
    return elements.get(id);
  };
  const levels = [1, 2, 3].map(level => ({
    dataset: { level: String(level) },
    classList: { toggle() {} },
    setAttribute() {},
  }));
  const document = { querySelectorAll: () => levels };
  const state = createLockState([-.9, -.5, -.1, .3]);
  let pinXs = [-.9, -.5, -.1, .3];
  let puzzle = null;
  let resetCount = 0;
  let openedCount = 0;
  let renderCount = 0;
  let controlsCount = 0;
  let message = '';
  let time = 0;
  let seed = 81671;
  const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const rules = createPinPuzzleRules({ THREE, rand, getPuzzle: () => puzzle });
  const pinKey = { rig: { visible: true }, blade: { geometry: { dispose() {} } } };
  const pickRig = { visible: false };
  const tensionRig = { visible: false };
  const controller = createPinPuzzleController({
    THREE, $: element, document, performance: { now: () => (time += 140) },
    state, modeDetails, pinPuzzleModes,
    getPuzzle: () => puzzle, setPuzzle: value => { puzzle = value; },
    getPinXs: () => pinXs,
    setPinCount: count => { pinXs = Array.from({ length: count }, (_, i) => -.9 + .4 * i); },
    pinKey, pickRig, tensionRig,
    makeKeyProfile: () => ({ dispose() {} }),
    restoreShackle() {},
    resetPicking: () => {
      resetCount++;
      state.pinSet = Array(pinXs.length).fill(false);
      state.pinLifts = Array(pinXs.length).fill(0);
    },
    status: text => { message = text; }, rand,
    ...rules,
    renderPuzzle: () => { renderCount++; },
    updateControls: () => { controlsCount++; },
    setMode: mode => { state.mode = mode; },unlimitedTools,
    attemptShackleOpen: () => { openedCount++; },
  });
  return { controller, state, element, pinKey, pickRig, tensionRig,
    getPuzzle: () => puzzle, getXs: () => pinXs,
    get counters() { return { resetCount, openedCount, renderCount, controlsCount, message }; } };
}

test('controller starts each of the 24 pin puzzle variations with synchronized controls', () => {
  const f = fixture();
  for (const [type, settings] of Object.entries(pinPuzzleModes)) {
    for (let level = 1; level <= 3; level++) {
      f.controller.startPinPuzzle(type, level);
      const current = f.getPuzzle();
      assert.equal(current.type, type);
      assert.equal(current.level, level);
      assert.equal(current.count, settings.counts[level - 1]);
      assert.equal(f.getXs().length, current.count);
      assert.equal(f.state.pickTargetX, f.getXs()[current.selected]);
      assert.equal(f.state.picking, true);
      assert.ok(current.count <= 6);
      assert.equal(f.pickRig.visible, true);
      assert.equal(f.pinKey.rig.visible, false);
      assert.equal(f.tensionRig.visible, true);
      assert.equal(f.state.insertTarget, 1);
      assert.ok(f.counters.message.includes(settings.name));
    }
  }
  assert.equal(f.counters.resetCount, 24);
  assert.ok(f.counters.renderCount >= 24);
  assert.ok(f.counters.controlsCount >= 24);
});

test('free inspection derives four to six real pin chambers from difficulty',()=>{
  const f=fixture();
  for(const level of [1,2,3]){
    f.controller.startPinPuzzle('free',level);
    assert.equal(f.getPuzzle(),null);
    assert.equal(f.getXs().length,level+3);
    assert.equal(f.state.picking,false);
    assert.equal(f.element('pinPuzzleSelect').value,'free');
  }
});

test('controller applies penalties, completion and resets cleanly to free inspection', () => {
  const f = fixture();
  f.controller.startPinPuzzle('sequence', 1);
  const game = f.getPuzzle();
  f.controller.puzzleDamage('Неверная попытка');
  assert.equal(game.picks, Infinity);
  assert.equal(game.failures, 1);
  assert.equal(game.error, true);
  assert.ok(f.counters.message.includes('запас инструментов ∞'));
  f.state.insertP = 1;
  game.values = game.targets.slice();
  assert.equal(f.controller.puzzleComplete(), true);
  assert.equal(game.completed, true);
  assert.equal(f.state.turnTarget, 1);
  assert.equal(f.state.unlockTarget, 1);
  assert.equal(f.controller.puzzleComplete(), false);
  f.controller.startPinPuzzle('free');
  assert.equal(f.getPuzzle(), null);
  assert.equal(f.state.picking, false);
  assert.equal(f.pickRig.visible, false);
  assert.equal(f.pinKey.rig.visible, true);
});

test('pinflight controller advances each physical pin from launch to timed catch', () => {
  const f = fixture();
  f.controller.startPinPuzzle('pinflight', 3);
  f.state.insertP = 1;
  const game = f.getPuzzle();
  assert.equal(game.count, 6);
  assert.equal(f.controller.pinPuzzleAction(), true);
  assert.equal(game.phases[0].phase, 'up');
  f.controller.tickPinPuzzle(game.phases[0].up + .005);
  assert.equal(game.phases[0].phase, 'apex');
  assert.equal(f.controller.pinPuzzleAction(), true);
  assert.equal(game.phases[0].phase, 'fixed');
  assert.equal(game.fixed[0], true);
  assert.equal(game.motion[0], 1);
  f.controller.puzzleSelectPin(1);
  assert.equal(game.selected, 1);
  assert.equal(f.state.pickTargetX, f.getXs()[1]);
});

test('timing puzzles navigate horizontally and advance after fixing a pin', () => {
  const f=fixture();
  for(const type of ['tension','resonance']){
    f.controller.startPinPuzzle(type,1);
    f.state.insertP=1;
    const game=f.getPuzzle();
    f.controller.puzzleSelectPin(2);
    assert.equal(game.selected,2,`${type} must permit manual pin selection`);
    assert.equal(f.state.pickTargetX,f.getXs()[2]);
    game.needle=type==='tension'?game.bandCenter:50;
    assert.equal(f.controller.pinPuzzleAction(),true);
    assert.equal(game.fixed[2],true);
    assert.equal(game.selected,3,'selection advances to the next unlocked chamber');
    assert.equal(f.state.pickTargetX,f.getXs()[3]);
    f.controller.puzzleSelectPin(2);
    const picks=game.picks;
    assert.equal(f.controller.pinPuzzleAction(),false,'cannot fix the same pin twice');
    assert.equal(game.picks,picks,'already fixed pin is harmless');
  }
});

test('isolated pin ticker advances timing puzzles and respects pause and deadlines', () => {
  const f = fixture();
  f.controller.startPinPuzzle('tension', 2);
  f.state.insertP = 1;
  const tension = f.getPuzzle();
  f.controller.tickPinPuzzle(.4);
  assert.ok(tension.elapsed >= .4);
  assert.ok(tension.needle >= 0 && tension.needle <= 100);
  f.state.insertTarget = 0;
  const stopped = tension.elapsed;
  f.controller.tickPinPuzzle(2);
  assert.equal(tension.elapsed, stopped);

  f.controller.startPinPuzzle('resonance', 1);
  f.state.insertP = 1;
  const resonance = f.getPuzzle();
  f.controller.tickPinPuzzle(.25);
  assert.ok(resonance.needle >= 4 && resonance.needle <= 96);

  f.controller.startPinPuzzle('springtumblers', 3);
  f.state.insertP = 1;
  const spring = f.getPuzzle();
  f.controller.tickPinPuzzle(15);
  assert.equal(spring.failures, 1);
  assert.equal(spring.picks, Infinity);

  f.controller.startPinPuzzle('symbolpins', 1);
  f.state.insertP = 1;
  const symbols = f.getPuzzle();
  f.controller.tickPinPuzzle(60);
  assert.equal(symbols.expired, true);
  assert.ok(f.counters.message.includes('Время вышло'));
});

test('unlimited playtest tools survive repeated failures and slider stops after an error',()=>{
  const f=fixture();
  f.controller.startPinPuzzle('sequence',1);
  const game=f.getPuzzle();
  for(let i=0;i<12;i++)f.controller.puzzleDamage('Неверная попытка');
  assert.equal(game.picks,Infinity);
  assert.equal(game.failures,12);
  assert.equal(game.over,false);
  f.controller.startPinPuzzle('classic',1);
  const classic=f.getPuzzle();
  classic.selected=0;
  classic.values[0]=5;
  classic.values[1]=7;
  f.controller.puzzleSetSlider(7);
  assert.equal(classic.failures,1,'a failed slider move must stop even with ∞ tools');
});

test('finite tool inventory remains available when testing mode is switched off',()=>{
  const f=fixture({unlimitedTools:false});
  f.controller.startPinPuzzle('sequence',1);
  const game=f.getPuzzle();
  for(let i=0;i<3;i++)f.controller.puzzleDamage('Неверная попытка');
  assert.equal(game.picks,0);
  assert.equal(game.over,true);
});
