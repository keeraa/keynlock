import { readFileSync } from 'node:fs';

// world.js builds the scene from these parts. Source checks that used to read
// world.js alone read all of them, so moving code between them is not a failure.
export const WORLD_PARTS = ['world.js', 'world-floor-keys.js', 'world-hover.js',
  'held-key.js', 'held-key-pose.js', 'held-wax-melt.js'];

export function worldSource() {
  return WORLD_PARTS.map(file => readFileSync(new URL(`../../dist/js/${file}`, import.meta.url), 'utf8')).join('\n');
}
