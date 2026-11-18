import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from '../dist/vendor/three.js';
import {
  DEFAULT_VISUAL_SETTINGS, normalizeVisualSettings, visualPassNeeded,
} from '../dist/js/visual-settings.js';
import { createWetSnow } from '../dist/js/wet-snow.js';
import { logicalKey } from '../dist/js/controls.js';

test('KEYNLOCK visual preset retains toon, ink and weather values', () => {
  const settings = normalizeVisualSettings(null);
  assert.equal(settings.toonLight, 80);
  assert.equal(settings.toonSteps, 4);
  assert.equal(settings.outlineStrength, 70);
  assert.equal(settings.outlineWidth, 1);
  assert.equal(settings.outlineSensitivity, 50);
  assert.equal(settings.cartoonMaterial, 90);
  assert.equal('brushExpression' in settings, false);
  assert.equal('strokeDetail' in settings, false);
  assert.equal('brushExpression' in normalizeVisualSettings({ brushExpression: 100, strokeDetail: 100 }), false);
  assert.equal(settings.wetSnowEnabled, true);
  assert.equal(settings.windowDaylight, 75);
});

test('visual controls reject invalid saved values and keep switches independent', () => {
  const settings = normalizeVisualSettings({ toonLight: 120, toonSteps: -2, outlineStrength: 'bad',
    outlineWidth: 99, outlineSensitivity: 140, snowWind: -200, snowIntensity: 12.1,
    windowDaylight: 150, toonEnabled: false,
    outlineEnabled: false, brushExpression: 99 });
  assert.equal(settings.toonLight, 100);
  assert.equal(settings.toonSteps, 2);
  assert.equal(settings.outlineStrength, 70);
  assert.equal(settings.outlineWidth, 4);
  assert.equal(settings.outlineSensitivity, 100);
  assert.equal(settings.snowWind, -100);
  assert.equal(settings.snowIntensity, 12);
  assert.equal(settings.windowDaylight, 100);
  assert.equal(visualPassNeeded(settings), false);
  assert.equal(visualPassNeeded(normalizeVisualSettings({ toonEnabled: false })), true);
  assert.equal(DEFAULT_VISUAL_SETTINGS.toonLight, 80);
});

test('visual panel shortcut works in English and Russian keyboard layouts', () => {
  assert.equal(logicalKey({ code: 'KeyV', key: 'v' }), 'v');
  assert.equal(logicalKey({ code: 'Unidentified', key: 'м' }), 'v');
});

test('wet snow is shared across the windowpanes and can be turned off instantly', () => {
  const snow = createWetSnow();
  const windows = [new THREE.Group(), new THREE.Group(), new THREE.Group()];
  for (const windowGroup of windows) snow.addToWindow(windowGroup);
  assert.equal(windows[0].children[0].geometry, windows[1].children[0].geometry);
  assert.equal(windows[0].children[0].material, windows[2].children[0].material);
  snow.setSettings(normalizeVisualSettings({ snowWind: -40, snowIntensity: 80 }));
  assert.equal(windows[0].children[0].material.uniforms.uWind.value, -.4);
  assert.equal(windows[2].children[0].material.uniforms.uAmount.value, .8);
  snow.update(8000);
  assert.equal(windows[0].children[0].material.uniforms.uTime.value, 8);
  snow.setSettings(normalizeVisualSettings({ wetSnowEnabled: false }));
  assert.ok(windows.every(windowGroup => !windowGroup.children[0].visible));
  snow.dispose();
});
