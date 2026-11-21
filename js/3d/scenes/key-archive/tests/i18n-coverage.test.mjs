import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ru from '../dist/js/locales/ru.js';
import en from '../dist/js/locales/en.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const JS = join(ROOT, 'dist', 'js');
const files = readdirSync(JS).filter(name => name.endsWith('.js'));
const source = name => readFileSync(join(JS, name), 'utf8');

test('no language has keys the Russian dictionary lacks', () => {
  for (const [code, dictionary] of Object.entries({ en }))
    assert.deepEqual(Object.keys(dictionary).filter(key => !(key in ru)), [], code);
});

test('every key the code asks for exists', () => {
  const missing = [];
  for (const name of files) {
    for (const [, key] of source(name).matchAll(/\bt\(\s*['"]([^'"]+)['"](?!\s*\+)/g))
      if (!(key in ru)) missing.push(`${name}: ${key}`);
    // Keys built at run time must at least have that prefix in the dictionary.
    for (const [, prefix] of [...source(name).matchAll(/\bt\(\s*(?:`([^`$]*)\$\{|['"]([^'"]+)['"]\s*\+)/g)]
      .map(([whole, template, quoted]) => [whole, template ?? quoted]))
      if (!Object.keys(ru).some(key => key.startsWith(prefix))) missing.push(`${name}: ${prefix}…`);
  }
  assert.deepEqual(missing, []);
});

test('every key the page markup asks for exists', () => {
  const html = readFileSync(join(ROOT, 'dist', 'index.html'), 'utf8');
  const keys = [
    ...[...html.matchAll(/data-i18n(?:-html)?="([^"]+)"/g)].map(match => match[1]),
    ...[...html.matchAll(/data-i18n-attr="([^"]+)"/g)]
      .flatMap(match => match[1].split(';').map(pair => pair.split(':')[1]?.trim()).filter(Boolean)),
  ];
  assert.ok(keys.length > 50);
  assert.deepEqual(keys.filter(key => !(key in ru)), []);
});

// Modules whose Russian text is not shown as-is to the player.
const NOT_PLAYER_TEXT = new Map([
  ['i18n.js', 'language names are written in their own language'],
  ['controls.js', 'Russian keyboard letters for the same keys'],
  ['key-data.js', 'shared key catalog; the archive shows familyName() instead'],
  ['rules.js', 'key type data; the archive shows familyName() instead'],
  ['station-layout.js', 'internal station names'],
  ['cabinet-layout.js', 'developer error'],
  ['key-shapes.js', 'developer error'],
  ['music-controls.js', 'shared player; the archive passes translated labels'],
  ['music-tracks.js', 'shared track titles in both languages; the archive picks one'],
]);

test('player-facing modules have no hard-coded Russian left', () => {
  const offenders = [];
  for (const name of files) {
    if (NOT_PLAYER_TEXT.has(name)) continue;
    const code = source(name).split('\n')
      .filter(line => !/^\s*\/\//.test(line) && !/console\.(warn|error|log)/.test(line)).join('\n');
    const match = code.match(/['"`][^'"`\n]*[А-Яа-яЁё][^'"`\n]*['"`]/);
    if (match) offenders.push(`${name}: ${match[0]}`);
  }
  assert.deepEqual(offenders, []);
});
