import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const JS = join(ROOT, 'dist', 'js');

const modules = dir => readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
  entry.isDirectory() ? modules(join(dir, entry.name)) : entry.name.endsWith('.js') ? [join(dir, entry.name)] : []);

// Every static import / export-from / side-effect import / dynamic import.
function specifiers(path) {
  const code = readFileSync(path, 'utf8');
  const found = [];
  for (const pattern of [/\bfrom\s*(['"])(.+?)\1/g, /\bimport\s*(['"])(.+?)\1/g, /\bimport\(\s*(['"])(.+?)\1/g])
    for (const match of code.matchAll(pattern)) found.push(match[2]);
  return found;
}

test('modules import each other by plain paths, so every module has one URL', () => {
  // A `?v=` on one importer but not another makes the browser load two
  // instances of the same module (i18n once ran three times). Versioning
  // belongs to the import map in index.html, written by scripts/import-map.mjs.
  const offenders = [];
  for (const path of modules(JS))
    for (const specifier of specifiers(path))
      if (specifier.startsWith('.') && /[?#]/.test(specifier)) offenders.push(`${path.slice(JS.length + 1)}: ${specifier}`);
  assert.deepEqual(offenders, []);
});

test('every relative import points at an existing file', () => {
  const missing = [];
  for (const path of modules(JS))
    for (const specifier of specifiers(path))
      if (specifier.startsWith('.') && !existsSync(resolve(dirname(path), specifier.split('?')[0])))
        missing.push(`${path.slice(JS.length + 1)}: ${specifier}`);
  assert.deepEqual(missing, []);
});

test('the import map in both index.html files matches the current file hashes', () => {
  execFileSync(process.execPath, [join(ROOT, 'scripts', 'import-map.mjs'), '--check'], { stdio: 'pipe' });
  const html = readFileSync(join(ROOT, 'dist', 'index.html'), 'utf8');
  const map = JSON.parse(html.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]);
  assert.ok(map.imports['./js/main.js'] && map.imports['./vendor/three.js']);
  assert.ok(html.includes(`<script type="module" src="${map.imports['./js/main.js']}"></script>`),
    'the entry script uses the same URL the map gives main.js');
  assert.ok(html.indexOf('type="importmap"') < html.indexOf('<script type="module"'),
    'the import map must come before the first module script');
});
