import * as THREE from 'three';
import { createInkOutlines } from '../rendering/ink-outlines.js';

const STORAGE_KEY = 'keynlock-lair-visual-v1';
const DEFAULTS = Object.freeze({
  'paint-saturation': 100, 'paint-contrast': 100, 'paint-scale': 100, 'paint-grain': 13,
  'metal-finish': 'original', 'metal-roughness': 50, 'metal-metalness': 65,
  wallpaper: 'tile', 'outline-enabled': true, 'outline-width': 65,
  'dust-enabled': true, 'dust-density': 65, 'window-light': 100, 'night-lighting': false,
});

/** Reuse Village Engine's ink silhouette shader on room objects of manageable size. */
export function createRoomOutlines(scene) {
  const ink = createInkOutlines(THREE, { enabled: true, color: 0x2b241d, screenWidth: .0031 });
  const shells = [];
  let enabled = true, width = .65;
  const applyShell = shell => {
    shell.visible = enabled;
    if (shell.material?.uniforms?.strokeScale) shell.material.uniforms.strokeScale.value = width;
  };
  /** Outline these named objects too, with the current settings (the Atelier's furniture loads later). */
  function attach(names) {
    for (const name of names) {
      const object = scene.getObjectByName(name);
      if (!object || !ink.attach(object, { registrationOffset: [.00008, -.00011], strokeScale: .65 })) continue;
      object.traverse(child => {
        if (child.userData?.inkOutlineShell && child.isMesh && !shells.includes(child)) {
          shells.push(child);
          applyShell(child);
        }
      });
    }
  }
  attach(['main-arched-window', 'planning-main-table', 'workbench-right-of-alchemy', 'gramophone-table']);
  return {
    shells,
    attach,
    setEnabled(value) { enabled = Boolean(value); shells.forEach(applyShell); },
    setWidth(percent) {
      width = THREE.MathUtils.clamp(Number(percent) || 0, 20, 140) / 100;
      shells.forEach(applyShell);
    },
    dispose() { ink.dispose(); },
  };
}

/** Compact live materials lab. All controls affect materials, geometry or Three.js particles. */
export function mountVisualSettings({ visual, room, setNight = null, outlines, grain, onOpen = () => {} }) {
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
    room.setRightWallpaper(state.wallpaper);
    room.ambientParticles.setEnabled(state['dust-enabled']);
    room.ambientParticles.setDensity(state['dust-density'] / 100);
    room.windowLight?.setStrength(state['window-light'] / 100);
    setNight?.(state['night-lighting']);
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
  const close = () => { panel.hidden = true; toggle.setAttribute('aria-expanded', 'false'); };
  const open = () => {
    onOpen(); panel.hidden = false; toggle.setAttribute('aria-expanded', 'true');
  };
  toggle.addEventListener('click', () => panel.hidden ? open() : close());
  document.querySelector('#lair-visual-close').addEventListener('click', close);
  document.querySelector('#visual-reset').addEventListener('click', () => {
    state = { ...DEFAULTS }; apply(); persist();
  });
  document.addEventListener('pointerdown', event => {
    if (!panel.hidden && !panel.contains(event.target) && !toggle.contains(event.target)) close();
  });
  apply();
  return { close, isOpen: () => !panel.hidden, state: () => ({ ...state }) };
}
