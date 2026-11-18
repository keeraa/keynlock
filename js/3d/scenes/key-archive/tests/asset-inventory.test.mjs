import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

const assetsUrl = new URL('../dist/assets/', import.meta.url);

test('all packaged hall paintings are referenced by the runtime', () => {
  const filenames = readdirSync(assetsUrl).filter(file => file.endsWith('.webp'));
  const runtime = [
    'hall-surface-textures.js', 'painted-textures.js',
    'key-data.js', 'entrance-door-texture.js',
  ].map(file => readFileSync(new URL(`../dist/js/${file}`, import.meta.url), 'utf8')).join('\n');
  assert.equal(filenames.length, 11);
  for (const filename of filenames) assert.ok(runtime.includes(filename), `orphan: ${filename}`);
});
