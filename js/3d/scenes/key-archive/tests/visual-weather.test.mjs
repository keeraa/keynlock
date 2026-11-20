import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  DEFAULT_VISUAL_SETTINGS, normalizeVisualSettings, visualPassNeeded,
} from '../dist/js/visual-settings.js';
import { windowLightPalette } from '../dist/js/window-light-palette.js';
import { logicalKey } from '../dist/js/controls.js';

test('KEYNLOCK visual preset retains toon, ink and window light values', () => {
  const settings = normalizeVisualSettings(null);
  assert.equal(settings.toonLight, 80);
  assert.equal(settings.toonSteps, 4);
  assert.equal(settings.outlineStrength, 100);
  assert.equal('outlineWidth' in settings, false);
  assert.equal(settings.outlineSensitivity, 100);
  assert.equal(settings.cartoonMaterial, 90);
  assert.equal('brushExpression' in settings, false);
  assert.equal('strokeDetail' in settings, false);
  assert.equal('brushExpression' in normalizeVisualSettings({ brushExpression: 100, strokeDetail: 100 }), false);
  assert.equal(settings.nightLighting, false);
  assert.equal(settings.windowDaylight, 75);
});

test('visual controls reject invalid saved values and keep switches independent', () => {
  const settings = normalizeVisualSettings({ toonLight: 120, toonSteps: -2, outlineStrength: 'bad',
    outlineWidth: 99, outlineSensitivity: 140, snowWind: -200, snowIntensity: 12.1,
    windowDaylight: 150, toonEnabled: false, nightLighting: true, wetSnowEnabled: true,
    outlineEnabled: false, brushExpression: 99 });
  assert.equal(settings.toonLight, 100);
  assert.equal(settings.toonSteps, 2);
  assert.equal(settings.outlineStrength, 100);
  assert.equal('outlineWidth' in settings, false);
  assert.equal(settings.outlineSensitivity, 100);
  assert.equal(settings.nightLighting, true);
  for (const old of ['wetSnowEnabled', 'snowWind', 'snowIntensity']) assert.equal(old in settings, false);
  assert.equal(settings.windowDaylight, 100);
  assert.equal(visualPassNeeded(settings), false);
  assert.equal(visualPassNeeded(normalizeVisualSettings({ toonEnabled: false })), true);
  assert.equal(DEFAULT_VISUAL_SETTINGS.toonLight, 80);
});

test('visual panel shortcut works in English and Russian keyboard layouts', () => {
  assert.equal(logicalKey({ code: 'KeyV', key: 'v' }), 'v');
  assert.equal(logicalKey({ code: 'Unidentified', key: 'м' }), 'v');
});

test('clear windows have a warm day preset and retain the original cool palette at night', () => {
  const day = windowLightPalette(false);
  const night = windowLightPalette(true);
  assert.equal(night.sun, 0xc7ddff);
  assert.equal(night.wash, 0xa7c5f1);
  for (const field of ['sun', 'glass', 'glow', 'air', 'wash', 'dust']) {
    assert.ok((day[field] >> 16) > (day[field] & 255));
    assert.ok((night[field] >> 16) < (night[field] & 255));
  }
  const page = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
  assert.match(page, /id="nightLighting" type="checkbox"/);
  assert.doesNotMatch(page, /wetSnowEnabled|snowIntensity|snowWind/);
});
