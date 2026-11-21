// @ts-check
import { createTranslator } from '../../../core/i18n/translator.js';
import en from './locales/en.js';

// The lab's texts in the player's language: the same saved choice as the Lair
// and the Key Archive (core/i18n). Russian is the key; see locales/en.js.
export const translator = createTranslator({ dictionaries: { en } });
export const { t } = translator;
