// @ts-check
import { paintingLoreRu, paintingLoreLabelsRu } from './locales/ru.js';

// Add a new language in locales/ and register it here. An untranslated entry
// automatically falls back to Russian, so a partial translation is safe.
const catalogs = { ru: paintingLoreRu };
const labelCatalogs = { ru: paintingLoreLabelsRu };

export const DEFAULT_LORE_LANGUAGE = 'ru';
export const availableLoreLanguages = Object.freeze(Object.keys(catalogs));

export function getPaintingLore(paintingId, language = DEFAULT_LORE_LANGUAGE) {
  const russian = catalogs.ru[paintingId];
  const translated = catalogs[language]?.[paintingId];
  return russian || translated ? { ...russian, ...translated } : null;
}

export function getPaintingLoreLabels(language = DEFAULT_LORE_LANGUAGE) {
  return { ...labelCatalogs.ru, ...labelCatalogs[language] };
}
