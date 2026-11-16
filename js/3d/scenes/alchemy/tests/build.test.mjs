import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const source = join(root, 'src');
const dist = join(root, 'dist');
const lab = join(root, 'lab');
const metals = ['brass', 'copper', 'enamel', 'graphite', 'steel'];

function allFiles(dir, prefix = '') {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const relative = join(prefix, entry.name);
    return entry.isDirectory() ? allFiles(join(dir, entry.name), relative) : [relative];
  }).sort();
}

test('modular build preserves every version-28 resource except its rendering integration', () => {
  assert.deepEqual(allFiles(dist).filter(path => !path.startsWith('shared/')), allFiles(lab));
  for (const path of allFiles(lab)) {
    if (path === 'visuals.js' || path === 'background-effects.js') continue;
    assert.deepEqual(readFileSync(join(dist, path)), readFileSync(join(lab, path)), path);
  }
  assert.ok(readFileSync(join(dist, 'visuals.js'), 'utf8').includes("'./shared/painted-texture.js'"));
  assert.ok(readFileSync(join(dist, 'background-effects.js'), 'utf8').includes("'./shared/background-blur.js'"));
});

test('shared metal textures are the only common source', () => {
  for (const metal of metals) {
    const name = `painted-${metal}.webp`;
    assert.ok(!existsSync(join(source, 'assets', name)));
    const canonical = readFileSync(join(root, '../../shared/materials/metals', name));
    assert.ok(canonical.length > 500);
    assert.deepEqual(readFileSync(join(dist, 'assets', name)), canonical);
  }
});

test('all local ES modules and referenced assets exist', () => {
  for (const path of allFiles(dist).filter(name => name.endsWith('.js'))) {
    const file = join(dist, path);
    const code = readFileSync(file, 'utf8');
    for (const [, spec] of code.matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g)) {
      assert.ok(existsSync(resolve(dirname(file), spec)), `${path} imports missing ${spec}`);
    }
  }
  const html = readFileSync(join(dist, 'index.html'), 'utf8');
  for (const [, path] of html.matchAll(/(?:src|href)="(\.\/[^\"]+)"/g)) {
    assert.ok(existsSync(join(dist, path)), `Missing HTML resource: ${path}`);
  }
  assert.ok(statSync(join(dist, 'vendor/three.js')).size > 100_000);
});
