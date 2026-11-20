import { readFileSync } from 'node:fs';

// main.js wires the game together from these parts. Source checks read all of
// them, so moving code between them is not a failure.
export const MAIN_PARTS = ['main.js', 'archive-pointer-lock.js', 'archive-settings-controls.js',
  'archive-celebrations.js'];

export function mainSource() {
  return MAIN_PARTS.map(file => readFileSync(new URL(`../../dist/js/${file}`, import.meta.url), 'utf8')).join('\n');
}
