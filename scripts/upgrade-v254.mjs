import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');
const write = (path, text) => writeFileSync(path, text, 'utf8');
const assert = (value, message) => { if (!value) throw new Error(message); };

assert(read('VERSION').trim() === '253', 'upgrade:v254 expects VERSION 253');

function split(source, prefix, markers) {
  const text = read(source);
  const found = markers.map(([label, marker]) => {
    const index = text.indexOf(marker);
    assert(index >= 0, `Marker not found in ${source}: ${marker}`);
    return [index, label];
  }).sort((a, b) => a[0] - b[0]);
  assert(found[0][0] === 0, `${source} first split marker must start at byte 0`);

  const paths = [];
  const pieces = [];
  found.forEach(([start, label], i) => {
    const end = i + 1 < found.length ? found[i + 1][0] : text.length;
    const piece = text.slice(start, end);
    const path = `css/${prefix}-${String(i + 1).padStart(2, '0')}-${label}.css`;
    write(path, piece);
    paths.push(path);
    pieces.push(piece);
  });
  assert(pieces.join('') === text, `${source} split changed CSS contents`);
  unlinkSync(source);
  return paths;
}

const modes = split('css/modes.css', 'modes', [
  ['hillsfar', '.hillsfarMode{'],
  ['mass-effect', '.massMode{'],
  ['gothic1', '.g1Mode{'],
  ['skyrim', '.skMode{'],
  ['anachronox', '.anMode{'],
]);

const worldText = read('css/world.css');
const world = 'css/world-01-shop-shared.css';
write(world, worldText);
unlinkSync('css/world.css');

const motion = read('css/motion.css');
const motionMarkers = [
  [0, 'tools-shared'],
  [motion.indexOf('.worldMapScreen{'), 'map'],
  [motion.indexOf('.lairScene{'), 'lair'],
  [motion.indexOf('#lock.universalLockBlock'), 'universal-lock'],
  [motion.indexOf('.inventoryDrawer'), 'inventory'],
  [motion.indexOf('.digitalMode'), 'digital'],
  [motion.indexOf('.lairWorkbenchHotspot'), 'workbench'],
].sort((a, b) => a[0] - b[0]);
assert(motionMarkers.every(([index]) => index >= 0), 'One or more motion.css markers are missing');

const overrides = [];
const motionPieces = [];
motionMarkers.forEach(([start, label], i) => {
  const end = i + 1 < motionMarkers.length ? motionMarkers[i + 1][0] : motion.length;
  const piece = motion.slice(start, end);
  const path = `css/overrides-${String(i + 1).padStart(2, '0')}-${label}.css`;
  write(path, piece);
  overrides.push(path);
  motionPieces.push(piece);
});
assert(motionPieces.join('') === motion, 'motion.css split changed CSS contents');
unlinkSync('css/motion.css');

let html = read('index.html');
const baseLink = '<link rel="stylesheet" href="css/base.css">';
const obsolete = [
  '<link rel="stylesheet" href="css/modes.css">',
  '<link rel="stylesheet" href="css/world.css">',
  '<link rel="stylesheet" href="css/motion.css">',
  '<link rel="stylesheet" href="css/mobile.css">',
];
assert(html.split(baseLink).length - 1 === 1, 'base.css link count is not 1');
for (const link of obsolete) {
  assert(html.split(link).length - 1 === 1, `Expected one stylesheet link: ${link}`);
  html = html.replace(link, '');
}
const orderedCss = ['css/base.css', ...modes, world, ...overrides, 'css/mobile.css'];
html = html.replace(baseLink, orderedCss.map(path => `<link rel="stylesheet" href="${path}">`).join('\n'));
write('index.html', html);

let check = read('scripts/check.mjs');
const checkAnchor = "const scripts = localAttributeRefs(html, 'script', 'src');\n";
assert(check.split(checkAnchor).length - 1 === 1, 'check.mjs script-order anchor not found exactly once');
const expectedScripts = [
  'js/core/state.js','js/core/audio.js','js/core/ui.js',
  'js/world/inventory.js','js/world/lair.js','js/world/navigation-shop.js',
  'js/core/digital-helpers.js','js/modes/heat-cold.js','js/modes/drum.js','js/modes/oscilloscope.js',
  'js/core/game.js','js/modes/mass-effect.js','js/modes/anachronox.js','js/modes/composite.js',
  'js/modes/tension.js','js/modes/resonance.js','js/modes/deduction.js','js/modes/skyrim.js',
  'js/modes/gothic1.js','js/modes/hillsfar.js','js/modes/base-locks.js',
  'js/core/init.js','js/core/inventory-hit-testing.js'
];
check = check.replace(checkAnchor, checkAnchor +
  `const expectedScriptOrder = ${JSON.stringify(expectedScripts)};\n` +
  "if (JSON.stringify(scripts) !== JSON.stringify(expectedScriptOrder)) fail('JavaScript load order changed; classic scripts share one lexical environment.');\n");
write('scripts/check.mjs', check);

const pkg = JSON.parse(read('package.json'));
pkg.version = '0.254.0';
delete pkg.scripts['upgrade:v254'];
write('package.json', JSON.stringify(pkg, null, 2) + '\n');
write('VERSION', '254\n');

write('css/README.md', `# KEYNLOCK CSS architecture\n\nv254 preserves the v253 cascade while splitting large stylesheets into contiguous chronological fragments. File order in index.html is significant.\n\n- base.css — foundation, HUD and classic-lock base styles\n- modes-01 … modes-06 — Hillsfar, Mass Effect, Gothic 1, Skyrim and Anachronox base sections\n- world-01-shop-shared.css — shop plus shared early imported-mode overrides\n- overrides-* — later tools/shared, map, lair, universal-lock, inventory, digital and workbench sections\n- mobile.css — final mobile layer and must remain last\n\nAll fragments stay directly in css/, so existing relative asset paths remain valid. Selectors are never regrouped across their original cascade positions.\n`);

console.log(`KEYNLOCK upgraded to v254. ${orderedCss.length} CSS files are now loaded in cascade order.`);
console.log('Next: npm run check && npm run smoke && npm run dev');
