import ru from './locales/ru.js?v=room-music';
import en from './locales/en.js?v=room-music';

// Translations for every player-facing text of the archive.
//  * Code: t('toast.keyPlaced'), t('toast.picked', { name }) with {placeholders}.
//  * Markup: data-i18n="key" (text), data-i18n-html="key" (markup inside),
//    data-i18n-attr="aria-label:key;title:key" (attributes).
//  * A new language: add locales/<code>.js with the same keys and list it in
//    LANGUAGES. Missing keys fall back to Russian, then to the key itself.
// Switching language reloads the page, so canvas labels (cabinet signs) and
// every cached string are rebuilt in the new language.

export const LANGUAGES = Object.freeze({ ru: 'Русский', en: 'English' });
const DICTIONARIES = Object.freeze({ ru, en });
export const LANGUAGE_STORAGE_KEY = 'keynlock-language';

function detectLanguage() {
  try {
    const saved = globalThis.localStorage?.getItem(LANGUAGE_STORAGE_KEY);
    if (saved && DICTIONARIES[saved]) return saved;
  } catch { /* storage may be unavailable */ }
  const preferred = String(globalThis.navigator?.language || 'ru').slice(0, 2).toLowerCase();
  return DICTIONARIES[preferred] ? preferred : 'ru';
}

let language = detectLanguage();

export function getLanguage() { return language; }

export function t(key, params = {}) {
  const text = DICTIONARIES[language]?.[key] ?? DICTIONARIES.ru[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match));
}

// Family names come from the key's stable id (KEY_TYPES[type].id).
const FAMILY_IDS = ['circle', 'triangle', 'square', 'diamond', 'pentagon', 'hexagon', 'star', 'clover', 'oval', 'crown'];
export function familyName(type) { return t(`family.${FAMILY_IDS[type] ?? type}`); }

export function setLanguage(code, { reload = true } = {}) {
  if (!DICTIONARIES[code] || code === language) return false;
  language = code;
  try { globalThis.localStorage?.setItem(LANGUAGE_STORAGE_KEY, code); } catch { /* keep for this session */ }
  if (reload) globalThis.location?.reload();
  return true;
}

export function applyTranslations(root = globalThis.document) {
  if (!root) return;
  if (root.documentElement) root.documentElement.lang = language;
  for (const element of root.querySelectorAll('[data-i18n]')) element.textContent = t(element.dataset.i18n);
  for (const element of root.querySelectorAll('[data-i18n-html]')) element.innerHTML = t(element.dataset.i18nHtml);
  for (const element of root.querySelectorAll('[data-i18n-attr]')) {
    for (const pair of element.dataset.i18nAttr.split(';')) {
      const [attribute, key] = pair.split(':').map(part => part.trim());
      if (attribute && key) element.setAttribute(attribute, t(key));
    }
  }
}

export function missingKeys(code) {
  return Object.keys(DICTIONARIES.ru).filter(key => !(key in (DICTIONARIES[code] || {})));
}
