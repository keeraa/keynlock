import test from 'node:test';
import assert from 'node:assert/strict';
import { createVisualPanel } from '../dist/js/visual-panel.js';
import { DEFAULT_VISUAL_SETTINGS } from '../dist/js/visual-settings.js';

test('visual panel has one settings owner for controls, renderer and persistence', () => {
  const controls = new Map();
  for (const [key, value] of Object.entries(DEFAULT_VISUAL_SETTINGS)) {
    controls.set(key, { type: typeof value === 'boolean' ? 'checkbox' : 'range',
      value, checked: Boolean(value), addEventListener(event, callback) { this.listener = callback; } });
  }
  for (const id of ['visual-reset', 'visual-natural']) controls.set(id, {
    addEventListener(event, callback) { this.listener = callback; },
  });
  const document = { getElementById: id => controls.get(id), querySelector: () => null };
  const saved = new Map();
  const storage = { setItem: (key, value) => saved.set(key, value) };
  let applied;
  const world = { setVisualSettings(settings) { applied = settings; } };
  const panel = createVisualPanel(document, world, storage, DEFAULT_VISUAL_SETTINGS);
  panel.bind();
  controls.get('outlineStrength').listener({ target: { value: '12' } });
  assert.equal(applied.outlineStrength, 12);
  assert.equal(panel.getSettings().outlineStrength, 12);
  assert.ok(saved.size > 0);
  controls.get('visual-reset').listener();
  assert.equal(panel.getSettings().outlineStrength, DEFAULT_VISUAL_SETTINGS.outlineStrength);
});

test('shadow hatching is off by default and toggles from the settings panel', async () => {
  const { normalizeVisualSettings, visualPassNeeded } = await import('../dist/js/visual-settings.js');
  assert.equal(DEFAULT_VISUAL_SETTINGS.hatchShadows, false);
  assert.equal(normalizeVisualSettings({ hatchShadows: true }).hatchShadows, true);
  assert.equal(normalizeVisualSettings({ hatchShadows: 'yes' }).hatchShadows, false);
  assert.equal(visualPassNeeded({ ...DEFAULT_VISUAL_SETTINGS, toonEnabled: false, outlineEnabled: false, hatchShadows: true }), true);
  const controls = new Map();
  for (const [key, value] of Object.entries(DEFAULT_VISUAL_SETTINGS)) {
    controls.set(key, { type: typeof value === 'boolean' ? 'checkbox' : 'range',
      value, checked: Boolean(value), addEventListener(event, callback) { this.listener = callback; } });
  }
  for (const id of ['visual-reset', 'visual-natural']) controls.set(id, { addEventListener(event, callback) { this.listener = callback; } });
  let applied;
  const panel = createVisualPanel({ getElementById: id => controls.get(id), querySelector: () => null },
    { setVisualSettings(settings) { applied = settings; } }, { setItem() {} }, DEFAULT_VISUAL_SETTINGS);
  panel.bind();
  controls.get('hatchShadows').listener({ target: { checked: true } });
  assert.equal(applied.hatchShadows, true);
});
