// @ts-check
// The Lair's single way back: one button in one place for every mode. Inside
// a workshop (the Atelier, the lab, the workbench) it reads "В логово"; in the
// room (a zone or a walk) it reads "Общий вид"; at the overview it is hidden.
// Its click is wired by zone-transitions.js (resetView).

const WORKSHOP_ZONES = new Set(['atelier', 'alchemy', 'workbench']);

/** @param {{ button: HTMLButtonElement, t: (text: string) => string }} options */
export function createReturnButton({ button, t }) {
  let shown = '';
  return {
    /** @param {{ zone: string | null, walking: boolean, overlayOpen: boolean }} state */
    update({ zone, walking, overlayOpen }) {
      const inWorkshop = overlayOpen || WORKSHOP_ZONES.has(zone ?? '');
      const mode = inWorkshop ? 'lair' : zone || walking ? 'overview' : 'hidden';
      if (mode === shown) return;
      shown = mode;
      button.hidden = mode === 'hidden';
      if (mode === 'hidden') return;
      const [arrow, label, aria] = mode === 'lair'
        ? ['←', t('В ЛОГОВО'), t('Вернуться в логово')]
        : ['↺', t('ОБЩИЙ ВИД'), t('Общий вид')];
      button.replaceChildren(`${arrow} `, Object.assign(document.createElement('span'), { textContent: label }));
      button.setAttribute('aria-label', aria);
    },
  };
}
