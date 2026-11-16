/** The five original tool marks: left angle, elbow, hook, line, winding line.
 * Shared vertices keep plate engravings and the picker visually identical. */

export const PLATE_SYMBOLS = Object.freeze([
  { name: 'Угол', strokes: [
    [[.63, .88], [-.62, 0], [.63, -.88]],
  ] },
  { name: 'Колено', strokes: [
    [[-.72, .84], [.18, .84], [.34, .81], [.48, .73], [.56, .61], [.58, .46], [.58, -.85]],
  ] },
  { name: 'Крючок', strokes: [
    [[-.62, -.86], [-.62, .14], [-.59, .39], [-.49, .64], [-.32, .81], [-.09, .88],
      [.16, .85], [.35, .73], [.46, .55], [.49, .37]],
  ] },
  { name: 'Черта', strokes: [
    [[0, .90], [0, -.90]],
  ] },
  { name: 'Волна', strokes: [
    Array.from({ length: 29 }, (_, i) => {
      const t = i / 28;
      return [.15 * Math.sin(5 * Math.PI * t + .55), .91 - 1.82 * t];
    }),
  ] },
]);

// Each motif keeps its original matching 3D wrench, irrespective of screen order.
export const PLATE_SYMBOL_TO_WRENCH = Object.freeze([2, 0, 3, 4, 1]);
export const WRENCH_TO_PLATE_SYMBOL = Object.freeze([1, 4, 0, 2, 3]);
// Physical keys 1–5 follow the visible row: former fourth wrench moved to first.
export const WRENCH_PICKER_ORDER = Object.freeze([4, 2, 0, 3, 1]);

/** @param {number} index */
export function plateSymbolSvg(index) {
  const symbol = PLATE_SYMBOLS[index];
  if (!symbol) throw new Error('Unknown plate symbol');
  const paths = symbol.strokes.map(points =>
    `<polyline points="${points.map(([x, y]) => `${(24 + 18*x).toFixed(2)},${(24 - 18*y).toFixed(2)}`).join(' ')}"/>`).join('');
  return `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round">${paths}</svg>`;
}
