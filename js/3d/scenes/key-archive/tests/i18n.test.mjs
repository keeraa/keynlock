import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ru from '../dist/js/locales/ru.js';
import en from '../dist/js/locales/en.js';
import { t, familyName, LANGUAGES, missingKeys, setLanguage, getLanguage } from '../dist/js/i18n.js';

test('every language has every key and keeps the same placeholders', () => {
  for (const code of Object.keys(LANGUAGES)) assert.deepEqual(missingKeys(code), [], code);
  for (const key of Object.keys(ru)) {
    const names = text => (text.match(/\{\w+\}/g) || []).sort().join();
    assert.equal(names(en[key]), names(ru[key]), key);
  }
});

test('t() fills placeholders, falls back to Russian, then to the key', () => {
  // Node reports navigator.language too; start from Russian explicitly.
  setLanguage('ru', { reload: false });
  assert.equal(getLanguage(), 'ru');
  assert.equal(t('toast.wrongCabinet', { name: 'Садовый' }), 'Это шкаф для ключей «Садовый»');
  assert.equal(t('no.such.key'), 'no.such.key');
  assert.equal(familyName(7), 'Садовый');
  setLanguage('en', { reload: false });
  assert.equal(t('toast.wrongCabinet', { name: familyName(7) }), 'This cabinet is for "Garden" keys');
  setLanguage('ru', { reload: false });
});

test('player-facing modules have no hard-coded Russian left', () => {
  const files = ['archive-actions.js', 'archive-interaction-prompts.js', 'archive-hud.js',
    'archive-first-route-guide.js', 'archive-bath-progress.js', 'performance-hud.js', 'main.js'];
  for (const file of files) {
    const code = readFileSync(new URL(`../dist/js/${file}`, import.meta.url), 'utf8')
      .split('\n').filter(line => !/^\s*\/\//.test(line) && !/console\.(warn|error|log)/.test(line)).join('\n');
    assert.doesNotMatch(code, /['"`][^'"`\n]*[А-Яа-яЁё][^'"`\n]*['"`]/, file);
  }
  const page = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
  assert.ok((page.match(/data-i18n/g) || []).length > 50);
  assert.match(page, /<select id="language"/);
});
