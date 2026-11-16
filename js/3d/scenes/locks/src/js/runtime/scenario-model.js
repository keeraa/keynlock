/** Seeded puzzles and stable scenario URLs, with no DOM or replay dependencies. */
import {PUZZLE_TYPES} from '../gameplay/commands.js';

export const DEFAULT_SEED = 97461;
export const SCENARIO_VIEWS = ['default', 'front', 'side', 'top'];
export const SCENARIO_PUZZLES = PUZZLE_TYPES;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const numberOr = (value, fallback) => Number.isFinite(Number(value)) && value !== null && value !== ''
  ? Number(value) : fallback;

export function normalizeSeed(value) {
  const numeric = Math.trunc(numberOr(value, DEFAULT_SEED));
  return (numeric >>> 0) || DEFAULT_SEED;
}

export function createSeededRandom(initialSeed = DEFAULT_SEED) {
  let current = normalizeSeed(initialSeed);
  return {
    next() {
      current = (current * 1664525 + 1013904223) >>> 0;
      return current / 4294967296;
    },
    reset(seed) { current = normalizeSeed(seed); },
    get state() { return current; },
  };
}

export function normalizeScenario(input = {}) {
  const puzzle = SCENARIO_PUZZLES.includes(input.puzzle) ? input.puzzle : 'free';
  const mode = ['pin', 'disc', 'code', 'plate'].includes(input.mode) ? input.mode : 'pin';
  return {
    seed: normalizeSeed(input.seed),
    mode: puzzle !== 'free' ? 'pin' : mode,
    puzzle: mode === 'pin' || puzzle !== 'free' ? puzzle : 'free',
    level: clamp(Math.round(numberOr(input.level, 1)), 1, 3),
    pins: clamp(Math.round(numberOr(input.pins, 4)), 4, 6),
    view: SCENARIO_VIEWS.includes(input.view) ? input.view : 'default',
  };
}

export function parseScenario(search = '') {
  const params = new URLSearchParams(search);
  const scenario = params.get('scenario');
  const puzzle = SCENARIO_PUZZLES.includes(scenario) ? scenario : params.get('puzzle');
  return normalizeScenario({
    seed: params.get('seed'),
    mode: ['pin', 'disc', 'code', 'plate'].includes(scenario) ? scenario : params.get('mode'),
    puzzle, level: params.get('level'), pins: params.get('pins'), view: params.get('view'),
  });
}

export function scenarioSearch(input, { debug = false } = {}) {
  const scenario = normalizeScenario(input);
  const params = new URLSearchParams({
    scenario: scenario.mode === 'pin' ? scenario.puzzle : scenario.mode,
    level: String(scenario.level), pins: String(scenario.pins),
    seed: String(scenario.seed), view: scenario.view,
  });
  if (debug) params.set('debug', '1');
  return `?${params}`;
}
