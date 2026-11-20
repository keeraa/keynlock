import { DEFAULT_VISUAL_SETTINGS, normalizeVisualSettings } from './visual-settings.js?v=clear-day';
import { saveVisualSettings } from './archive-save-state-with-route.js?v=single-source';

export function createVisualPanel(document, world, storage, initialSettings) {
  const $ = id => document.getElementById(id);
  let settings = normalizeVisualSettings(initialSettings);

  function render() {
    for (const [key, value] of Object.entries(settings)) {
      const control = $(key);
      if (!control) continue;
      if (control.type === 'checkbox') control.checked = value;
      else control.value = value;
      const output = document.querySelector(`output[for="${key}"]`);
      if (output) output.textContent = key === 'toonSteps' ? String(value) : `${value}%`;
    }
  }

  function apply(next) {
    settings = normalizeVisualSettings(next);
    world.setVisualSettings(settings);
    render();
    saveVisualSettings(storage, settings);
  }

  function bind() {
    $('visual-reset').addEventListener('click', () => apply(DEFAULT_VISUAL_SETTINGS));
    $('visual-natural').addEventListener('click', () => apply({ ...settings,
      toonEnabled: false, outlineEnabled: false }));
    for (const key of Object.keys(DEFAULT_VISUAL_SETTINGS)) {
      const control = $(key);
      if (!control) continue;
      control.addEventListener(control.type === 'checkbox' ? 'change' : 'input', event => {
        apply({ ...settings, [key]: control.type === 'checkbox' ? event.target.checked : Number(event.target.value) });
      });
    }
    render();
  }
  return { bind, apply, getSettings: () => ({ ...settings }) };
}
