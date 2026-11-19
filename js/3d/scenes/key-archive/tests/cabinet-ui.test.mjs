import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('cabinet face uses individual cubbies, an actual key on the plaque and no hooks', () => {
  const source = readFileSync(new URL('../dist/js/world-cabinet.js', import.meta.url), 'utf8');
  assert.match(source, /const plaqueKey = new THREE\.Mesh\(createCombinedKeyGeometry\(type\)/);
  assert.match(source, /fontSize: 100/);
  assert.match(source, /group\.scale\.z = \.5/);
  assert.match(source, /plaqueKey\.scale\.setScalar\(\.23 \* 2\.7 \* \.8\)/);
  assert.match(source, /plaqueKey\.rotation\.z = -Math\.PI \/ 2/);
  assert.match(source, /const crownKey = new THREE\.Mesh\(createCombinedKeyGeometry\(type\)/);
  assert.match(source, /crownKey\.position\.set\(0, 4\.43, -\.18\)/);
  assert.match(source, /crownKey\.scale\.setScalar\(4\.48\)/);
  assert.match(source, /cabinetKeyPose\(visible\[i\]\.cabinetSlot/);
  assert.match(source, /\[0, \.48, \.42\]/);
  assert.match(source, /const plaqueGlow/);
  assert.match(source, /smoothstep\(0\.0, \.22, vUv\.x\)/);
  assert.match(source, /vec3\(1\.0, \.78, \.51\)/);
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
  assert.ok(page.indexOf('class="help-hotkeys"') < page.indexOf('class="inventory-shell"'));
  assert.match(css, /\.inventory-shell\{width:382px;margin-left:auto/);
  assert.match(css, /\.help-hotkeys\{text-align:left\}/);
});

test('game HUD hides the status strip and mouse-lock warning', () => {
  const page = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
  const main = readFileSync(new URL('../dist/js/main.js', import.meta.url), 'utf8');
  assert.doesNotMatch(page, /telemetry-panel|capture-hint/);
  assert.doesNotMatch(main, /capture-retry|floor-count|symbols\[target\.type\]/);
});
