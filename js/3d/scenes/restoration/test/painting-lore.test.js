import test from 'node:test';
import assert from 'node:assert/strict';
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
