// @ts-check
import { createTranslator } from '../../../core/i18n/translator.js';
import en from './locales/en.js';
import paintingsEn, { englishYear } from './locales/paintings-en.js';

// The Atelier's texts in the player's language: the same saved choice as the
// Lair and the Key Archive (core/i18n). Russian is the key; see locales/.
export const translator = createTranslator({ dictionaries: { en } });
export const { t } = translator;

/** A painting record with its title, short title, artist and year in the player's language. */
export function localizePainting(art) {
  if (translator.language !== 'en') return art;
  const [title, artist, short] = paintingsEn[art.id] ?? [];
  return {
    ...art,
    title: title ?? art.title, artist: artist ?? art.artist,
    ...(art.short !== undefined ? { short: short ?? title ?? art.short } : {}),
    year: englishYear(art.year),
  };
}
