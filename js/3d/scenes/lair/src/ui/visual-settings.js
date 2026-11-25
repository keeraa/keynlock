import * as THREE from 'three';
import { t } from '../i18n.js';

const STORAGE_KEY = 'keynlock-lair-visual-v1';
const DEFAULTS = Object.freeze({
  'paint-saturation': 100, 'paint-contrast': 100, 'paint-scale': 100, 'paint-grain': 13,
  'metal-finish': 'original', 'metal-roughness': 50, 'metal-metalness': 65,
  wallpaper: 'tile', 'wall-tile': 'sage', 'outline-enabled': true, 'outline-width': 65,
  'dust-enabled': true, 'dust-density': 65, 'window-light': 100, 'night-lighting': false,
  'quality-mode': 'auto', 'fps-cap': false,
});

/** Compact live materials lab. All controls affect materials, geometry or Three.js particles. */
export function mountVisualSettings({ visual, room, quality = null, setNight = null, outlines, grain, onOpenChange = () => {} }) {
  const panel = document.querySelector('#lair-visual-panel');
  const toggle = document.querySelector('#lair-visual-toggle');
  const inputs = [...document.querySelectorAll('[data-visual-setting]')];
  const papers = [...document.querySelectorAll('[data-wallpaper]')];
  const allowedPapers = new Set(papers.map(button => button.dataset.wallpaper));
  let state = { ...DEFAULTS };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
      for (const input of inputs) {
        if (!(input.id in saved)) continue;
        if (input.type === 'checkbox' && typeof saved[input.id] === 'boolean') state[input.id] = saved[input.id];
        else if (input.tagName === 'SELECT' && [...input.options].some(option => option.value === saved[input.id])) state[input.id] = saved[input.id];
        else if (input.type === 'range' && Number.isFinite(Number(saved[input.id]))) {
          state[input.id] = THREE.MathUtils.clamp(Number(saved[input.id]), Number(input.min), Number(input.max));
        }
      }
      if (allowedPapers.has(saved.wallpaper)) state.wallpaper = saved.wallpaper;
      if (['sage', 'ochre', 'slate'].includes(saved['wall-tile'])) state['wall-tile'] = saved['wall-tile'];
    }
  } catch { /* Private mode can prohibit storage; live controls still work. */ }

  const persist = () => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* optional */ }
  };
  const refreshControls = () => {
    for (const input of inputs) {
      if (input.type === 'checkbox') input.checked = state[input.id];
      else input.value = state[input.id];
      const output = document.querySelector(`#${input.id}-output`);
      if (output) output.textContent = `${state[input.id]}%`;
    }
    papers.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.wallpaper === state.wallpaper)));
  };
  const apply = () => {
    visual.setPaintSettings({
      saturation: state['paint-saturation'], contrast: state['paint-contrast'], scale: state['paint-scale'],
    });
    visual.setMetalSettings({
      roughness: state['metal-roughness'], metalness: state['metal-metalness'], palette: state['metal-finish'],
    });
    visual.setTileColour?.(state['wall-tile']);
    room.setRightWallpaper(state.wallpaper);
    room.ambientParticles.setEnabled(state['dust-enabled']);
    room.ambientParticles.setDensity(state['dust-density'] / 100);
    room.windowLight?.setStrength(state['window-light'] / 100);
    setNight?.(state['night-lighting']);
    quality?.setMode(state['quality-mode']);
    quality?.setFpsCap(state['fps-cap']);
    outlines.setEnabled(state['outline-enabled']);
    outlines.setWidth(state['outline-width']);
    grain.style.opacity = `${state['paint-grain'] / 100}`;
    refreshControls();
  };
  for (const input of inputs) {
    input.addEventListener('input', () => {
      state[input.id] = input.type === 'checkbox' ? input.checked : input.type === 'range' ? Number(input.value) : input.value;
      apply(); persist();
    });
  }
  for (const paper of papers) paper.addEventListener('click', () => {
    state.wallpaper = paper.dataset.wallpaper;
    apply(); persist();
  });
  const closeButton = document.querySelector('#lair-visual-close');
  const setOpen = open => {
    if (open === !panel.hidden) return;
    const restoreFocus = !open && panel.contains(document.activeElement);
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    onOpenChange(open);
    if (open) closeButton.focus({ preventScroll: true });
    else if (restoreFocus) toggle.focus({ preventScroll: true });
  };
  const close = () => setOpen(false);
  toggle.addEventListener('click', () => setOpen(panel.hidden));
  closeButton.addEventListener('click', close);
  document.querySelector('#visual-reset').addEventListener('click', () => {
    state = { ...DEFAULTS }; apply(); persist();
  });
  document.addEventListener('pointerdown', event => {
    if (!panel.hidden && !panel.contains(event.target) && !toggle.contains(event.target)) close();
  });
  // What auto (or the chosen level) is drawing right now.
  const levelNames = { high: t('Высокое'), medium: t('Среднее'), low: t('Низкое'), minimal: t('Минимальное') };
  const qualityNow = document.querySelector('#quality-now');
  quality?.subscribe(current => {
    if (!qualityNow) return;
    const ratio = Math.round(current.pixelRatio * 100) / 100;
    qualityNow.textContent = `${levelNames[current.level]} · ${ratio}×`;
  });
  apply();
  /** The lab's «Фон мастерской»: the right wall in that tile colour (saved). */
  function setWallTile(colour) {
    if (!['sage', 'ochre', 'slate'].includes(colour)) return;
    state['wall-tile'] = colour;
    state.wallpaper = 'tile';
    apply(); refreshControls(); persist();
  }
  return { setOpen, close, isOpen: () => !panel.hidden, state: () => ({ ...state }), setWallTile };
}
