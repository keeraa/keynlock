import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTranslator, normalizeText } from '../../../core/i18n/translator.js';
import en from '../src/locales/en.js';
import alchemyEn from '../../../workshops/alchemy/src/locales/en.js';
import atelierEn from '../../../workshops/atelier/src/locales/en.js';
import paintingsEn, { englishYear } from '../../../workshops/atelier/src/locales/paintings-en.js';
import { keynlockPaintings } from '../../../workshops/atelier/src/painting-catalog.js';

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

/** Every Russian string literal in a file: in a workshop all of them are shown to the player. */
function literalTexts(path) {
  return [...readFileSync(path, 'utf8').replace(/^\s*\/\/.*$/gm, '')
    .matchAll(/'((?:[^'\\\n]|\\.)*)'|`([^`$\n]*)`/g)]
    .map(([, quoted, template]) => normalizeText(quoted ?? template ?? '')).filter(text => CYRILLIC.test(text));
}

/** Every t('…') call in the Lair's code. */
function codeTexts(dir = join(root, 'src'), read = codeFileTexts) {
  const texts = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) { if (name !== 'locales') texts.push(...codeTexts(path, read)); continue; }
    if (!name.endsWith('.js')) continue;
    texts.push(...read(path));
  }
  return texts;
}

test('every Russian text of the Lair page and code has an English translation', () => {
  const texts = new Set([...htmlTexts(readFileSync(join(root, 'index.html'), 'utf8')), ...codeTexts()]);
  assert.ok(texts.size > 100, 'the extraction finds the page texts');
  const missing = [...texts].filter(text => !(text in en));
  assert.deepEqual(missing, [], 'add these to src/locales/en.js');
  const unused = Object.keys(en).filter(text => !texts.has(text));
  assert.deepEqual(unused, [], 'these English entries are no longer used');
});

// Not player text: a Russian keyboard letter and a grammar rule for Russian names.
const ALCHEMY_NOT_TEXT = new Set(['к', 'ый', 'ий', 'ая', 'яя']);

test('every Russian text of the alchemy lab has an English translation', () => {
  const lab = join(root, '../../workshops/alchemy');
  const texts = new Set([...htmlTexts(readFileSync(join(lab, 'index.html'), 'utf8')),
    ...codeTexts(join(lab, 'src'), literalTexts)].filter(text => !ALCHEMY_NOT_TEXT.has(text)));
  assert.ok(texts.size > 150, 'the extraction finds the lab texts');
  const missing = [...texts].filter(text => !(text in alchemyEn));
  assert.deepEqual(missing, [], 'add these to workshops/alchemy/src/locales/en.js');
  const unused = Object.keys(alchemyEn).filter(text => !texts.has(text));
  assert.deepEqual(unused, [], 'these English entries are no longer used');
});

test('every Russian text of the Atelier has an English translation', () => {
  const atelier = join(root, '../../workshops/atelier');
  const texts = new Set([...htmlTexts(readFileSync(join(atelier, 'index.html'), 'utf8')),
    ...codeTexts(join(atelier, 'src'))]);
  assert.ok(texts.size > 200, 'the extraction finds the Atelier texts');
  const missing = [...texts].filter(text => !(text in atelierEn));
  assert.deepEqual(missing, [], 'add these to workshops/atelier/src/locales/en.js');
  const unused = Object.keys(atelierEn).filter(text => !texts.has(text));
  assert.deepEqual(unused, [], 'these English entries are no longer used');
});

test('every painting has an English title, artist and year', () => {
  assert.deepEqual(keynlockPaintings.map(art => art.id).filter(id => !paintingsEn[id]), []);
  const years = keynlockPaintings.map(art => englishYear(art.year)).filter(year => CYRILLIC.test(year));
  assert.deepEqual(years, [], 'englishYear() should cover every date form');
  assert.equal(englishYear('конец XVIII века'), 'late 18th century');
  assert.equal(englishYear('XIII век'), '13th century');
  assert.equal(englishYear('ок. 1830–1832'), 'c. 1830–1832');
  assert.equal(englishYear('1480-е'), '1480s');
});

test('translations fill placeholders and fall back to Russian', () => {
  const english = createTranslator({ dictionaries: { en }, language: 'en' });
  assert.equal(english.t('ЗАГРУЖАЕМ КАРТИНЫ · {loaded} / {total}', { loaded: 3, total: 30 }), 'LOADING PAINTINGS · 3 / 30');
  assert.equal(english.t('Текст без перевода'), 'Текст без перевода');
  const russian = createTranslator({ dictionaries: { en }, language: 'ru' });
  assert.equal(russian.t('ЗАГРУЖАЕМ КАРТИНЫ · {loaded} / {total}', { loaded: 3, total: 30 }), 'ЗАГРУЖАЕМ КАРТИНЫ · 3 / 30');
});
