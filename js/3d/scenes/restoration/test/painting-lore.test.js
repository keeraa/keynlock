import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { paintings } from '../src/atelier-config.js';
import { paintingLoreRu } from '../src/lore/locales/ru.js';
import { getPaintingLore, getPaintingLoreLabels, availableLoreLanguages } from '../src/lore/painting-lore.js';

test('all 180 catalog paintings have unique, individually editable Russian descriptions and ban reasons', () => {
  const paintingIds = paintings.map((art) => art.id);
  assert.equal(paintingIds.length, 180);
  assert.equal(new Set(paintingIds).size, paintings.length);
  assert.deepEqual(new Set(Object.keys(paintingLoreRu)), new Set(paintingIds));
  for (const id of paintingIds) {
    const lore = getPaintingLore(id);
    assert.ok(lore.description.length >= 18, `Missing description for ${id}`);
    assert.ok(lore.banReason.length >= 18, `Missing ban reason for ${id}`);
  }
});

test('censorship allegations match the four agreed examples', () => {
  assert.equal(getPaintingLore('rococo-mezzetin').banReason, 'Пропаганда лености и похотливости.');
  assert.equal(getPaintingLore('rokeby-venus').banReason, 'Пропаганда самолюбования.');
  assert.equal(getPaintingLore('creation-of-adam').banReason, 'Пропаганда эротики.');
  assert.equal(getPaintingLore('galaxy-musicians').banReason, 'Пропаганда праздности.');
});

test('locale API retains Russian fallback and localized UI badge labels', () => {
  assert.deepEqual(availableLoreLanguages, ['ru']);
  assert.deepEqual(getPaintingLore('great-wave', 'en'), getPaintingLore('great-wave', 'ru'));
  assert.equal(getPaintingLore('unknown-painting'), null);
  assert.equal(getPaintingLoreLabels('en').banned, 'ЗАПРЕЩЕНО В КИЙЕНЛОКЕ');
});

test('the Chamber of Images excuses censorship as a state happiness program', () => {
  const labels = getPaintingLoreLabels();
  assert.match(labels.policy, /МЫ СДЕЛАЕМ ВАС СЧАСТЛИВЫМИ/);
  assert.match(labels.policyExplanation, /здоровья.*нравственности.*спокойствия/);
  assert.match(getPaintingLore('treachery-images').banReason, /курения/);
  assert.match(getPaintingLore('absinthe').banReason, /алкоголя/);
  assert.match(getPaintingLore('judith-holofernes').banReason, /насилия/);
  assert.match(getPaintingLore('shakuntala').banReason, /однополой любви/);
  assert.match(getPaintingLore('rococo-diana-bath').banReason, /зоофилии/);
  assert.match(getPaintingLore('rococo-triumph-venus').banReason, /оргий/);
  assert.match(getPaintingLore('rococo-venus-toilet').banReason, /животными/);
  assert.match(getPaintingLore('han-palace').banReason, /арфа.*фаллическим/);
  assert.match(getPaintingLore('the-sin').banReason, /эротики/);
});

test('gallery keeps artwork lore below the left-side painting heading', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const headingStart = html.indexOf('class="wall-gallery-heading"');
  const titleIndex = html.indexOf('id="wall-gallery-title"', headingStart);
  const captionIndex = html.indexOf('id="wall-gallery-caption"', headingStart);
  const loreIndex = html.indexOf('id="wall-art-lore"', headingStart);
  const toolbarActionsIndex = html.indexOf('class="wall-gallery-actions"', headingStart);
  assert.ok(headingStart >= 0 && titleIndex > headingStart && captionIndex > titleIndex);
  assert.ok(loreIndex > captionIndex && toolbarActionsIndex > loreIndex);
  assert.equal(html.match(/id="wall-art-lore"/g)?.length, 1);
});
