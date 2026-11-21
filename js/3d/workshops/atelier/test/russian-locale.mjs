// The unit tests read Russian texts. Node reports the system's language
// (often en-US), which the game would follow; pin it to Russian here.
Object.defineProperty(globalThis, 'navigator', { value: { language: 'ru-RU' }, configurable: true });
