// @ts-check
import { WRENCH_PICKER_ORDER } from '../mechanisms/plate-symbols.js';
/** Layout-independent physical-key mapping to the same actions as on-screen controls. */
/** @typedef {import('../types/contracts.js').GameCommand} GameCommand */
/** @typedef {{ type:string, selected:number, count:number }} PuzzleView */

/**
 * @param {{code:string, repeat?:boolean, metaKey?:boolean, ctrlKey?:boolean,
 * altKey?:boolean, targetTag?:string,
 * mode:string, puzzle:PuzzleView|null, picking:boolean, insertTarget:number,
 * plateSelected?:number,plateCount?:number}} input
 * @returns {{handled:boolean,command:GameCommand|null}}
 */
export function mapGameKey(input) {
  const { code, repeat = false, metaKey = false, ctrlKey = false, altKey = false, targetTag = '',
    mode, puzzle, picking, insertTarget, plateSelected = 0, plateCount = 4 } = input;
  const ignored = { handled: false, command: null };
  const handled = (/** @type {GameCommand|null} */ command = null) => ({ handled: true, command });
  // Browser/system shortcuts always take precedence over gameplay, including reset.
  if (metaKey || ctrlKey || altKey || ['INPUT', 'TEXTAREA', 'SELECT'].includes(targetTag))
    return ignored;
  const direction = code === 'KeyA' || code === 'ArrowLeft' ? -1 :
    code === 'KeyD' || code === 'ArrowRight' ? 1 : 0;
  const up = code === 'KeyW' || code === 'ArrowUp';
  const down = code === 'KeyS' || code === 'ArrowDown';

  if (mode === 'plate') {
    if (code === 'KeyR' || code === 'KeyN') return handled(repeat ? null : {type:'reset'});
    if (code === 'Space' || code === 'Enter')
      return handled(repeat ? null : {type:'open'});
    if (/^Digit[1-5]$/.test(code))
      return handled(repeat ? null : {type:'wrench',index:WRENCH_PICKER_ORDER[Number(code[5]) - 1]});
    if (up || down) return handled(repeat ? null : {
      type:'plate-select',index:Math.max(0,Math.min(plateCount-1,plateSelected+(up?-1:1))),
    });
    if (direction) return handled(repeat ? null : {type:'plate-shift',delta:direction});
    return ignored;
  }

  if (mode === 'pin' && puzzle) {
    if (code === 'KeyR' || code === 'KeyN') return handled(repeat ? null : { type: 'reset' });
    if (!(direction || up || down || code === 'Space' || code === 'Enter'))
      return ignored;
    if (code === 'Enter') return handled(repeat ? null : { type: 'open' });
    if (code === 'Space') return handled(repeat ? null : { type: 'puzzle-action' });
    /** @param {number} delta @returns {GameCommand} */
    const selected = (delta) => ({ type: 'puzzle-select',
      index: Math.max(0, Math.min(puzzle.count - 1, puzzle.selected + delta)) });
    // Across all eight pin puzzles, horizontal keys always select a chamber.
    if (direction) return handled(repeat ? null : selected(direction));
    if (['classic', 'sequence', 'special'].includes(puzzle.type)) {
      return handled(repeat ? null : { type: 'puzzle-adjust', delta: up ? 1 : -1 });
    }
    if (puzzle.type === 'tension') {
      return handled({ type: 'puzzle-adjust', delta: up ? 1 : -1 });
    }
    if (puzzle.type === 'resonance')
      return handled(up && !repeat ? { type: 'puzzle-action' } : null);
    if (puzzle.type === 'pinflight')
      return handled(up && !repeat ? { type: 'puzzle-action' } : null);
    return handled({ type: 'puzzle-adjust', delta: up ? 1 : -1 });
  }

  if (code === 'Space') return handled(repeat ? null : { type: 'open' });
  if (mode !== 'pin' || !(direction || up || down)) return ignored;
  if (!picking) return handled(direction && !repeat ? { type: 'key-insert', direction } : null);
  if (!insertTarget) {
    if (direction > 0 && !repeat) return handled({ type: 'key-insert', direction: 1 });
    return handled({ type: 'pick-wait' });
  }
  if (direction) return handled(repeat ? null : { type: 'pick-step', delta: direction });
  if (up) return handled(repeat ? null : { type: 'pick' });
  return handled(repeat ? null : { type: 'pick-down' });
}
