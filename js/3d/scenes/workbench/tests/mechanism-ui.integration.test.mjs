import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const page=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const ui=readFileSync(new URL('../public/js/mechanism-ui.js',import.meta.url),'utf8');
const styles=readFileSync(new URL('../public/style.css',import.meta.url),'utf8');

test('lockpicking presents the four physical stages and original tools',()=>{
  const controls=page.match(/<div id="mechAttackControls"[\s\S]*?<\/div>\s*<p id="mechFeedback"/)?.[0];
  assert.ok(controls,'the accessible attack control panel exists');
  assert.match(controls,/1 · Подберите натяжитель/);
  assert.match(controls,/2 · Проверить посадку/);
  assert.match(controls,/3 · Выберите штифт/);
  assert.match(controls,/4 · Поднять крючком/);
  assert.match(controls,/id="mechPinChoices"/);
  assert.match(controls,/id="mechWrenchChoices"/);
  assert.match(controls,/id="mechFitStatus"/);
  assert.doesNotMatch(controls,/Клин|Усилие ↑|Натяжение засова/);
  assert.match(ui,/STANDARD_TENSION_TOOLS\.entries\(\)/,
    'all five shapes reuse the source pin laboratory selection');
  assert.match(ui,/function liftWithHook\(part\)/);
  assert.match(ui,/checkTensionFit\(parts,wrenchIndex\)/);
  assert.match(ui,/renderPinControls\(\)/);
  assert.match(styles,/\.mech-attack-controls\[hidden\]/);
});

test('pick icon cannot stretch the entire action row or clip adjacent labels',()=>{
  assert.match(styles,/\.mech-tool-icon\{display:block;width:57px;height:36px;flex:none\}/);
  assert.match(styles,/\.mech-tool-icon svg\{width:100%;height:100%;object-fit:contain\}/);
  assert.doesNotMatch(styles,/\.mech-tool-button>svg\{width:100%;height:100%/,
    'the direct SVG must keep its fixed-size icon class, not fill its parent button');
});

test('mechanism assembly tests the key in place with no separate trial tab',()=>{
  assert.match(page,/data-mech-mode="build"/);
  assert.match(page,/data-mech-mode="attack"/);
  assert.doesNotMatch(page,/data-mech-mode="test"|mechTestControls|Собирай механизмы внутри 3D-корпуса/);
  const build=page.match(/<div id="mechBuildControls"[\s\S]*?<\/div>/)?.[0];
  assert.ok(build);
  assert.match(build,/id="mechTurnKey"/);
  assert.match(build,/id="mechResetTest"/);
  assert.match(ui,/const key=mode==='build'&&now<pulseUntil\?1:0/);
  assert.match(ui,/if\(part\?\.type==='key'\)turnKey\(\)/);
});

test('catalog uses live 3D part image captures',()=>{
  assert.match(ui,/captureThumbnails\(PALETTE\)/);
  assert.match(ui,/image\.src=src;glyph\.replaceChildren\(image\)/);
  assert.match(page,/id="mechPalette"/);
});

test('component catalog shows three unlabeled thumbnails per row with hover details',()=>{
  assert.match(styles,/\.mech-palette\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(ui,/btn\.innerHTML=`<span class="mech-glyph" aria-hidden="true">/);
  assert.match(ui,/CORE_PALETTE\.forEach\(type=>addPaletteItem\(type\)\)/,
    'forEach index must never override the DOM container argument when initializing the sandbox');
  assert.doesNotMatch(ui,/btn\.innerHTML=`[^`]*<b>\$\{def\.name\}/);
  assert.match(ui,/listen\(btn,'pointerenter',\(\)=>showPartTooltip\(btn,type\)\)/);
  assert.match(ui,/title\.textContent=PARTS\[type\]\.name;description\.textContent=effects\[type\]/);
  assert.match(ui,/btn\.setAttribute\('aria-label'/);
});

test('mechanism launches without persistent contact overlay circles',()=>{
  assert.match(page,/id="mechShowContacts" aria-pressed="false">Контакты: выкл\./);
  assert.match(ui,/showContacts=false,drag=null/);
});

test('a beginner can select a functional example and watch force progress through actual joints',()=>{
  assert.match(page,/id="mechPresetList"/);
  assert.match(page,/id="mechPresetDetail"/);
  assert.match(page,/id="mechMotionReadout" hidden/);
  assert.match(ui,/mechanismPreset\(name\)/);
  assert.match(ui,/function transmissionStages\(parts,view\)/);
  assert.match(ui,/function stagedView\(full,stages,elapsed,parts\)/);
  assert.match(ui,/motionActive=current\.ids/);
  assert.match(ui,/shackleReleased=everOpen\|\|Boolean\(playback\.result\.open/);
  assert.match(ui,/advanced\.className='mech-advanced'/);
  assert.match(styles,/\.mech-advanced summary\{/);
  assert.match(page,/id="mechRestoreCustom"/);
  assert.match(ui,/rememberCurrentCustom\(\);parts=mechanismPreset\(name\)/,
    'choosing a demonstration must preserve any previously saved custom mechanism');
  assert.doesNotMatch(page,/id="mechDemo"/, 'ready examples replace the redundant reset-example button');
});
