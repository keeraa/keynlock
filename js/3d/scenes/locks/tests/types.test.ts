// Compile-only contract tests: tsc must reject invalid actions and mechanism frames.
import type { GameCommand, MechanismFrame, MechanismHandle } from '../src/js/types/contracts.js';

const valid: GameCommand = { type: 'puzzle-select', index: 2, press: true };
const chapter: GameCommand = { type:'world-start', id:'wharf', level:2 };
const museumChoice: GameCommand = {type:'world-choice',index:20};
const reset: GameCommand = { type: 'reset' };
const outline: GameCommand = { type: 'cartoon-outline', value: 75 };
const toon: GameCommand = { type: 'toon-bands', value: 5 };
const paper: GameCommand = { type: 'paper-scale', value: 150 };
const film: GameCommand = { type: 'film-intensity', value: 25 }; // Historical tape no-op.
const frame: MechanismFrame = {
  D: (current, target) => current + (target - current) * .1,
  canRotate: false,
  fullTurn: 0,
  pinXs: [0, 1, 2, 3],
  pinPuzzle: null,
  selectedTension: 0,
};
declare const handle: MechanismHandle;
handle.update(frame);
void [valid, reset, outline, film, chapter, museumChoice];

// @ts-expect-error - wrench selection requires an index
const missingIndex: GameCommand = { type: 'wrench' };
// @ts-expect-error - invalid mechanism name
const wrongMode: GameCommand = { type: 'mode', mode: 'padlock' };
// @ts-expect-error - a reset command does not accept a value
const extraParameter: GameCommand = { type: 'reset', value: 1 };
// @ts-expect-error - outline strength requires a value
const missingOutline: GameCommand = { type: 'cartoon-outline' };
// @ts-expect-error - historical film commands still require a numeric value
const missingFilmIntensity: GameCommand = { type: 'film-intensity' };
// @ts-expect-error - chapter levels are I-III
const invalidChapter: GameCommand = { type:'world-start',id:'wharf',level:4 };
// @ts-expect-error - chapter ID must be in the canonical registry
const invalidMission: GameCommand = { type:'world-start',id:'made-up',level:1 };
// @ts-expect-error - a mechanism's update frame must provide the full contract
handle.update({ canRotate: true });
void [missingIndex, wrongMode, extraParameter, missingOutline, missingFilmIntensity,
  invalidChapter, invalidMission, toon, paper];
