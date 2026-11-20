import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mainSource } from './helpers/main-source.mjs';

test('cabinet face uses individual cubbies, a painted family name and no hooks', () => {
  const source = readFileSync(new URL('../dist/js/world-cabinet.js', import.meta.url), 'utf8');
  assert.match(source, /label.position.set\(0, CABINET_HEADER_Y, \.531\)/);
  assert.doesNotMatch(source, /plaqueKey|plaqueGlow|carvingPlane|Math\.sign\(x\)/);
  assert.match(source, /group\.scale\.z = \.5/);
  assert.match(source, /const crownGeometry = createCombinedKeyGeometry\(type\)/);
  assert.match(source, /crownKey\.position\.set\(0, crestCenterY - headCenter \* crownScale, -\.24\)/);
  assert.match(source, /crownKey\.scale\.setScalar\(crownScale\)/);
  assert.match(source, /new THREE\.EdgesGeometry\(crownKey\.geometry, 35\)/);
  assert.match(source, /crownContour\.material\.opacity = strength \* \.008/);
  assert.match(source, /cabinetKeyPose\(visible\[i\]\.cabinetSlot/);
  assert.match(source, /lowerPanelHeight = CABINET_GRID_BOTTOM_Y - \.32/);
  assert.match(source, /CABINET_COLUMNS \* 2; divider\+\+/);
  assert.match(source, /addTrimInstances\(group, uprightInstances, mat\.wood\)/);
  assert.match(source, /addTrimInstances\(group, inlayInstances, mat\.darkBrass\)/);
  assert.match(source, /front \+ \.013/);
  assert.match(source, /CABINET_ROWS; row\+\+/);
  assert.doesNotMatch(source, /CylinderGeometry|createBowGlyph|KEY_TYPES\[type\]\.mark/);
});

test('keyboard hints sit at lower left and inventory at lower right', () => {
  const page = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../dist/styles.css', import.meta.url), 'utf8');
  assert.ok(page.indexOf('class="hud-guides"') < page.indexOf('class="inventory-shell"'));
  assert.match(page, /class="quick-keys" data-i18n-html="hud\.quickKeys">E <span>— действие<\/span> &nbsp; R <span>— бросить<\/span>/);
  assert.doesNotMatch(page, /help-hotkeys|inventory-help|Мышь — смотреть/);
  assert.match(css, /\.inventory-shell\{width:\d+px;margin-left:auto/);
  assert.match(css, /\.quick-keys\{font:/);
});

test('game HUD hides the status strip and mouse-lock warning', () => {
  const page = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
  const main = mainSource();
  assert.doesNotMatch(page, /telemetry-panel|capture-hint/);
  assert.doesNotMatch(main, /capture-retry|floor-count|symbols\[target\.type\]/);
});
