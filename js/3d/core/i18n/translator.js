// @ts-check
/**
 * A small gettext-style translator for Russian-first scenes: the Russian text
 * is the key, and each other language is a dictionary from that text to its
 * translation. A missing entry falls back to the Russian text, so a partial
 * translation is safe.
 *
 *   t('ЗАГРУЖАЕМ КАРТИНЫ · {loaded} / {total}', { loaded, total })
 *
 * The language choice is shared with the Key Archive (same storage key).
 */
export const LANGUAGE_STORAGE_KEY = 'keynlock-language';
export const LANGUAGE_NAMES = Object.freeze({ ru: 'Русский', en: 'English' });

/** Attributes that carry visible or spoken text. */
const TEXT_ATTRIBUTES = ['aria-label', 'title', 'placeholder', 'alt'];
const CYRILLIC = /[А-Яа-яЁё]/;

/** Collapse whitespace the way a page shows it, so markup line breaks do not matter. */
export const normalizeText = (/** @type {string} */ text) => text.replace(/\s+/g, ' ').trim();

/**
 * @param {{ dictionaries: Record<string, Record<string, string>>, language?: string }} options
 *   dictionaries: one per non-Russian language; language: forced (tests), else detected.
 */
export function createTranslator({ dictionaries, language = detectLanguage(dictionaries) }) {
  const dictionary = language === 'ru' ? {} : dictionaries[language] ?? {};

  /** Translate one Russian text, filling {name} placeholders from params. */
  function t(/** @type {string} */ text, /** @type {Record<string, unknown>} */ params = {}) {
    const translated = dictionary[normalizeText(text)] ?? text;
    return translated.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match));
  }

  /** Translate the text nodes and text attributes under root, in place. */
  function translateTree(/** @type {ParentNode & Node} */ root) {
    if (language === 'ru') return;
    const doc = root.ownerDocument ?? /** @type {Document} */ (root);
    const walker = doc.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const value = node.nodeValue ?? '';
      if (!CYRILLIC.test(value)) continue;
      const key = normalizeText(value);
      if (!(key in dictionary)) continue;
      // Keep the spaces that separate the text from neighbouring elements.
      const before = /^\s/.test(value) ? ' ' : '';
      const after = /\s$/.test(value) ? ' ' : '';
      node.nodeValue = before + dictionary[key] + after;
    }
    for (const element of root.querySelectorAll('*')) {
      for (const name of TEXT_ATTRIBUTES) {
        const value = element.getAttribute(name);
        if (value && CYRILLIC.test(value) && normalizeText(value) in dictionary)
          element.setAttribute(name, dictionary[normalizeText(value)]);
      }
    }
  }

  return { language, t, translateTree };
}

/** The saved choice, else the browser's language when it is supported, else Russian. */
export function detectLanguage(/** @type {Record<string, unknown>} */ dictionaries) {
  try {
    const saved = globalThis.localStorage?.getItem(LANGUAGE_STORAGE_KEY);
    if (saved === 'ru' || (saved && dictionaries[saved])) return saved;
  } catch { /* storage may be unavailable */ }
  const preferred = String(globalThis.navigator?.language || 'ru').slice(0, 2).toLowerCase();
  return dictionaries[preferred] ? preferred : 'ru';
}

/** Save the choice; the caller reloads so every cached string is rebuilt. */
export function saveLanguage(/** @type {string} */ code) {
  try { globalThis.localStorage?.setItem(LANGUAGE_STORAGE_KEY, code); } catch { /* not saved */ }
}
