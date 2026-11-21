import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { keynlockPaintings, PAINTINGS_BASE, PAINTINGS_COMMIT } from '../src/painting-catalog.js';

const repoRoot = fileURLToPath(new URL('../../../../../', import.meta.url));

test('paintings load from a fixed commit, never from a branch', () => {
  assert.match(PAINTINGS_COMMIT, /^[0-9a-f]{40}$/);
  for (const art of keynlockPaintings) assert.ok(art.image.startsWith(PAINTINGS_BASE), art.id);
});

test('every catalog painting exists in the repository', () => {
  const missing = keynlockPaintings
    .map(art => 'assets/restoration/' + art.image.slice(PAINTINGS_BASE.length))
    .filter(path => !existsSync(repoRoot + decodeURIComponent(path)));
  assert.deepEqual(missing, []);
});
