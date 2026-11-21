// @ts-check
import { paintingLoreRu, paintingLoreLabelsRu } from './locales/ru.js';
import { paintingLoreLabelsEn } from './locales/en.js';
import { translator } from '../i18n.js';

// Add a new language in locales/ and register it here. An untranslated entry
// automatically falls back to Russian, so a partial translation is safe.
const catalogs = { ru: paintingLoreRu };
const labelCatalogs = { ru: paintingLoreLabelsRu, en: paintingLoreLabelsEn };

/** The player's language (core/i18n); painting texts not yet translated stay Russian. */
export const DEFAULT_LORE_LANGUAGE = translator.language;
export const availableLoreLanguages = Object.freeze(Object.keys(catalogs));

export function getPaintingLore(paintingId, language = DEFAULT_LORE_LANGUAGE) {
  const russian = catalogs.ru[paintingId];
  const translated = catalogs[language]?.[paintingId];
  return russian || translated ? { ...russian, ...translated } : null;
}

export function getPaintingLoreLabels(language = DEFAULT_LORE_LANGUAGE) {
  return { ...labelCatalogs.ru, ...labelCatalogs[language] };
}
