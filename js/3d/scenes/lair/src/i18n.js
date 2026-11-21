// @ts-check
// The Lair's texts are written in Russian; locales/<code>.js translate them.
// See core/i18n/translator.js. Switching language reloads the page.
import { createTranslator, LANGUAGE_NAMES, saveLanguage } from '../../../core/i18n/translator.js';
import en from './locales/en.js';

export const DICTIONARIES = Object.freeze({ en });
export const translator = createTranslator({ dictionaries: DICTIONARIES });
export const t = translator.t;

/** Fill the language selector; choosing a language saves it and reloads the page. */
export function bindLanguageSelect(/** @type {HTMLSelectElement | null} */ select) {
  if (!select) return;
  for (const [code, name] of Object.entries(LANGUAGE_NAMES))
    select.add(new Option(name, code, false, code === translator.language));
  select.addEventListener('change', () => {
    saveLanguage(select.value);
    window.location.reload();
  });
}
