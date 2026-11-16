import test from 'node:test';
import assert from 'node:assert/strict';
import { createLockState } from '../src/js/state/lock-state.js';
import { createFreePickingController } from '../src/js/gameplay/free-picking.js';

test('free picking enforces the binding order and aligns pins at the shear line', () => {
  const xs = [-1.16, -.68, -.2, .28];
  const state = createLockState(xs);
  const pinStacks = Array.from({ length: 7 }, (_, i) => ({ i, lift: 0, requiredLift: .19 }));
  const messages = [];
  let updates = 0;
  let finishes = 0;
  let puzzle = null;
  let puzzleActions = 0;
  const controller = createFreePickingController({
    state, getPinXs: () => xs,
    pinClearances: [.009, .002, .013, .005, .011, .007, .015],
    pinStacks, getPinPuzzle: () => puzzle,
    puzzleReady: game => game.ready,
    pinPuzzleAction: () => { puzzleActions++; return true; },
    setPinFinish: () => { finishes++; },
    status: message => { messages.push(message); },
    updateButtons: () => { updates++; },
  });
  controller.resetPicking();
  assert.deepEqual(state.pinSequence, [1, 3, 0, 2]);
  assert.equal(finishes, 1);
  assert.equal(controller.attemptPick(), false);
  assert.ok(messages.at(-1).includes('вставь отмычку'));

  state.picking = true;
  state.insertTarget = 1;
  state.insertP = 1;
  assert.equal(controller.pinsAtShear(), false);
  state.pickTargetX = xs[0];
  assert.equal(controller.attemptPick(), false);
  assert.equal(state.pinWobbleIndex, 0);
  assert.equal(state.pinWobble, 1);
  for (const index of state.pinSequence) {
    state.pickTargetX = xs[index];
    assert.equal(controller.nearestPin(xs[index]).index, index);
    assert.equal(controller.attemptPick(), true);
  }
  assert.equal(state.pinSetCount, 4);
  assert.equal(updates, 4);
  assert.equal(controller.pinsAtShear(), false);
  for (let i = 0; i < 4; i++) pinStacks[i].lift = pinStacks[i].requiredLift;
  assert.equal(controller.pinsAtShear(), true);
  state.wrong = true;
  assert.equal(controller.pinsAtShear(), false);

  puzzle = { ready: true };
  assert.equal(controller.attemptPick(), true);
  assert.equal(puzzleActions, 1);
  state.wrong = false;
  assert.equal(controller.pinsAtShear(), true);
  puzzle.ready = false;
  assert.equal(controller.pinsAtShear(), false);
});
