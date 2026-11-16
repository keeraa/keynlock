/** Browser visual scenarios. Capture PNGs, or compare against approved snapshots.
 *
 * KEYNLOCK_VISUAL_MODE=update   writes reviewed baselines intentionally.
 * KEYNLOCK_VISUAL_MODE=compare  requires approved baselines and ImageMagick.
 * Default capture mode also detects identical/broken 3D views between lock types.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { scenarioSearch } from '../src/js/runtime/scenarios.js';

const projectRoot = resolve(import.meta.dirname, '..');
const latest = join(projectRoot, 'reports/visual/latest');
const canvases = join(projectRoot, 'reports/visual/canvases');
const baselines = join(projectRoot, 'tests/visual-baselines');
const mode = process.env.KEYNLOCK_VISUAL_MODE || 'capture';
const maxDifference = Number(process.env.KEYNLOCK_MAX_VISUAL_DIFFERENCE || '.02');
if (!['capture', 'compare', 'update'].includes(mode))
  throw new Error(`Invalid KEYNLOCK_VISUAL_MODE=${mode}`);

const scenarios = [
  { name: 'pin-four-front', input: { mode: 'pin', pins: 4, view: 'front' } },
  { name: 'pin-six-side', input: { mode: 'pin', pins: 6, view: 'side' } },
  { name: 'pin-pick-inserted', input: { mode: 'pin', pins: 4, view: 'front' },
    targets: { insert: 1 } },
  { name: 'pin-assembly-exploded', input: { mode: 'pin', pins: 4, view: 'front' },
    targets: { explode: 1 } },
  { name: 'classic-level-two', input: { puzzle: 'classic', level: 2, view: 'front' } },
  { name: 'symbol-pins-level-three', input: { puzzle: 'symbolpins', level: 3, view: 'front' } },
  { name: 'disc-front', input: { mode: 'disc', view: 'front' } },
  { name: 'code-side', input: { mode: 'code', view: 'side' } },
  { name: 'plate-classic-front', input: { mode: 'plate', view: 'front' } },
];

function changedPixelFraction(actual, expected, totalPixels = 1440 * 900) {
  const executable = spawnSync('magick', ['-version'], { encoding: 'utf8' }).status === 0
    ? 'magick' : 'compare';
  const args = executable === 'magick' ? ['compare', '-metric', 'AE'] : ['-metric', 'AE'];
  const result = spawnSync(executable, [...args, expected, actual, 'null:'], { encoding: 'utf8' });
  if (result.error) throw new Error('Install ImageMagick to compare screenshots.');
  if (![0, 1].includes(result.status))
    throw new Error(`ImageMagick cannot compare screenshots: ${result.stderr}`);
  const changedPixels = Number((result.stderr || '').match(/^\s*([0-9]+)/)?.[1]);
  assert.ok(Number.isFinite(changedPixels), `Invalid ImageMagick pixel count: ${result.stderr}`);
  return changedPixels / totalPixels;
}

function comparePng(actual, expected) {
  const fraction = changedPixelFraction(actual, expected);
  assert.ok(fraction <= maxDifference,
    `Visual regression: ${(fraction * 100).toFixed(2)}% changed pixels (max ${(maxDifference * 100).toFixed(2)}%).`);
  return fraction;
}

mkdirSync(latest, { recursive: true });
mkdirSync(canvases, { recursive: true });
if (mode === 'update') mkdirSync(baselines, { recursive: true });
const launchOptions = {
  headless: process.env.KEYNLOCK_HEADFUL !== '1',
  ...(process.env.KEYNLOCK_BROWSER ? { executablePath: process.env.KEYNLOCK_BROWSER } : {}),
  ...(process.env.KEYNLOCK_BROWSER_ARGS ? { args: process.env.KEYNLOCK_BROWSER_ARGS.split(' ') } : {}),
};
const browser = await chromium.launch(launchOptions);
const manifest = [];
const canvasSizes = new Map();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1, colorScheme: 'dark', reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));

  for (const scenario of scenarios) {
    const url = new URL(process.env.KEYNLOCK_URL || 'http://127.0.0.1:4173/');
    url.search = scenarioSearch({ seed: 97461, ...scenario.input }, { debug: true });
    const response = await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    assert.equal(response?.status(), 200);
    await page.waitForFunction(() => document.querySelector('#loading')?.classList.contains('done') &&
      Boolean(window.__keynlockDev?.getMetrics()), undefined, { timeout: 25_000 });
    assert.equal(await page.locator('#fallback').isVisible(), false, 'WebGL renderer must start');
    assert.ok(await page.evaluate(() => Boolean(document.querySelector('#viewport').getContext('webgl2'))),
      'WebGL2 is required to review mechanism screenshots');
    if (scenario.targets) await page.evaluate(targets => window.__keynlockDev.setTargets(targets), scenario.targets);
    // Let the same damped mechanical animation reach a stable pose before capture.
    await page.waitForTimeout(scenario.targets ? 2600 : 650);
    await page.addStyleTag({ content: `#keynlock-devtools,#fpsCount,#polygonCount{visibility:hidden!important}
      *,*::before,*::after{caret-color:transparent!important;transition:none!important}` });
    const file = join(latest, `${scenario.name}.png`);
    const image = await page.screenshot({ path: file, animations: 'disabled' });
    assert.ok(image.length > 35_000, `Suspiciously empty screenshot: ${scenario.name}`);
    const canvasImage = await page.locator('#viewport').screenshot({
      path: join(canvases, `${scenario.name}.png`), animations: 'disabled',
    });
    assert.ok(canvasImage.length > 20_000, `Empty 3D canvas: ${scenario.name}`);
    const canvasBounds = await page.locator('#viewport').boundingBox();
    assert.ok(canvasBounds?.width > 300 && canvasBounds?.height > 300,
      `3D canvas is unexpectedly small in ${scenario.name}`);
    canvasSizes.set(scenario.name, Math.round(canvasBounds.width) * Math.round(canvasBounds.height));
    assert.deepEqual(errors, [], 'No JavaScript errors in visual scenarios');
    const baseline = join(baselines, `${scenario.name}.png`);
    let difference = null;
    if (mode === 'compare') {
      assert.ok(existsSync(baseline), `Baseline missing: ${baseline}; run KEYNLOCK_VISUAL_MODE=update`);
      difference = comparePng(file, baseline);
    }
    const stat = statSync(file);
    manifest.push({ name: scenario.name, bytes: stat.size,
      sha256: createHash('sha256').update(image).digest('hex'),
      canvasSha256: createHash('sha256').update(canvasImage).digest('hex'),
      baseline: existsSync(baseline), difference });
    console.log(`${scenario.name}: ${(stat.size / 1024).toFixed(1)} KB${difference === null ? '' : ` · ${(difference * 100).toFixed(2)}% pixels changed`}`);
  }
} finally { await browser.close(); }
// Compare *canvas-only* pixels, not menu labels; a broken renderer can otherwise
// pass capture checks because the HTML controls differ between lock types.
const visiblyDifferent = [
  ['pin-four-front', 'pin-six-side'],
  ['pin-four-front', 'pin-assembly-exploded'],
  ['pin-four-front', 'disc-front'],
  ['disc-front', 'code-side'],
  ['code-side', 'plate-classic-front'],
  ['classic-level-two', 'symbol-pins-level-three'],
];
const sceneDifferences = [];
for (const [before, after] of visiblyDifferent) {
  assert.equal(canvasSizes.get(before),canvasSizes.get(after),
    `Inconsistent screenshot dimensions: ${before}/${after}`);
  const difference = changedPixelFraction(
    join(canvases, `${before}.png`),join(canvases, `${after}.png`),canvasSizes.get(before));
  assert.ok(difference > .005,
    `3D scene regression: ${before} and ${after} differ by only ${(difference*100).toFixed(2)}%`);
  sceneDifferences.push({ before, after, difference });
}
// Never overwrite approved baselines before the new capture passes every check.
if (mode === 'update') {
  for (const scenario of scenarios)
    copyFileSync(join(latest, `${scenario.name}.png`),join(baselines, `${scenario.name}.png`));
}
writeFileSync(join(projectRoot, 'reports/visual/manifest.json'),
  JSON.stringify({ generatedAt: new Date().toISOString(), mode, scenarios: manifest,
    sceneDifferences }, null, 2) + '\n');
console.log(`Verified ${manifest.length} WebGL states and ${sceneDifferences.length} scene differences (${mode}).`);
