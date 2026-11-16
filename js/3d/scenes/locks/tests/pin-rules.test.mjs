import test from 'node:test';
import assert from 'node:assert/strict';
import { createPinPuzzleRules } from '../src/js/gameplay/pin-rules.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
function seededRules(seed = 1926) {
  let active = null;
  const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const rules = createPinPuzzleRules({ THREE: { MathUtils: { clamp } }, rand: random, getPuzzle: () => active });
  return { ...rules, activate(game) { active = game; } };
}
const modes = {
  classic: [4, 5, 5], sequence: [4, 5, 5], special: [4, 5, 5],
  tension: [4, 5, 6], resonance: [4, 5, 6], pinflight: [5, 6, 6],
  springtumblers: [5, 5, 5], symbolpins: [5, 5, 5],
};

for (const [type, counts] of Object.entries(modes)) {
  for (const [index, count] of counts.entries()) {
    const level = index + 1;
    test(`${type} level ${level} generates solvable state for ${count} real pins`, () => {
      const rules = seededRules(1926 + level);
      const game = { type, level, count, over: false };
      rules.puzzleGenerate(game);
      rules.activate(game);
      assert.equal(game.values.length, count);
      assert.equal(game.targets.length, count);
      assert.equal(game.fixed.length, count);
      assert.equal(game.motion.length, count);
      assert.equal(game.selected, 0);
      assert.ok(!rules.puzzleReady(game));
      if (['classic', 'sequence', 'special'].includes(type)) {
        game.values = game.targets.slice();
      } else {
        game.fixed.fill(true);
      }
      assert.ok(rules.puzzleReady(game), `${type} cannot be solved`);
      assert.ok(rules.puzzlePinLift({i: 0, requiredLift: 0.6}) > 0);
      game.over = true;
      assert.equal(rules.puzzleReady(game), false);
    });
  }
}

test('classic moves a coupled neighbor and respects movement bounds', () => {
  const rules = seededRules();
  const game = { type: 'classic', count: 4, values: [4, 4, 4, 4] };
  assert.ok(rules.puzzleLinkedStep(game, 0, +1));
  assert.equal(game.values[0], 5);
  assert.notEqual(game.values[1], 4);
  game.values[0] = 7;
  assert.equal(rules.puzzleLinkedStep(game, 0, +1), false);
});

test('mirror special lock applies opposite lift to opposite pin', () => {
  const rules = seededRules();
  const game = { type: 'special', linkType: 'mirror', count: 5, values: [4, 4, 4, 4, 4] };
  assert.ok(rules.puzzleLinkedStep(game, 0, +1));
  assert.deepEqual(game.values, [5, 4, 4, 4, 3]);
});

test('tension and resonance use the selected pin like every other game', () => {
  const rules = seededRules();
  for (const type of ['tension', 'resonance']) {
    assert.equal(rules.puzzleActiveIndex({type,count:4,fixed:[true,true,false,false],selected:3}),3);
  }
});
