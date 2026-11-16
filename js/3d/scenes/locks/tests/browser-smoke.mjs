/** Real-browser WebGL smoke + performance benchmark.
 *
 * Run after `npm run build` while serving `dist` at KEYNLOCK_URL.
 * Point KEYNLOCK_BROWSER to a Chromium executable with WebGL2 support.
 */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright-core';

const base = new URL(process.env.KEYNLOCK_URL || 'http://127.0.0.1:4173/');
base.searchParams.set('perf', '1');
const root = resolve(import.meta.dirname, '..');
const errors = [];
const options = {
  headless: process.env.KEYNLOCK_HEADFUL !== '1',
  ...(process.env.KEYNLOCK_BROWSER ? { executablePath: process.env.KEYNLOCK_BROWSER } : {}),
  ...(process.env.KEYNLOCK_BROWSER_ARGS ? { args: process.env.KEYNLOCK_BROWSER_ARGS.split(' ') } : {}),
};

const browser = await chromium.launch(options);
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });

  const response = await page.goto(base.href, { waitUntil: 'domcontentloaded', timeout: 25000 });
  assert.equal(response?.status(), 200, 'Site must return HTTP 200');
  const hasWebGL = await page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl2');
    return !!gl;
  });
  assert.ok(hasWebGL, 'Browser runner needs WebGL2; use a GPU-enabled Chromium environment');
  await page.waitForFunction(() => {
    const loader = document.querySelector('#loading');
    const fallback = document.querySelector('#fallback');
    return loader?.classList.contains('done') ||
      (fallback && getComputedStyle(fallback).display !== 'none');
  }, undefined, { timeout: 20000 });
  const failure = await page.locator('#fallback').isVisible();
  assert.ok(!failure, `WebGL startup failed: ${await page.locator('#errorReason').textContent()}`);
  assert.equal(await page.locator('canvas#viewport').count(), 1);

  // Live 3D pin count is selected exclusively through difficulty, including free study.
  assert.equal(await page.locator('#pinCountPicker, #pinCountSlider, #pinCountControls').count(),0);
  await page.locator('#pinPuzzleLevels button[data-level="3"]').click();
  assert.match(await page.locator('#modeDescription').textContent(),/6 пар/);
  await page.locator('#pinPuzzleLevels button[data-level="1"]').click();
  assert.match(await page.locator('#modeDescription').textContent(),/4 пар/);

  assert.equal(await page.locator('#settingsLock').isVisible(),true);
  await page.locator('#tabVisual').click();
  assert.equal(await page.locator('#settingsVisual').isVisible(),true);
  assert.equal(await page.locator('#settingsLock').isVisible(),false);

  // Wheel on the panel's padding must scroll settings, not the 3D camera underneath.
  const rail = page.locator('.right-rail');
  const railBox = await rail.boundingBox();
  assert.ok(railBox, 'right panel is visible');
  await rail.evaluate(element => { element.scrollTop = 0; });

  // A fully visible wall must be independent of the opt-in schematic X-ray.
  await page.locator('#opacitySlider').evaluate(input => {
    input.value = '0';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  assert.equal(await page.locator('#opacityValue').textContent(), '0%');
  await page.locator('#schematicXray').click();
  assert.equal(await page.locator('#opacityValue').textContent(), 'Рентген');
  assert.equal(await page.locator('#opacitySlider').isDisabled(), true);
  await page.locator('#schematicXray').click();
  assert.equal(await page.locator('#opacityValue').textContent(), '0%');
  assert.equal(await page.locator('#opacitySlider').isDisabled(), false);
  await page.locator('#opacitySlider').evaluate(input => {
    input.value = '100';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.mouse.move(railBox.x + 7, railBox.y + 90);
  await page.mouse.wheel(0, 450);
  await page.waitForFunction(() => document.querySelector('.right-rail').scrollTop > 50);
  assert.ok(await rail.evaluate(element => element.scrollTop > 50),
    'the right panel captures wheel scrolling over its padding');
  await rail.evaluate(element => { element.scrollTop = 0; });

  // The one-pixel ink contour is on by default; paper post-processing is gone.
  assert.equal(await page.locator('#cartoonToggle').getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('#cartoonOutlineSlider').isDisabled(), false);
  assert.equal(await page.locator('#toonStrengthSlider').isDisabled(), true);
  assert.equal(await page.locator('#outlineWidthValue').textContent(), '1 px');
  assert.equal(await page.locator('#paperToggle').count(), 0);
  await page.locator('#toonToggle').click();
  assert.equal(await page.locator('#toonStrengthSlider').isDisabled(), false);
  await page.locator('#cartoonOutlineSlider').evaluate(input => {
    input.value = '85';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  assert.equal(await page.locator('#cartoonOutlineValue').textContent(), '85%');
  await page.locator('#toonBandsSlider').evaluate(input => {
    input.value = '6';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  assert.equal(await page.locator('#toonBandsValue').textContent(), '6 ступ.');
  await page.locator('#outlineToggle').click();
  assert.equal(await page.locator('#outlineWidthSlider').isDisabled(), true);
  await page.locator('#cartoonToggle').click();
  assert.equal(await page.locator('#cartoonOutlineSlider').isDisabled(), true);
  assert.equal(await page.locator('#toonStrengthSlider').isDisabled(), true);
  await page.locator('#cartoonToggle').click();
  assert.equal(await page.locator('#outlineWidthSlider').isDisabled(), false);
  assert.equal(await page.locator('#toonStrengthSlider').isDisabled(), false);

  assert.equal(await page.locator('#paintStrengthValue').textContent(), '95%');
  assert.equal(await page.locator('#paintMaterialValue').textContent(), '90%');
  assert.equal(await page.locator('#paintDetailValue').textContent(), '2%');
  await page.locator('.paint-variant[data-group="steel"][data-variant="enamel"]').click();
  assert.equal(await page.locator('.paint-variant[data-variant="enamel"]').getAttribute('aria-pressed'), 'true');
  await page.locator('.paint-variant[data-group="brass"][data-variant="copper"]').click();
  assert.equal(await page.locator('.paint-variant[data-variant="copper"]').getAttribute('aria-pressed'), 'true');
  await page.locator('#paintedMaterialsToggle').click();
  assert.equal(await page.locator('#paintDetailSlider').isDisabled(), true);
  await page.locator('#paintedMaterialsToggle').click();
  assert.equal(await page.locator('#paintDetailSlider').isDisabled(), false);
  assert.equal(await page.locator('.painted-parts').count(), 0,
    'automatic internal gouache textures are hidden from the options');
  await page.waitForFunction(() =>
    document.querySelector('.pin-finish')?.style.backgroundImage.includes('data:image/'),
  undefined, { timeout: 15000 });
  const previews = await page.locator('.pin-finish').evaluateAll(buttons =>
    buttons.map(button => button.style.backgroundImage));
  assert.equal(previews.length, 5);
  assert.equal(new Set(previews).size, 5, 'each finish has a distinct painted preview');
  assert.equal(await page.locator('#filmSection, #filmIntensitySlider, #filmOverlay').count(), 0,
    'the warm film and grain overlay is removed from the entire page');

  await page.locator('#tabLock').click();
  assert.equal(await page.locator('#settingsVisual').isVisible(),false);

  for (const mode of ['disc', 'code', 'plate', 'pin']) {
    await page.locator(`#modeButtons button[data-mode="${mode}"]`).click();
    assert.equal(await page.locator(`#modeButtons button[data-mode="${mode}"]`).getAttribute('aria-pressed'), 'true');
    assert.ok((await page.locator('#modeDescription').textContent()).trim().length > 12);
    if (mode === 'plate') {
      assert.equal(await page.locator('.plate-row').count(), 4);
      assert.equal(await page.locator('#plateToolPicker').count(), 0,
        'the plate lock uses the original shared wrench picker');
      assert.equal(await page.locator('#wrenchPicker .wrench-choice').count(), 5);
      assert.ok(await page.locator('#wrenchPicker').isVisible());
      assert.equal(await page.locator('#wrenchPicker svg').count(),0,
        'real 3D tension models replace the old flat glyphs');
      for (const count of [5, 6, 4]) {
        await page.locator(`#plateCountPicker button[data-plate-count="${count}"]`).click();
        assert.equal(await page.locator('.plate-row').count(), count);
        assert.equal(await page.locator('#plateCountValue').textContent(), String(count));
        const marks = await page.locator('.plate-row-label').allTextContents();
        assert.equal(new Set(marks.map(label => label.split(' · ')[0])).size,1,
          'each plate displays the same shared symbol');
      }
      assert.equal(await page.locator('#plateOpenButton').isDisabled(), true);
      for (let i = 0; i < 4; i++) {
        const row = page.locator(`.plate-row[data-plate="${i}"]`);
        await row.click();
        const [motif, current] = (await row.locator('.plate-row-label').textContent()).split(' · ');
        const wrenchNames = {
          'Угол':'Двойной изгиб', 'Колено':'Прямой Г-образный',
          'Крючок':'Крючковый', 'Черта':'Прямой тонкий', 'Волна':'Волнистый',
        };
        const wrenchName = wrenchNames[motif];
        assert.ok(wrenchName, `matching wrench for ${motif}`);
        await page.locator(`#wrenchPicker .wrench-choice[title="${wrenchName}"]`).click();
        assert.equal(await page.locator('#modeTitle').textContent(),'Пластинчатый',
          'choosing a wrench does not leave the plate lock');
        let position = Number(current.split('/')[0]);
        while (position !== 4) {
          await page.locator(position < 4 ? '#plateShiftPlus' : '#plateShiftMinus').click();
          position += position < 4 ? 1 : -1;
        }
      }
      assert.equal(await page.locator('#plateOpenButton').isDisabled(), false);
      await page.locator('#plateOpenButton').click();
    }
  }

  const puzzleModes = await page.locator('#pinPuzzleSelect option').evaluateAll(options =>
    options.map(option => option.value).filter(value => value !== 'free'));
  assert.equal(puzzleModes.length, 8);
  let puzzleConfigurations = 0;
  for (const puzzle of puzzleModes) {
    await page.locator('#pinPuzzleSelect').selectOption(puzzle);
    for (const level of [1, 2, 3]) {
      await page.locator(`#pinPuzzleLevels button[data-level="${level}"]`).click();
      assert.equal(await page.locator(`#pinPuzzleLevels button[data-level="${level}"]`).getAttribute('aria-pressed'), 'true');
      assert.ok((await page.locator('#pinPuzzleRule').textContent()).trim().length > 10,
        `No puzzle rules for ${puzzle}/${level}`);
      assert.ok((await page.locator('#pinPuzzleStats').textContent()).includes('отмычки'),
        `No game progress for ${puzzle}/${level}`);
      assert.equal(await page.locator('#pinPuzzleLanes, #pinPuzzleValueSlider, #pinPuzzlePlayButton').count(),0,
        `The old duplicate pin control block must be absent in ${puzzle}/${level}`);
      puzzleConfigurations++;
    }
  }
  await page.locator('#pinPuzzleSelect').selectOption('free');
  assert.equal(await page.locator('#pinPuzzleLevels button').count(),3);
  await page.locator('#insertButton').click();
  assert.match(await page.locator('#insertButton').textContent(), /Извлечь/);
  await page.locator('#resetButton').click();

  await page.waitForFunction(() => window.__keynlockPerf?.frames >= 30, undefined,
    { timeout: 20000 });
  const stats = await page.evaluate(() => window.__keynlockPerf);
  for (const field of ['fps', 'frameP95Ms', 'drawCalls', 'triangles', 'geometries', 'textures']) {
    assert.ok(Number.isFinite(stats[field]) && stats[field] >= 0, `Invalid ${field}`);
  }
  assert.ok(stats.fps > 0 && stats.drawCalls > 0);

  const maxDrawCalls = Number(process.env.KEYNLOCK_MAX_DRAWS || 0);
  const maxP95 = Number(process.env.KEYNLOCK_MAX_P95_MS || 0);
  if (maxDrawCalls) assert.ok(stats.drawCalls <= maxDrawCalls,
    `drawCalls regression: ${stats.drawCalls} > ${maxDrawCalls}`);
  if (maxP95) assert.ok(stats.frameP95Ms <= maxP95,
    `P95 regression: ${stats.frameP95Ms}ms > ${maxP95}ms`);

  assert.deepEqual(errors, [], 'No browser JavaScript errors during mode switching');
  mkdirSync(join(root, 'reports'), { recursive: true });
  const report = { url: base.href, puzzleConfigurations, stats, checkedAt: new Date().toISOString() };
  writeFileSync(join(root, 'reports/browser-benchmark.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(`WebGL OK · 4 lock modes · ${puzzleConfigurations} puzzle configurations`);
  console.log(`FPS ${stats.fps} · P95 ${stats.frameP95Ms}ms · ${stats.drawCalls} draw calls`);
} finally {
  await browser.close();
}
