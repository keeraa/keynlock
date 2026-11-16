// @ts-check
/** Canonical, serializable game-command protocol shared by UI, keys and replays. */
/** @typedef {import('../types/contracts.js').GameCommand} GameCommand */

export const PUZZLE_TYPES = Object.freeze([
  'free', 'classic', 'sequence', 'special', 'tension', 'resonance',
  'pinflight', 'springtumblers', 'symbolpins',
]);
const MODES = ['pin', 'disc', 'code', 'plate'];
const CASE_FINISHES = ['titanium', 'graphite', 'bronze', 'navy'];
const STEEL_TEXTURES = ['steel', 'graphite', 'enamel'];
const BRASS_TEXTURES = ['brass', 'copper'];
const WORLD_PUZZLES = ['wharf', 'keyprofile', 'pairednodes', 'museum'];
/** @param {unknown} value @param {number} low @param {number} high */
function numberInRange(value, low, high) {
  return typeof value === 'number' && Number.isFinite(value) && value >= low && value <= high;
}
/** @param {unknown} value @param {number} low @param {number} high */
function integerInRange(value, low, high) {
  return numberInRange(value, low, high) && Number.isInteger(value);
}

/**
 * Reject unrecognized actions, incorrect payloads and extra properties.
 * @param {unknown} input
 * @returns {GameCommand}
 */
export function normalizeGameCommand(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('Команда должна быть объектом.');
  const raw = /** @type {Record<string, unknown>} */ (input);
  const type = raw.type;
  /** @type {Record<string, unknown>|null} */
  let command = null;
  switch (type) {
    case 'world-start':
      if (!WORLD_PUZZLES.includes(/** @type {string} */ (raw.id)) ||
        !integerInRange(raw.level, 1, 3)) break;
      command = {type,id:raw.id,level:raw.level}; break;
    case 'world-choice':
      if (!integerInRange(raw.index, 0, 20)) break;
      command = {type,index:raw.index}; break;
    case 'mode':
      if (!MODES.includes(/** @type {string} */ (raw.mode))) break;
      command = { type, mode: raw.mode }; break;
    case 'pin-count':
      if (!integerInRange(raw.count, 4, 6)) break;
      command = { type, count: raw.count }; break;
    case 'plate-select':
      if (!integerInRange(raw.index, 0, 5)) break;
      command = { type, index: raw.index }; break;
    case 'plate-count':
      if (!integerInRange(raw.count, 4, 6)) break;
      command = { type, count: raw.count }; break;
    case 'plate-tool':
      if (!integerInRange(raw.index, 0, 4)) break;
      command = { type, index: raw.index }; break;
    case 'plate-shift':
      if (raw.delta !== 1 && raw.delta !== -1) break;
      command = { type, delta: raw.delta }; break;
    case 'puzzle-start':
      if (!PUZZLE_TYPES.includes(/** @type {string} */ (raw.puzzle)) ||
        !integerInRange(raw.level, 1, 3)) break;
      command = { type, puzzle: raw.puzzle, level: raw.level }; break;
    case 'puzzle-select':
      if (!integerInRange(raw.index, 0, 5) ||
        (raw.press !== undefined && typeof raw.press !== 'boolean')) break;
      command = raw.press === undefined ? { type, index: raw.index } :
        { type, index: raw.index, press: raw.press }; break;
    case 'puzzle-adjust':
    case 'pick-step':
      if (raw.delta !== 1 && raw.delta !== -1) break;
      command = { type, delta: raw.delta }; break;
    case 'key-insert':
      if (raw.direction !== 1 && raw.direction !== -1) break;
      command = { type, direction: raw.direction }; break;
    case 'puzzle-value':
    case 'opacity':
    case 'cartoon-outline':
    case 'toon-strength':
    case 'paper-strength':
    case 'paint-strength':
    case 'paint-material':
    case 'paint-detail':
    // Read old tapes without reinstating the removed full-screen film effect.
    case 'film-intensity':
    case 'explode':
      if (!numberInRange(raw.value, 0, type === 'explode' ? 200 : 100)) break;
      command = { type, value: raw.value }; break;
    case 'toon-bands':
      if (!integerInRange(raw.value, 2, 7)) break;
      command = { type, value: raw.value }; break;
    case 'outline-width':
      if (!numberInRange(raw.value, 1, 4)) break;
      command = { type, value: raw.value }; break;
    case 'paper-scale':
      if (!numberInRange(raw.value, 50, 200)) break;
      command = { type, value: raw.value }; break;
    case 'paint-steel-variant':
      if (!STEEL_TEXTURES.includes(/** @type {string} */ (raw.variant))) break;
      command = { type, variant: raw.variant }; break;
    case 'paint-brass-variant':
      if (!BRASS_TEXTURES.includes(/** @type {string} */ (raw.variant))) break;
      command = { type, variant: raw.variant }; break;
    case 'wrench':
      if (!integerInRange(raw.index, 0, 4)) break;
      command = { type, index: raw.index }; break;
    case 'pin-finish':
      if (!integerInRange(raw.index, 0, 5)) break;
      command = { type, index: raw.index }; break;
    case 'case-finish':
      if (!CASE_FINISHES.includes(/** @type {string} */ (raw.color))) break;
      command = { type, color: raw.color }; break;
    case 'world-confirm': case 'world-exit': case 'world-restart':
    case 'puzzle-action': case 'insert-toggle': case 'turn-toggle': case 'open':
    case 'tool-toggle': case 'pick': case 'pick-down': case 'pick-wait': case 'wrong-key-toggle':
    case 'reset': case 'explode-toggle': case 'auto-xray-toggle': case 'schematic-xray-toggle':
    case 'oil-tool-toggle': case 'cartoon-toggle': case 'toon-toggle':
    case 'outline-toggle': case 'paper-toggle':
    case 'painted-materials-toggle':
      command = { type }; break;
  }
  if (!command || Object.keys(raw).length !== Object.keys(command).length ||
    Object.keys(command).some(key => raw[key] !== command[key]))
    throw new Error(`Некорректная команда: ${String(type)}`);
  return /** @type {GameCommand} */ (command);
}
