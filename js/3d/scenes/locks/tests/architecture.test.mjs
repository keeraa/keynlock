import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dist = join(root, 'dist');
const src = join(root, 'src');
const html = readFileSync(join(dist, 'index.html'), 'utf8');
const threeModules = new Set(['three', 'three/core',
  'three/addons/controls/OrbitControls.js',
  'three/addons/geometries/RoundedBoxGeometry.js']);

test('index stays small and references one optimized cacheable application bundle', () => {
  assert.ok(Buffer.byteLength(html) < 21_000, 'accessible numeric controls fit the small HTML budget');
  assert.ok(!html.includes('data:text/javascript;base64,'));
  assert.ok(!html.includes('type="importmap"'));
  for (const [, path] of html.matchAll(/(?:src|href)="(\.\/[^\"]+)"/g)) {
    assert.ok(existsSync(join(dist, path)), `${path} is missing`);
  }
  assert.ok(html.includes('src="./app.js"'));
  assert.ok(html.includes('href="./app.css"'));
  assert.ok(!html.includes('vendor/'));
  assert.ok(!html.includes('filmOverlay') && !html.includes('filmIntensitySlider'),
    'warm color-grading and film grain controls are removed');
  assert.ok(!html.includes('Гуашь внутренних деталей') && !html.includes('painted-parts'),
    'automatic internal textures are not presented as selectable cards');
});

test('all application modules import existing local files or pinned Three.js modules', () => {
  const files = [];
  function collect(directory) {
    for (const item of readdirSync(directory)) {
      const p = join(directory, item);
      if (statSync(p).isDirectory()) collect(p);
      else if (p.endsWith('.js')) files.push(p);
    }
  }
  collect(join(src, 'js'));
  assert.ok(files.length >= 10);
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    for (const [, specifier] of source.matchAll(/\bfrom\s*['"]([^'"]+)['"]/g)) {
      if (specifier.startsWith('.')) {
        assert.ok(existsSync(resolve(dirname(file), specifier)), `${file} imports missing ${specifier}`);
      } else {
        assert.ok(threeModules.has(specifier), `Unmapped import: ${specifier}`);
      }
    }
  }
});

test('fifteen base WebP textures and the separately catalogued Japanese handle stay external', () => {
  const assets = readdirSync(join(dist, 'assets')).filter(name => name.endsWith('.webp'));
  assert.equal(assets.length, 15);
  assert.ok(assets.includes('geisha-handle.webp'));
  assert.ok(assets.includes('geisha-handle-v2.webp'));
  const handleSource = readFileSync(join(src, 'js/mechanisms/pin-tools.js'), 'utf8');
  assert.ok(handleSource.includes("handlePaintingData='./assets/handles/japanese/geisha-red-fan.webp'"),
    'the catalogued painting is mapped onto the shared pick handle');
  const japanese=join(dist,'assets/handles/japanese');
  const collection=JSON.parse(readFileSync(join(japanese,'collection.json'),'utf8'));
  assert.equal(collection.name,'Японская коллекция');
  assert.equal(collection.items.length,1);
  assert.equal(collection.items[0].sides,2);
  assert.ok(collection.items[0].texture==='geisha-red-fan.webp');
  assert.ok(statSync(join(japanese,collection.items[0].texture)).size>500);
  assert.ok(existsSync(join(root,collection.items[0].source)),
    'the original resolution painting is archived separately for future handles');
  assert.ok(assets.includes('painted-steel.webp'));
  assert.ok(assets.includes('painted-brass.webp'));
  assert.ok(assets.includes('painted-graphite.webp'));
  assert.ok(assets.includes('painted-copper.webp'));
  assert.ok(assets.includes('painted-enamel.webp'));
  for (const detail of ['gear', 'pin', 'manifold'])
    assert.ok(assets.includes(`painted-${detail}.webp`));
  for (const asset of assets) assert.ok(statSync(join(dist, 'assets', asset)).size > 500);
  const app = statSync(join(dist, 'app.js')).size;
  const report = JSON.parse(readFileSync(join(root, 'reports/bundle.json'), 'utf8'));
  assert.ok(app < 1_250_000, `unexpectedly large bundle ${app}`);
  assert.equal(app, report.outputBundleBytes);
  assert.ok(report.treeShaking && report.minified);
  assert.ok(report.reductionPercent >= 40);
});

test('main module only wires subsystems and stays below 380 lines', () => {
  const entry = readFileSync(join(src, 'js/main.js'), 'utf8');
  const lines = entry.split(/\r?\n/).length;
  assert.ok(lines < 380, `main.js grew to ${lines} lines`);
  for (const symbol of ['function makeOilLeatherTexture', 'function createSideShell',
    'function stepShacklePhysics', "document.addEventListener('keydown'",
    'function findOilSurface', 'function startPinPuzzle(',
    'function tickPinPuzzle(', 'function animate(', 'function keySurfaceAt(',
    'function attemptPick(', 'function makeScrew(', 'function makeRoughnessMap(',
    'new THREE.HemisphereLight(', 'function makeHousing(']) {
    assert.ok(!entry.includes(symbol), `${symbol} should live in a subsystem module`);
  }
  for (const relative of [
    'geometry/oil-can.js', 'geometry/housing.js', 'physics/shackle.js',
    'mechanisms/ball-latch.js', 'ui/controls.js', 'ui/scene-pointer.js',
    'tools/oil-tool.js', 'gameplay/pin-controller.js', 'gameplay/free-picking.js',
    'runtime/lock-animator.js', 'geometry/key.js', 'scene/lock-stage.js',
    'effects/lock-materials.js', 'mechanisms/lock-hardware.js',
    'ui/oil-tool-preview.js', 'ui/oil-tool-input.js',
  ]) assert.ok(existsSync(join(src, 'js', relative)), `${relative} missing`);
  const oilTool=readFileSync(join(src,'js/tools/oil-tool.js'),'utf8');
  assert.ok(oilTool.split(/\r?\n/).length<280,
    'oil simulation no longer owns DOM input or the WebGL preview');
  assert.ok(!oilTool.includes('function renderOilToolPreview('),
    'preview is owned by its dedicated UI module');
  assert.ok(!oilTool.includes("canvas.addEventListener('pointerdown'"),
    'oil input events are owned by a separate controller');
  const pinTools = readFileSync(join(src, 'js/mechanisms/pin-tools.js'), 'utf8');
  assert.ok(pinTools.includes('makeKey(pinGroup,pinXs)'),
    'first key must receive chamber positions before scene state is initialized');
  const pinMechanism = readFileSync(join(src, 'js/mechanisms/pin-lock.js'), 'utf8');
  assert.ok(pinMechanism.includes('createPinDriveTrain('));
  assert.ok(pinMechanism.includes('createPinPickingTools('));
  assert.ok(pinMechanism.split(/\r?\n/).length < 200,
    'pin-lock stays a readable assembly, with drive and tools as separate modules');
  const actions = readFileSync(join(src, 'js/gameplay/actions.js'), 'utf8');
  assert.ok(!actions.includes("from '../ui/"),
    'gameplay may receive display callbacks but must not import the UI layer');
  assert.ok(actions.split(/\r?\n/).length < 190,
    'gameplay command dispatch stays separate from appearance controls');
  const scenarioFacade = readFileSync(join(src, 'js/runtime/scenarios.js'), 'utf8');
  assert.ok(scenarioFacade.split(/\r?\n/).length < 20,
    'scenario link handling and action tapes remain independent modules');
  assert.ok(existsSync(join(src, 'js/gameplay/pin-ticker.js')));
  const filter = readFileSync(join(src, 'js/effects/cartoon-filter.js'), 'utf8');
  assert.ok(filter.includes('if (!enabled())'), 'optional filter needs a cheap default render path');
  assert.ok(filter.includes('DepthTexture'), 'outline must follow 3D depth, not just colors');
  assert.ok(filter.includes('MeshNormalMaterial'), 'outlines should also detect normal changes');
  const shader = readFileSync(join(src, 'js/effects/drawing-shader.js'), 'utf8');
  assert.ok(!shader.includes('paperNoise') && shader.includes('uBands'),
    'removed paper noise must no longer be sampled by the ink shader');
});

test('right-side settings panel captures scrolling above the WebGL canvas', () => {
  const css = readFileSync(join(src, 'styles/app.css'), 'utf8');
  assert.match(css, /\.ui\s*\{[^}]*pointer-events:\s*none/);
  assert.match(css, /\.right-rail\s*\{[^}]*overflow-y:\s*auto/);
  assert.match(css, /\.right-rail\s*\{[^}]*pointer-events:\s*auto/);
  assert.match(css, /\.right-rail\s*\{[^}]*touch-action:\s*pan-y/);
});
