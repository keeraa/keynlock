import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTranslator, normalizeText } from '../../../core/i18n/translator.js';
import en from '../src/locales/en.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const CYRILLIC = /[А-Яа-яЁё]/;
const decode = text => text.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

/** The Russian texts the page shows: text between tags and text attributes. */
function htmlTexts(html) {
  const markup = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/g, '');
  const texts = [];
  for (const [, value] of markup.matchAll(/\s(?:aria-label|title|placeholder|alt)="([^"]*)"/g)) texts.push(value);
  for (const segment of markup.split(/<[^>]+>/)) texts.push(segment);
  return texts.map(text => normalizeText(decode(text))).filter(text => CYRILLIC.test(text));
}

function codeFileTexts(path) {
  return [...readFileSync(path, 'utf8').matchAll(/\bt\('((?:[^'\\]|\\.)*)'/g)]
    .map(([, text]) => normalizeText(text));
}

/** Every t('…') call in the Lair's code. */
function codeTexts(dir = join(root, 'src')) {
  const texts = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) { if (name !== 'locales') texts.push(...codeTexts(path)); continue; }
    if (!name.endsWith('.js')) continue;
    texts.push(...codeFileTexts(path));
  }
  return texts;
}

test('every Russian text of the Lair page and code has an English translation', () => {
  // The embedded workshop shells use the Lair's translator as well.
  const embeddedTexts = ['atelier', 'alchemy'].flatMap(id =>
    codeFileTexts(join(root, '../../workshops', id, 'src/embedding.js')));
  const texts = new Set([...htmlTexts(readFileSync(join(root, 'index.html'), 'utf8')), ...codeTexts(), ...embeddedTexts]);
  assert.ok(texts.size > 100, 'the extraction finds the page texts');
  const missing = [...texts].filter(text => !(text in en));
  assert.deepEqual(missing, [], 'add these to src/locales/en.js');
  const unused = Object.keys(en).filter(text => !texts.has(text));
  assert.deepEqual(unused, [], 'these English entries are no longer used');
});

test('translations fill placeholders and fall back to Russian', () => {
  const english = createTranslator({ dictionaries: { en }, language: 'en' });
  assert.equal(english.t('ЗАГРУЖАЕМ КАРТИНЫ · {loaded} / {total}', { loaded: 3, total: 30 }), 'LOADING PAINTINGS · 3 / 30');
  assert.equal(english.t('Текст без перевода'), 'Текст без перевода');
  const russian = createTranslator({ dictionaries: { en }, language: 'ru' });
  assert.equal(russian.t('ЗАГРУЖАЕМ КАРТИНЫ · {loaded} / {total}', { loaded: 3, total: 30 }), 'ЗАГРУЖАЕМ КАРТИНЫ · 3 / 30');
});
