import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const scene = new URL('../', import.meta.url);

test('dist is the only copy of the archive code', () => {
  assert.equal(existsSync(new URL('js', scene)), false, 'no second js/ next to dist/');
  assert.equal(existsSync(new URL('styles.css', scene)), false, 'no second styles.css next to dist/');
  // The root page is the dist page plus a <base> pointing at dist.
  const root = readFileSync(new URL('index.html', scene), 'utf8');
  const dist = readFileSync(new URL('dist/index.html', scene), 'utf8');
  assert.match(root, /<base href="\.\/dist\/" \/>/);
  assert.equal(root.replace(/\s*<base href="\.\/dist\/" \/>/, ''), dist);
});

test('shared key modules match the canonical library', () => {
  const sync = new URL('../../../shared/keys/sync.mjs', import.meta.url);
  const repositoryRoot = new URL('../../../../../', import.meta.url);
  const output = execFileSync(process.execPath, [sync.pathname, '--check'], { cwd: repositoryRoot.pathname, encoding: 'utf8' });
  assert.match(output, /check: 0 mirror\(s\) out of sync/);
});

test('music modules match the canonical player in js/3d/core/audio', () => {
  const sync = new URL('../../../core/audio/sync.mjs', import.meta.url);
  const repositoryRoot = new URL('../../../../../', import.meta.url);
  const output = execFileSync(process.execPath, [sync.pathname, '--check'], { cwd: repositoryRoot.pathname, encoding: 'utf8' });
  assert.match(output, /check: 0 mirror\(s\) out of sync/);
});
