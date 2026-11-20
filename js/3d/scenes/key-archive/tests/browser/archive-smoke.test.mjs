import test, { before, after } from 'node:test';
import { ENTRANCE_CANDLE } from '../../dist/js/archive-candles.js';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { BACKUP_STORAGE_KEY } from '../../dist/js/archive-save-state-with-route.js';
import { BUNDLE_COST, createInitialState, pickupKey, STORAGE_KEY } from '../../dist/js/rules.js';
import { CABINET_CELL_BACK_Z, CABINET_GRID_BOTTOM_Y, CABINET_GROUND_OFFSET, CABINET_HEADER_Y, CABINET_Z, pegForSlot } from '../../dist/js/cabinet-layout.js';
import { FIRST_ROUTE_KEY_ID } from '../../dist/js/first-route.js';
import { FIXTURE_OFFSETS } from '../../dist/js/station-layout.js';
import { RUST_TRAY } from '../../dist/js/wash-forge-stations.js';

// CI renders WebGL in software (SwiftShader, no GPU): frames are 3-60x slower
// than on a desktop, so every wait there gets proportionally more time.
const SLOW = process.env.CI ? 4 : 1;

const directory = resolve(fileURLToPath(new URL('../../dist/', import.meta.url)));
const screenshots = fileURLToPath(new URL('../../test-results/', import.meta.url));
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.webp': 'image/webp', '.png': 'image/png', '.json': 'application/json' };
let server, browser, baseUrl;

before(async () => {
  server = createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      const path = resolve(directory, `.${pathname === '/' ? '/index.html' : pathname}`);
      if (path !== directory && !path.startsWith(directory + sep)) {
        res.writeHead(403).end();
        return;
      }
      const data = await readFile(path);
      res.writeHead(200, { 'Content-Type': `${mime[extname(path)] || 'application/octet-stream'}; charset=utf-8` });
      res.end(data);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}/`;
  const response = await fetch(baseUrl);
  assert.equal(response.status, 200, 'Archive test server must serve index.html');
  await mkdir(screenshots, { recursive: true });
  browser = await chromium.launch({ headless: true,
    args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'] });
  // The game picks its language from the browser; these checks read Russian text.
  const newPage = browser.newPage.bind(browser);
  browser.newPage = async (options = {}) => {
    const page = await newPage({ locale: 'ru-RU', ...options });
    page.setDefaultTimeout(30000 * SLOW);
    return page;
  };
});

after(async () => {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
});

function occupiedSlots(page) {
  return page.locator('#inventory .inventory-slot:has(.slot-name)');
}

async function enterArchive(page, label) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() !== 'error') return;
    if (label === 'canvas' && message.text().includes('Error creating WebGL context')) return;
    errors.push(message.text());
  });
  page.on('response', response => {
    if (response.status() >= 400) errors.push(`HTTP ${response.status()}: ${response.url()}`);
  });
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  try {
    await page.waitForFunction(() => {
      const value = document.querySelector('#fps')?.textContent?.trim();
      return value && value !== '—';
    }, null, { timeout: 30000 * SLOW });
  } catch (error) {
    await page.screenshot({ path: join(screenshots, `archive-${label}-boot-error.png`) });
    const state = await page.evaluate(() => ({ title: document.title,
      fps: document.querySelector('#fps')?.textContent,
      status: document.querySelector('#visual-status')?.textContent,
      scripts: [...document.scripts].map(script => script.src) }));
    throw new Error(`Archive ${label} bootstrap stalled: ${JSON.stringify({ errors, state })}`, { cause: error });
  }
  await page.locator('#start-btn').click();
  assert.equal(await page.locator('#intro').evaluate(element => element.classList.contains('is-hidden')), true);
  assert.deepEqual(errors, []);
  return errors;
}

test('Chromium renders the Three.js hall and opens the visual controls', { timeout: 120000 * SLOW }, async t => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  t.after(() => page.close());
  const errors = await enterArchive(page, 'webgl');
  const visualState = await page.locator('#visual-status').textContent();
  assert.notEqual(visualState, 'Canvas 2D', 'WebGL unexpectedly fell back to Canvas');
  const frameCount = Number(await page.locator('#fps').textContent());
  assert.ok(Number.isFinite(frameCount) && frameCount > 0);
  // SwiftShader can stall on full-page WebGL readback; the smoke test checks
  // live rendering and shader errors instead. Canvas snapshots remain in CI.
  await page.keyboard.press('Escape');
  await page.locator('#pause').waitFor({ state: 'visible' });
  const sound = page.locator('#sound');
  assert.equal(await sound.isChecked(), true);
  await sound.press('Space');
  assert.equal(await sound.isChecked(), false);
  await page.keyboard.press('Escape');
  await page.locator('#pause').waitFor({ state: 'hidden' });
  assert.equal(await page.locator('body').evaluate(body => body.classList.contains('playing')), true);

  await page.keyboard.press('v');
  await page.locator('#visual').waitFor({ state: 'visible' });
  const night = page.locator('#nightLighting');
  assert.equal(await night.isChecked(), false);
  await night.check();
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('keynlock-key-archive-visual-v1')).nightLighting), true);
  await night.uncheck();
  await page.locator('#visual-resume').click();
  assert.equal(await page.locator('#visual').evaluate(element => element.classList.contains('is-hidden')), true);
  const texture = await page.evaluate(async () => {
    const image = new Image();
    image.src = './assets/gouache-entrance-rousseau-v1.webp';
    await image.decode();
    return { width: image.naturalWidth, height: image.naturalHeight };
  });
  assert.deepEqual(texture, { width: 1024, height: 1536 });
  assert.deepEqual(errors, []);
});

test('WebGL animates soaking keys without shader errors', { timeout: 120000 * SLOW }, async t => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  t.after(() => page.close());
  const state = createInitialState();
  const muddy = state.keys.find(key => key.mud && !key.broken);
  const rusty = state.keys.find(key => key.rust && !key.broken && key.id !== muddy.id);
  for (const [key, kind] of [[muddy, 'mud'], [rusty, 'rust']]) {
    key.status = 'bath';
    key.bathId = `center-${kind}`;
    key.bathUntil = Date.now() + 12000;
  }
  await page.addInitScript(({ storageKey, snapshot }) => localStorage.setItem(storageKey, snapshot),
    { storageKey: STORAGE_KEY, snapshot: JSON.stringify(state) });
  const errors = await enterArchive(page, 'webgl-baths');
  assert.equal(await page.locator('#visual-status').textContent() !== 'Canvas 2D', true);
  await page.waitForTimeout(900);
  assert.deepEqual(errors, []);
});

test('Canvas fallback retains keys, migrates old baths and accepts a drop action', { timeout: 120000 * SLOW }, async t => {
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
  t.after(() => page.close());
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      if (['webgl', 'webgl2', 'experimental-webgl'].includes(type)) return null;
      return original.call(this, type, ...args);
    };
  });
  const state = createInitialState();
  const held = state.keys.find(key => !key.broken && !key.mud && !key.rust);
  held.status = 'held';
  state.held = [held.id];
  const muddy = state.keys.find(key => key.mud);
  muddy.status = 'bath';
  muddy.bathId = 'far-mud';
  muddy.bathUntil = Date.now() + 60000;
  await page.addInitScript(({ storageKey, snapshot }) => localStorage.setItem(storageKey, snapshot),
    { storageKey: STORAGE_KEY, snapshot: JSON.stringify(state) });
  const aim = await installTestCamera(page);
  const errors = await enterArchive(page, 'canvas');
  assert.equal(await page.locator('#visual-status').textContent(), 'Canvas 2D');
  assert.equal(await occupiedSlots(page).count(), 1);
  assert.equal(await page.locator('.slot-thumbnail').count(), 1);
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  assert.equal(saved.keys.find(key => key.id === muddy.id).bathId, 'center-mud');
  await page.screenshot({ path: join(screenshots, 'archive-canvas.png') });
  const upper = pegForSlot(7);
  const cellZ = CABINET_Z[held.type % 5] - upper.x;
  await aim([-9.55, 1.78, cellZ], [-10.78, upper.y, cellZ]);
  await page.locator('#interaction-prompt').getByText(/Положить в ячейку 8 ·/).waitFor();
  await page.keyboard.press('r');
  await page.waitForFunction(key => JSON.parse(localStorage.getItem(key))?.held.length === 0, STORAGE_KEY);
  const dropped = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  assert.equal(dropped.keys.find(key => key.id === held.id).status, 'floor');
  await aim([0, 1.78, 3], [0, 1.15, .1]);
  await page.locator('#bath-progress-mud').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#bath-progress-rust').isVisible(), false);
  assert.equal((await page.locator('#bath-progress').innerText()).trim(), '');
  assert.deepEqual(errors, []);
});

async function installTestCamera(page) {
  // Position the test camera precisely without relying on wall-clock movement.
  // Targeting, keyboard input, animations and persistence are the real game.
  await page.route(/\/js\/main\.js\?/, async route => {
    const original = await route.fetch();
    await route.fulfill({ response: original, body: (await original.text()) + `
      export function bathLiftForTest() { return world.workstations.isLifting(state.held[state.selected]); }
      export function throwingForTest(id) { return world.isThrowing(id); }
      export function aimForTest(position, target) {
        camera.position.set(...position);
        camera.lookAt(...target);
        camera.rotation.reorder('YXZ');
        yaw = camera.rotation.y;
        pitch = camera.rotation.x;
      }
    ` });
  });
  return (position, target) => page.evaluate(async ({ position, target }) => {
    const moduleUrl = document.querySelector('script[type="module"]').src;
    const { aimForTest } = await import(moduleUrl);
    aimForTest(position, target);
  }, { position, target });
}

test('a dirty floor key can be cleaned, filed, restored after reload and retrieved', { timeout: 120000 * SLOW }, async t => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  t.after(() => page.close());
  const state = createInitialState();
  state.firstRoute = false;
  const key = state.keys.find(item => item.mud && !item.rust);
  Object.assign(key, { x: 0, z: 18.5, rotation: 0, layer: 0 });

  // Seed once. On reload the game must restore the save it actually wrote.
  await page.addInitScript(({ storageKey, snapshot }) => {
    if (!localStorage.getItem(storageKey)) localStorage.setItem(storageKey, snapshot);
    HTMLCanvasElement.prototype.requestPointerLock = undefined;
  }, { storageKey: STORAGE_KEY, snapshot: JSON.stringify(state) });

  const aim = await installTestCamera(page);
  const prompt = page.locator('#interaction-prompt');
  async function interact(expectPrompt) {
    await prompt.getByText(expectPrompt).waitFor();
    await page.keyboard.press('e');
  }
  async function expectSaved(status, slot, mud) {
    await page.waitForFunction(({ storageKey, id, status, slot, mud }) => {
      const snapshot = JSON.parse(localStorage.getItem(storageKey));
      const saved = snapshot?.keys.find(item => item.id === id);
      return saved?.status === status && (saved.cabinetSlot ?? null) === slot && saved.mud === mud
        && snapshot.held.includes(id) === (status === 'held');
    }, { storageKey: STORAGE_KEY, id: key.id, status, slot, mud });
  }

  const errors = await enterArchive(page, 'webgl-sort');
  await aim([0, 1.78, 20.2], [0, .055, 18.5]);
  await interact(/Взять · подвальный · ГРЯЗЬ/);
  await expectSaved('held', null, true);

  await aim([FIXTURE_OFFSETS.mud, 1.78, 2], [FIXTURE_OFFSETS.mud, 1.22, .13]);
  await interact(/Погрузить ключ/);
  await expectSaved('bath', null, true);
  await interact(/Забрать очищенный ключ/);
  await expectSaved('held', null, false);
  await page.waitForFunction(() => import(document.querySelector('script[type="module"]').src)
    .then(module => !module.bathLiftForTest()));

  const slot = 17;
  const peg = pegForSlot(slot);
  const cell = [-11.58 + CABINET_CELL_BACK_Z * .5, peg.y + CABINET_GROUND_OFFSET, CABINET_Z[0] - peg.x];
  const inFrontOfCell = [cell[0] + 1.8, 1.78, cell[2]];
  await aim(inFrontOfCell, cell);
  await interact(/Положить в ячейку 18/);
  await expectSaved('sorted', slot, false);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('#start-btn').click();
  await aim(inFrontOfCell, cell);
  await interact(/Взять ключ из ячейки 18/);
  await expectSaved('held', null, false);
  const player = inFrontOfCell;
  await aim(player, [player[0] + 3, player[1], player[2]]);
  await page.keyboard.press('r');
  await expectSaved('floor', null, false);
  const inFlight = ({ id, expected }) => import(document.querySelector('script[type="module"]').src)
    .then(module => module.throwingForTest(id) === expected);
  await page.waitForFunction(inFlight, { id: key.id, expected: true }, { timeout: 5000 * SLOW });
  await page.waitForFunction(inFlight, { id: key.id, expected: false }, { timeout: 5000 * SLOW });
  assert.deepEqual(errors, []);
});

test('the starter key can be placed in a suggested cell, retrieved and moved by hand', { timeout: 120000 * SLOW }, async t => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  t.after(() => page.close());
  await page.addInitScript(() => { HTMLCanvasElement.prototype.requestPointerLock = undefined; });
  const aim = await installTestCamera(page);
  // Exercise the new game script against the entry markup cached before the route.
  await page.route(baseUrl, async route => {
    const response = await route.fetch();
    const html = (await response.text()).replace('main.js?v=bath-index', 'main.js?v=archive-entry-fix');
    await route.fulfill({ response, body: html });
  });
  const errors = await enterArchive(page, 'webgl-entrance-route');
  const goal = page.locator('#first-route-goal');
  const marker = page.locator('#first-route-marker');
  await goal.getByText(/Подними отмеченный чистый ключ/).waitFor();
  await marker.waitFor({ state: 'visible' });

  const starter = await page.evaluate(({ storageKey, id }) =>
    JSON.parse(localStorage.getItem(storageKey)).keys.find(key => key.id === id),
  { storageKey: STORAGE_KEY, id: FIRST_ROUTE_KEY_ID });
  assert.equal(starter.broken || starter.mud || starter.rust, false);
  await aim([0, 1.78, 20.2], [starter.x, .05, starter.z]);
  await page.locator('#interaction-prompt').getByText(/Взять · братства/).waitFor();
  await page.keyboard.press('e');
  await goal.getByText(/Отнеси ключ в шкаф «Братства» · справа/).waitFor();

  await aim([4, 1.78, 19], [11.58, CABINET_HEADER_Y, CABINET_Z[4]]);
  await marker.waitFor({ state: 'visible' });
  const cabinetFront = 11.58 - .74 * .5;
  const cabinetZ = CABINET_Z[4];
  const interaction = page.locator('#interaction-prompt');
  await aim([cabinetFront - 1.8, 1.78, cabinetZ], [cabinetFront, CABINET_GRID_BOTTOM_Y + CABINET_GROUND_OFFSET - .15, cabinetZ]);
  await interaction.getByText(/Положить в ячейку .*можно навести на другую/).waitFor();
  const promptBox = await interaction.boundingBox();
  assert.ok(promptBox.y > page.viewportSize().height * .65, 'the prompt stays below the reticle');
  const suggested = Number((await interaction.textContent()).match(/ячейку (\d+)/)[1]) - 1;
  await page.keyboard.press('e');
  await goal.waitFor({ state: 'hidden' });
  const saved = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  const state = await saved();
  const starterKey = archive => archive.keys.find(key => key.id === FIRST_ROUTE_KEY_ID);
  assert.equal(state.firstRoute, false);
  assert.equal(starterKey(state).status, 'sorted');
  assert.equal(starterKey(state).cabinetSlot, suggested);

  function aimAtCell(slot, distance = 1.8) {
    const peg = pegForSlot(slot);
    const cell = [11.58 - CABINET_CELL_BACK_Z * .5, peg.y + CABINET_GROUND_OFFSET, cabinetZ + peg.x];
    return aim([cell[0] - distance, 1.78, cell[2]], cell);
  }
  await aimAtCell(suggested);
  await interaction.getByText(new RegExp(`Взять ключ из ячейки ${suggested + 1} ·`)).waitFor();
  await page.keyboard.press('e');
  await occupiedSlots(page).first().waitFor();
  assert.equal(starterKey(await saved()).status, 'held');

  const manual = 7;
  assert.notEqual(suggested, manual);
  await aimAtCell(manual, 1.225);
  await interaction.getByText(/Положить в ячейку 8 ·/).waitFor();
  await page.keyboard.press('e');
  await occupiedSlots(page).first().waitFor({ state: 'hidden' });
  assert.equal(starterKey(await saved()).cabinetSlot, manual);
  assert.deepEqual(errors, []);
});

test('the postprocessing pipeline preserves subpixel coverage on thin silhouettes', { timeout: 45000 * SLOW }, async t => {
  const page = await browser.newPage();
  t.after(() => page.close());
  await page.route('**/coverage-fixture', route => route.fulfill({
    contentType: 'text/html', body: '<!doctype html><title>Coverage fixture</title>',
  }));
  await page.goto(new URL('coverage-fixture', baseUrl).href);
  const result = await page.evaluate(async () => {
    const THREE = await import('/vendor/three.js');
    const { createPaintedRenderer } = await import('/js/painted-renderer.js');
    const { DEFAULT_VISUAL_SETTINGS } = await import('/js/visual-settings.js');
    const size = 64;
    const renderer = new THREE.WebGLRenderer({ canvas: document.createElement('canvas') });
    renderer.setSize(size, size);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0);
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .05, 50);
    camera.position.z = 2;
    const thin = new THREE.Mesh(new THREE.PlaneGeometry(.032, 1.4), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    thin.rotation.z = .47;
    scene.add(thin);

    const target = new THREE.WebGLRenderTarget(size, size);
    const pixels = new Uint8Array(size * size * 4);
    const supportedSamples = renderer.capabilities.maxSamples;
    const settings = { ...DEFAULT_VISUAL_SETTINGS, toonEnabled: false, outlineEnabled: false };
    function compare(maxSamples) {
      renderer.capabilities.maxSamples = maxSamples;
      const painter = createPaintedRenderer(renderer, scene, camera, settings);
      let partialPixels = 0;
      for (let step = 0; step < 5; step++) {
        camera.position.x = step * .004;
        renderer.setRenderTarget(target);
        painter.render();
        renderer.readRenderTargetPixels(target, 0, 0, size, size, pixels);
        for (let index = 0; index < pixels.length; index += 4) {
          if (pixels[index] > 12 && pixels[index] < 243) partialPixels++;
        }
      }
      painter.dispose();
      return partialPixels;
    }
    const sharp = compare(0);
    const smoothed = compare(supportedSamples);
    const gl = renderer.getContext();
    const error = gl.getError();
    target.dispose();
    thin.geometry.dispose();
    thin.material.dispose();
    renderer.dispose();
    return { supportedSamples, sharp, smoothed, error };
  });
  assert.ok(result.supportedSamples >= 2, 'Chromium fixture supports multisampling');
  assert.equal(result.error, 0);
  assert.ok(result.smoothed > result.sharp + 30, JSON.stringify(result));
});

test('outline stays continuous across a slanted edge and yields to foreground dust', { timeout: 45000 * SLOW }, async t => {
  const page = await browser.newPage();
  t.after(() => page.close());
  await page.route('**/ink-fixture', route => route.fulfill({
    contentType: 'text/html', body: '<!doctype html><title>Ink fixture</title>',
  }));
  await page.goto(new URL('ink-fixture', baseUrl).href);
  const result = await page.evaluate(async () => {
    const THREE = await import('/vendor/three.js');
    const { createPaintedRenderer } = await import('/js/painted-renderer.js');
    const { addDust } = await import('/js/world-particles.js');
    const { DEFAULT_VISUAL_SETTINGS } = await import('/js/visual-settings.js');
    const size = 96;
    const renderer = new THREE.WebGLRenderer({ alpha: false });
    renderer.setSize(size, size);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf8ede0);
    const camera = new THREE.PerspectiveCamera(45, 1, .055, 100);
    camera.position.z = 4;
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(1, 3, .4),
      new THREE.MeshBasicMaterial({ color: 0xcdb99f }));
    pillar.position.x = -.5;
    pillar.rotation.z = .09;
    scene.add(pillar);

    const dust = addDust(scene);
    const count = dust.geometry.attributes.position.count;
    const pointSize = dust.material.size;
    const dustAlphas = time => {
      dust.update(time);
      return Array.from({ length: count }, (_, i) => dust.geometry.attributes.color.getW(i));
    };
    const start = dustAlphas(1000);
    const nextFrame = dustAlphas(1016);
    const later = dustAlphas(7000);
    const maxFadeStep = Math.max(...start.map((alpha, i) => Math.abs(alpha - nextFrame[i])));
    const appeared = start.some((alpha, i) => alpha === 0 && later[i] > .5);
    const disappeared = start.some((alpha, i) => alpha > .5 && later[i] === 0);
    dust.material.size = .8;
    dust.geometry.setDrawRange(0, 1);
    dust.geometry.attributes.color.setXYZW(0, 1, 1, 1, 1);
    const settings = { ...DEFAULT_VISUAL_SETTINGS, toonEnabled: true };
    const painter = createPaintedRenderer(renderer, scene, camera, settings);
    const target = new THREE.WebGLRenderTarget(size, size);
    renderer.setRenderTarget(target);

    function render(ink) {
      painter.setSettings({ ...settings, outlineEnabled: ink });
      painter.render();
      const pixels = new Uint8Array(size * size * 4);
      renderer.readRenderTargetPixels(target, 0, 0, size, size, pixels);
      return pixels;
    }
    function inkPerRow(clear, outlined) {
      return Array.from({ length: 56 }, (_, row) => {
        let ink = 0;
        for (let x = 40; x < 56; x++) {
          const index = ((row + 20) * size + x) * 4;
          ink += Math.max(0, clear[index] - outlined[index]);
        }
        return ink;
      });
    }
    dust.visible = false;
    const bare = inkPerRow(render(false), render(true));
    dust.visible = true;
    dust.geometry.attributes.position.setXYZ(0, 0, 0, 1);
    dust.geometry.attributes.position.needsUpdate = true;
    const front = inkPerRow(render(false), render(true));
    dust.geometry.attributes.position.setXYZ(0, -.25, 0, -1);
    dust.geometry.attributes.position.needsUpdate = true;
    const behind = inkPerRow(render(false), render(true));
    return { bareMin: Math.min(...bare), bareMax: Math.max(...bare),
      front: front[28], behind: behind[28], bare: bare[28],
      appeared, disappeared, count, pointSize, maxFadeStep };
  });
  assert.equal(result.count, 840);
  assert.equal(result.pointSize, .0305);
  assert.ok(result.appeared && result.disappeared && result.maxFadeStep < .03, JSON.stringify(result));
  assert.ok(result.bareMin > 0, JSON.stringify(result));
  assert.ok(result.bareMax / result.bareMin < 2, JSON.stringify(result));
  assert.ok(result.front < result.bare / 5, JSON.stringify(result));
  assert.ok(result.behind > result.bare / 2, JSON.stringify(result));
});

test('a carried key brightens in a window beam and fades back in shade', { timeout: 60000 * SLOW }, async t => {
  const page = await browser.newPage({ viewport: { width: 960, height: 640 } });
  t.after(() => page.close());
  const state = createInitialState();
  const key = state.keys.find(item => !item.broken && !item.mud && !item.rust);
  key.status = 'held';
  state.held = [key.id];
  state.firstRoute = false;
  await page.addInitScript(({ key, snapshot }) => localStorage.setItem(key, snapshot),
    { key: STORAGE_KEY, snapshot: JSON.stringify(state) });
  await page.route('**/js/held-key-light.js?*', async route => {
    const original = await route.fetch();
    await route.fulfill({ response: original, body: (await original.text()).replace(
      'const materials = new Map();', 'window.heldWindowLightForTest = strength; const materials = new Map();') });
  });
  const aim = await installTestCamera(page);
  const errors = await enterArchive(page, 'webgl-held-window-light');
  await occupiedSlots(page).first().waitFor();

  async function faceWindow(z) {
    await aim([-1.18, 1.78, z], [-5, 1.78, z]);
  }
  await faceWindow(14);
  await page.waitForFunction(() => window.heldWindowLightForTest?.value < .01);
  await faceWindow(15.95);
  await page.waitForFunction(() => window.heldWindowLightForTest?.value > .55);
  await faceWindow(14);
  await page.waitForFunction(() => window.heldWindowLightForTest?.value < .01);
  assert.deepEqual(errors, []);
});

test('Escape resumes keyboard play after the browser itself releases pointer lock', { timeout: 60000 * SLOW }, async t => {
  const page = await browser.newPage({ viewport: { width: 960, height: 640 } });
  t.after(() => page.close());
  await page.addInitScript(() => {
    let locked = null;
    Object.defineProperty(document, 'pointerLockElement', { get: () => locked });
    HTMLCanvasElement.prototype.requestPointerLock = function () {
      locked = this;
      document.dispatchEvent(new Event('pointerlockchange'));
      return Promise.resolve();
    };
    document.exitPointerLock = () => {
      locked = null;
      document.dispatchEvent(new Event('pointerlockchange'));
    };
    window.addEventListener('keydown', event => {
      if (event.key === 'Escape' && locked) document.exitPointerLock();
    }, { capture: true });
  });
  const errors = await enterArchive(page, 'webgl-native-escape');
  assert.equal(await page.evaluate(() => document.pointerLockElement?.id), 'world');

  await page.keyboard.down('Escape');
  const pause = page.locator('#pause');
  await pause.waitFor({ state: 'visible' });
  await page.keyboard.down('Escape');
  assert.equal(await pause.isVisible(), true);
  await page.keyboard.up('Escape');
  await page.keyboard.press('Escape');
  await pause.waitFor({ state: 'hidden' });
  assert.equal(await page.locator('body').evaluate(body => body.classList.contains('playing')), true);
  assert.deepEqual(errors, []);
});

test('the bird flies across the windows and briefly shades the existing floor light', { timeout: 45000 * SLOW }, async t => {
  const page = await browser.newPage();
  t.after(() => page.close());
  await page.route('**/bird-fixture', route => route.fulfill({
    contentType: 'text/html', body: '<!doctype html><title>Window bird fixture</title>',
  }));
  await page.goto(new URL('bird-fixture', baseUrl).href);
  const result = await page.evaluate(async () => {
    const THREE = await import('/vendor/three.js');
    const { addWindowBird } = await import('/js/archive-window-bird.js');
    const { addEntranceLighting } = await import('/js/archive-entrance-light.js');
    const { addWindowAirLight } = await import('/js/archive-window-rays.js');
    const { WINDOW_CENTERS, addWindowedWall, addArchedWindow } = await import('/js/hall-architecture.js');
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x403530);
    const bird = addWindowBird(scene);
    const mesh = scene.getObjectByName('Window bird');
    addEntranceLighting(scene, bird.shadowUniforms)(1);
    const pose = bird.shadowUniforms.uWindowBirdPose.value;
    bird.update(0);
    const idle = !mesh.visible && pose.z === 0;
    const passed = [...WINDOW_CENTERS].reverse().map(z => {
      bird.update(6000 + (22 - z) / 44 * 8800);
      return mesh.visible && mesh.position.x < -11.884 && Math.abs(mesh.position.z - z) < .01;
    });
    bird.update(14900);
    const done = !mesh.visible && pose.z === 0;

    const fixture = new THREE.Scene();
    fixture.background = scene.background;
    const active = addWindowBird(fixture);
    active.update(0);
    active.update(10400);
    addEntranceLighting(fixture, active.shadowUniforms)(1);
    const renderer = new THREE.WebGLRenderer();
    const camera = new THREE.OrthographicCamera(-3, 3, 2, -2, .1, 15);
    camera.position.set(0, 5, -2);
    camera.up.set(0, 0, -1);
    camera.lookAt(0, 0, -2);
    const size = 96;
    const target = new THREE.WebGLRenderTarget(size, size);
    renderer.setRenderTarget(target);
    function render() {
      const pixels = new Uint8Array(size * size * 4);
      renderer.render(fixture, camera);
      renderer.readRenderTargetPixels(target, 0, 0, size, size, pixels);
      return pixels;
    }
    const covered = render();
    active.shadowUniforms.uWindowBirdPose.value.z = 0;
    const open = render();
    let darkened = 0;
    let brighter = 0;
    for (let i = 2; i < open.length; i += 4) {
      if (open[i] - covered[i] > 3) darkened++;
      if (covered[i] - open[i] > 1) brighter++;
    }
    const silhouette = fixture.getObjectByName('Window bird');
    fixture.background = new THREE.Color(0xbad6ec);
    const frame = new THREE.MeshBasicMaterial({ color: 0x746257 });
    addWindowedWall(fixture, -1, frame);
    addArchedWindow(fixture, -1, 0, {
      glass: new THREE.MeshBasicMaterial({ color: 0xe8d9bc, transparent: true, opacity: .51, depthWrite: false }),
      windowLight: new THREE.MeshBasicMaterial({ color: 0xffdfab, transparent: true, opacity: .17, depthWrite: false }),
      agedBronze: frame, cabinetWalnut: frame,
    });
    camera.position.set(-6, silhouette.position.y, 0);
    camera.up.set(0, 1, 0);
    camera.lookAt(-12, silhouette.position.y, 0);
    const throughWindow = render();
    silhouette.visible = false;
    const sky = render();
    let silhouettePixels = 0;
    for (let i = 0; i < sky.length; i += 4)
      if (sky[i] - throughWindow[i] > 12) silhouettePixels++;

    camera.position.z = 3;
    camera.lookAt(-12, silhouette.position.y, 3);
    silhouette.position.z = 3;
    silhouette.visible = true;
    const behindWall = render();
    silhouette.visible = false;
    const wall = render();
    const maskedByWall = behindWall.every((value, i) => value === wall[i]);
    const air = new THREE.Scene();
    air.background = new THREE.Color(0x403530);
    active.update(10400);
    addWindowAirLight(air, active.shadowUniforms)(1);
    camera.position.set(-4, 3.4, 7);
    camera.lookAt(-6, 4.3, -1);
    function renderAir() {
      const pixels = new Uint8Array(size * size * 4);
      renderer.render(air, camera);
      renderer.readRenderTargetPixels(target, 0, 0, size, size, pixels);
      return pixels;
    }
    const occludedAir = renderAir();
    active.shadowUniforms.uWindowBirdPose.value.z = 0;
    const brightAir = renderAir();
    let shadedAirPixels = 0;
    for (let i = 2; i < brightAir.length; i += 4)
      if (brightAir[i] - occludedAir[i] > 2) shadedAirPixels++;
    return { idle, passed, done, darkened, brighter, silhouettePixels, maskedByWall, shadedAirPixels,
      error: renderer.getContext().getError() };
  });
  assert.equal(result.error, 0);
  assert.ok(result.idle && result.done && result.passed.every(Boolean), JSON.stringify(result));
  assert.ok(result.darkened > 12 && result.brighter === 0, JSON.stringify(result));
  assert.ok(result.silhouettePixels > 8 && result.maskedByWall, JSON.stringify(result));
  assert.ok(result.shadedAirPixels > 5, JSON.stringify(result));
});

test('rust requires thirty seconds and the bath bar follows the cleaning timer', { timeout: 60000 * SLOW }, async t => {
  const page = await browser.newPage({ viewport: { width: 960, height: 640 } });
  t.after(() => page.close());
  const state = createInitialState();
  const key = state.keys.find(item => item.rust && !item.mud && !item.broken);
  key.status = 'held';
  state.held = [key.id];
  state.firstRoute = false;
  await page.addInitScript(({ key, snapshot }) => localStorage.setItem(key, snapshot),
    { key: STORAGE_KEY, snapshot: JSON.stringify(state) });
  const aim = await installTestCamera(page);
  const errors = await enterArchive(page, 'webgl-rust-timer');
  // The rust solution sits in a low tray: aim at its liquid, not above it.
  await aim([FIXTURE_OFFSETS.rust, 1.78, 2], [FIXTURE_OFFSETS.rust, RUST_TRAY.surface, .1]);
  await page.locator('#interaction-prompt').getByText(/Погрузить ключ/).waitFor();
  await page.keyboard.press('e');
  const progress = page.locator('#bath-progress-rust');
  await progress.waitFor({ state: 'visible' });
  await page.waitForFunction(() => document.querySelector('#bath-progress-rust').dataset.state === 'processing');
  const read = () => page.evaluate(({ storageKey, id }) =>
    JSON.parse(localStorage.getItem(storageKey)).keys.find(item => item.id === id),
  { storageKey: STORAGE_KEY, id: key.id });
  const soaking = await read();
  assert.equal(soaking.status, 'bath');
  // Deadlines are in station time (it runs only during play), saved with the dip.
  const stationTime = await page.evaluate(storageKey =>
    JSON.parse(localStorage.getItem(storageKey)).stationTime, STORAGE_KEY);
  const soakMs = soaking.bathUntil - stationTime;
  assert.ok(soakMs > 29000 && soakMs <= 30000, `soak of ${soakMs} ms`);
  await aim([0, 1.78, 3], [0, 1.15, .1]);
  assert.equal(await progress.isVisible(), true, 'readiness stays visible without aiming at the bath');
  assert.equal(await page.locator('#bath-progress-mud').isVisible(), false, 'the empty bath has no bar');
  assert.equal((await page.locator('#bath-progress').innerText()).trim(), '', 'the bars have no visible text');
  await aim([FIXTURE_OFFSETS.rust, 1.78, 2], [FIXTURE_OFFSETS.rust, RUST_TRAY.surface, .1]);
  await page.keyboard.press('e');
  assert.equal((await read()).status, 'bath');
  // Station timers run on performance.now during play (not on Date.now):
  // jump that clock past the soak instead of waiting thirty seconds.
  await page.evaluate(() => {
    const original = performance.now.bind(performance);
    performance.now = () => original() + 31000;
  });
  await page.waitForFunction(() => document.querySelector('#bath-progress-rust').dataset.state === 'ready');
  await progress.waitFor({ state: 'hidden' });
  await page.keyboard.press('e');
  await occupiedSlots(page).first().waitFor();
  assert.equal((await read()).rust, false);
  assert.deepEqual(errors, []);
});

test('a foreground key covers the bath hover outline', { timeout: 45000 * SLOW }, async t => {
  const page = await browser.newPage();
  t.after(() => page.close());
  await page.route('**/bath-outline-fixture', route => route.fulfill({
    contentType: 'text/html', body: '<!doctype html><title>Bath outline fixture</title>',
  }));
  await page.goto(new URL('bath-outline-fixture', baseUrl).href);
  const result = await page.evaluate(async () => {
    const THREE = await import('/vendor/three.js');
    const { createKeyHoverOutline } = await import('/js/key-hover-outline.js');
    const size = 96;
    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(size, size);
    const camera = new THREE.OrthographicCamera(-1.3, 1.3, 1.3, -1.3, .055, 20);
    camera.position.z = 5;
    const scene = new THREE.Scene();
    const bowlGeometry = new THREE.PlaneGeometry(1.6, 1.4);
    scene.add(new THREE.Mesh(bowlGeometry, new THREE.MeshBasicMaterial({ color: 0x364946 })));
    const key = new THREE.Mesh(new THREE.BoxGeometry(.27, .7, .18), new THREE.MeshBasicMaterial({ color: 0x6e3825 }));
    key.position.set(.8, 0, .9);
    scene.add(key);
    const target = new THREE.WebGLRenderTarget(size, size);
    target.depthTexture = new THREE.DepthTexture(size, size, THREE.UnsignedIntType);
    const geometryMask = new THREE.Mesh(bowlGeometry);
    const depthOutline = createKeyHoverOutline(renderer, camera, geometryMask, { depthAware: true });
    geometryMask.visible = true;
    const composited = new THREE.WebGLRenderTarget(size, size);
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
    function draw(depth) {
      renderer.setRenderTarget(composited);
      renderer.render(scene, camera);
      depthOutline.render(1, null, depth);
      const pixels = new Uint8Array(size * size * 4);
      renderer.readRenderTargetPixels(composited, 0, 0, size, size, pixels);
      const sumBright = (from, to) => {
        let count = 0;
        for (let y = from; y < to; y++) for (let x = 77; x < 82; x++) {
          const i = (y * size + x) * 4;
          if (pixels[i] > 200 && pixels[i + 1] > 200) count++;
        }
        return count;
      };
      return [sumBright(42, 54), sumBright(64, 70)];
    }
    const unmasked = draw(null);
    const masked = draw(target.depthTexture);
    depthOutline.dispose();
    return { unmasked, masked, error: renderer.getContext().getError() };
  });
  assert.equal(result.error, 0);
  assert.ok(result.unmasked[0] > 0 && result.masked[0] === 0, JSON.stringify(result));
  assert.ok(result.masked[1] > 0, JSON.stringify(result));
});

test('archive recovers held progress after a corrupt primary and a failed startup write', { timeout: 100000 * SLOW }, async t => {
  const page = await browser.newPage();
  t.after(() => page.close());
  const saved = createInitialState();
  const key = saved.keys.find(item => !item.broken);
  pickupKey(saved, key.id);
  await page.addInitScript(({ primary, backup, snapshot }) => {
    if (sessionStorage.getItem('archive-recovery-seeded')) return;
    sessionStorage.setItem('archive-recovery-seeded', 'yes');
    localStorage.setItem(primary, '{');
    localStorage.setItem(backup, snapshot);
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (this === localStorage && key === primary) throw new Error('simulated write failure');
      return original.call(this, key, value);
    };
  }, { primary: STORAGE_KEY, backup: BACKUP_STORAGE_KEY, snapshot: JSON.stringify(saved) });
  await enterArchive(page, 'save-recovery');
  assert.match(await page.locator('#save-status').textContent(), /Не удалось записать прогресс/);
  assert.equal(await occupiedSlots(page).count(), 1);
  assert.equal(await page.evaluate(primary => localStorage.getItem(primary), STORAGE_KEY), '{');
  assert.deepEqual(await page.evaluate(backup => JSON.parse(localStorage.getItem(backup)).held, BACKUP_STORAGE_KEY), [key.id]);
  await page.reload();
  await page.getByRole('button', { name: /войти в архив/i }).click();
  assert.match(await page.locator('#save-status').textContent(), /Прогресс восстановлен/);
  assert.equal(await occupiedSlots(page).count(), 1);
  assert.deepEqual(await page.evaluate(primary => JSON.parse(localStorage.getItem(primary)).held, STORAGE_KEY), [key.id]);
});

test('the outline preserves the metal color inside a two-pixel shaft', { timeout: 45000 * SLOW }, async t => {
  const page = await browser.newPage();
  t.after(() => page.close());
  await page.route('**/ink-color-fixture', route => route.fulfill({
    contentType: 'text/html', body: '<!doctype html><title>Thin metal color</title>',
  }));
  await page.goto(new URL('ink-color-fixture', baseUrl).href);
  const result = await page.evaluate(async () => {
    const THREE = await import('/vendor/three.js');
    const { createPaintedRenderer } = await import('/js/painted-renderer.js');
    const { DEFAULT_VISUAL_SETTINGS } = await import('/js/visual-settings.js');
    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(96, 96);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xeadbc7);
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .055, 100);
    camera.position.z = 4;
    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2 / 48, 1),
      new THREE.MeshBasicMaterial({ color: 0x25c6ac })));
    const settings = { ...DEFAULT_VISUAL_SETTINGS, toonEnabled: false };
    const painter = createPaintedRenderer(renderer, scene, camera, settings);
    const target = new THREE.WebGLRenderTarget(96, 96);
    renderer.setRenderTarget(target);
    function sample(ink, x) {
      painter.setSettings({ ...settings, outlineEnabled: ink });
      painter.render();
      const rgba = new Uint8Array(4);
      renderer.readRenderTargetPixels(target, x, 48, 1, 1, rgba);
      return [...rgba];
    }
    const clear = sample(false, 48), outlined = sample(true, 48);
    const background = sample(false, 46), exteriorInk = sample(true, 46);
    painter.dispose(); target.dispose(); renderer.dispose();
    return { clear, outlined, background, exteriorInk };
  });
  assert.ok(result.outlined[1] >= result.clear[1] * .9, JSON.stringify(result));
  assert.ok(result.exteriorInk[0] < result.background[0] - 10, JSON.stringify(result));
});

test('completed rows and cabinets celebrate after the last key lands', { timeout: 120000 * SLOW }, async t => {
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  t.after(() => page.close());
  await page.route('**/js/main.js*', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: await response.text() + `
      window.cabinetTest={world,state,sceneNow,view(position,target){camera.position.set(...position);
        camera.lookAt(...target);camera.rotation.reorder('YXZ');yaw=camera.rotation.y;pitch=camera.rotation.x;edgeLook.until=0;}};` });
  });
  await page.route('**/completion-seed', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html>' }));
  for (const { count, canvas } of [{ count: 11 }, { count: 95 }, { count: 95, canvas: true }]) {
    if (canvas) await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(type, ...args) {
        return ['webgl','webgl2','experimental-webgl'].includes(type) ? null : original.call(this,type,...args);
      };
    });
    await page.goto(new URL('completion-seed', baseUrl).href);
    await page.evaluate(async count => {
      const { createInitialState, STORAGE_KEY } = await import('/js/rules.js');
      const state = createInitialState();
      const family = state.keys.filter(key => key.type === 3 && !key.broken);
      family.slice(0, count).forEach((key, slot) => Object.assign(key,
        { status: 'sorted', cabinetSlot: slot, mud: false, rust: false, wax: false }));
      Object.assign(family[count], { status: 'held', mud: false, rust: false, wax: false });
      state.held = [family[count].id];
      localStorage.clear(); localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }, count);
    const errors = await enterArchive(page, canvas ? 'canvas' : `completion-${count}`);
    await page.evaluate(async slot => {
      const { pegForSlot, CABINET_CELL_BACK_Z } = await import('/js/cabinet-layout.js');
      const q = window.cabinetTest, cabinet = q.world.cabinets[3], peg = pegForSlot(slot);
      const aim = cabinet.group.localToWorld(new q.world.THREE.Vector3(peg.x, peg.y, cabinet.cellAimDepth ?? CABINET_CELL_BACK_Z));
      q.view([aim.x + 2.1, 1.78, aim.z], aim.toArray());
    }, count);
    await page.waitForFunction(() => document.querySelector('#interaction-prompt')?.textContent.includes('Положить'));
    const startedBefore = await page.evaluate(() => window.cabinetTest.world.cabinets[3].completion.rowsStarted());
    await page.keyboard.press('e');
    // The celebration itself lasts 2.25 s of scene time; on software-rendered
    // CI one frame can take longer than that, so check what it leaves behind:
    // exactly one row celebration started, for the row this key completed.
    await page.waitForFunction(before =>
      window.cabinetTest.world.cabinets[3].completion.rowsStarted() > before, startedBefore);
    const row = count === 11 ? 0 : 7;
    const earned = await page.evaluate(() => {
      const completion = window.cabinetTest.world.cabinets[3].completion;
      return { started: completion.rowsStarted(), complete: completion.isComplete() };
    });
    assert.equal(earned.started, startedBefore + 1);
    assert.equal(earned.complete, count === 95);
    // Celebrations run on the scene clock, which stops in menus (not on performance.now).
    await page.waitForFunction(() => {
      const frame = window.cabinetTest.world.cabinets[3].completion.frame(window.cabinetTest.sceneNow());
      return !frame.rows.length && !frame.cabinet;
    });
    const after = await page.evaluate(() => {
      const completion = window.cabinetTest.world.cabinets[3].completion;
      return { ...completion.frame(window.cabinetTest.sceneNow()), settled: completion.settledRows() };
    });
    assert.ok(after.settled & (1 << row), `row ${row} is full and its celebration finished`);
    assert.equal(after.crownGlow > 0, count === 95);
    assert.deepEqual(errors, []);
  }
});

test('wax also melts at the lit candles beside a completed cabinet', { timeout: 90000 * SLOW }, async t => {
  const page = await browser.newPage({ viewport: { width: 1024, height: 720 } });
  t.after(() => page.close());
  await page.addInitScript(() => {
    HTMLCanvasElement.prototype.requestPointerLock = undefined;
    HTMLMediaElement.prototype.play = async () => {};
  });
  await page.route('**/shelf-candle-seed', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html>' }));
  await page.route('**/js/main.js*', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: await response.text() + `
      window.shelfCandleTest = { world, state, view(position, target) {
        camera.position.set(...position); camera.lookAt(...target);
        camera.rotation.reorder('YXZ'); yaw = camera.rotation.y; pitch = camera.rotation.x;
        edgeLook.until = 0;
      }};` });
  });
  await page.goto(new URL('shelf-candle-seed', baseUrl).href);
  await page.evaluate(async () => {
    const { createInitialState, STORAGE_KEY } = await import('/js/rules.js');
    const state = createInitialState();
    // Cabinet 3 is complete, so both of its wall candles burn.
    state.keys.filter(key => key.type === 3 && !key.broken).forEach((key, slot) =>
      Object.assign(key, { status: 'sorted', cabinetSlot: slot, mud: false, rust: false, wax: false }));
    const waxed = state.keys.find(key => key.type !== 3 && key.wax && !key.broken && key.status === 'floor');
    waxed.status = 'held';
    state.held = [waxed.id];
    state.firstRoute = false;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  });
  const errors = await enterArchive(page, 'shelf-candle');
  const candle = await page.evaluate(() => {
    const lit = window.shelfCandleTest.world.candles.filter(item => item.type === 3 && item.collider.userData.lit);
    const target = lit[0].collider.getWorldPosition(new window.shelfCandleTest.world.THREE.Vector3());
    return { count: lit.length, id: lit[0].id, target: target.toArray() };
  });
  assert.equal(candle.count, 2, 'both candles of the finished cabinet are lit');
  const [x, y, z] = candle.target;
  // Stand in the hall, a step away from the wall candle, and look at it.
  await page.evaluate(([x, y, z]) => window.shelfCandleTest.view([x + Math.sign(-x) * 1.25, 1.78, z], [x, y, z]), [x, y, z]);
  const prompt = page.locator('#interaction-prompt');
  await prompt.getByText(/Поднести ключ к пламени/).waitFor();
  await page.keyboard.press('e');
  await prompt.getByText(/Воск тает/).waitFor();
  await page.waitForFunction(() => !window.shelfCandleTest.state.keys.some(key => key.wax && key.status === 'held'));
  assert.deepEqual(errors, []);
});

test('aerial perspective preserves close colors and softens distant contrast', { timeout: 45000 * SLOW }, async t => {
  const page = await browser.newPage(); t.after(() => page.close());
  await page.route('**/depth-fixture', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html>' }));
  await page.goto(new URL('depth-fixture', baseUrl).href);
  const result = await page.evaluate(async () => {
    const THREE = await import('/vendor/three.js');
    const { createDistanceBlurShader } = await import('/js/painted-shader.js');
    const renderer = new THREE.WebGLRenderer(); renderer.setSize(16, 16);
    const color = new THREE.DataTexture(new Uint8Array([180,80,40,255]), 1, 1); color.needsUpdate = true;
    const depth = new THREE.DataTexture(new Float32Array(1), 1, 1, THREE.RedFormat, THREE.FloatType);
    const { shader, uniforms } = createDistanceBlurShader();
    uniforms.tScene.value = color; uniforms.tDepth.value = depth; uniforms.uResolution.value.set(16,16);
    const scene = new THREE.Scene(); scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2), shader));
    const target = new THREE.WebGLRenderTarget(16,16); renderer.setRenderTarget(target);
    function sample(distance) {
      const n=uniforms.uNear.value, f=uniforms.uFar.value;
      depth.image.data[0] = (f - n*f/distance)/(f-n); depth.needsUpdate = true;
      renderer.render(scene, new THREE.Camera());
      const pixel = new Uint8Array(4); renderer.readRenderTargetPixels(target,8,8,1,1,pixel); return [...pixel];
    }
    const near=sample(5), far=sample(35);
    color.dispose();depth.dispose();target.dispose();shader.dispose();renderer.dispose();return {near,far};
  });
  assert.ok(Math.abs(result.near[0]-180)<3 && Math.abs(result.near[2]-40)<3, JSON.stringify(result));
  assert.ok(result.far[0] < result.near[0]-8 && result.far[2] > result.near[2]+8, JSON.stringify(result));
});

test('wax melts at the entrance and a bundle lights cabinet candles in both renderers', { timeout: 120000 * SLOW }, async t => {
  for (const canvas of [false, true]) {
    const page = await browser.newPage({ viewport: { width: 1024, height: 720 } });
    t.after(() => page.close());
    await page.addInitScript(canvas => {
      HTMLCanvasElement.prototype.requestPointerLock = undefined;
      HTMLMediaElement.prototype.play = async () => {};
      if (!canvas) return;
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...args) {
        return ['webgl', 'webgl2', 'experimental-webgl'].includes(type) ? null : original.call(this, type, ...args);
      };
    }, canvas);
    await page.route('**/candle-seed', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html>' }));
    await page.route('**/js/main.js*', async route => {
      const response = await route.fetch();
      await route.fulfill({ response, body: await response.text() + `
        const cabinetContacts = [], launches = [];
        const animatePlace = world.animatePlace;
        world.animatePlace = (key, slot, options) => {
          launches.push({slot, delay:options?.delay});
          animatePlace(key, slot, options);
        };
        const updateWorld = world.update;
        world.update = (now, moving, playing, sound) => updateWorld(now, moving, playing, (kind, position) => {
          if (kind === 'place') cabinetContacts.push(now);
          sound(kind, position);
        });
        window.candleTest = { world, state, cabinetContacts, launches, view(position, target) {
          camera.position.set(...position); camera.lookAt(...target);
          camera.rotation.reorder('YXZ'); yaw = camera.rotation.y; pitch = camera.rotation.x;
          edgeLook.until = 0;
        }};` });
    });
    await page.goto(new URL('candle-seed', baseUrl).href);
    await page.evaluate(async cost => {
      const { createInitialState, STORAGE_KEY } = await import('/js/rules.js');
      const state = createInitialState();
      const family = state.keys.filter(key => key.type === 3 && !key.broken);
      family.forEach((key, slot) => Object.assign(key, { mud: false, rust: false, wax: slot === 95 },
        slot < 92 ? { status: 'sorted', cabinetSlot: slot } : { status: 'held' }));
      state.held = family.slice(92).map(key => key.id);
      state.selected = 3;
      state.firstRoute = false;
      state.metal = cost;
      state.keys.filter(key => key.broken).slice(0, cost).forEach(key => { key.status = 'trashed'; });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }, BUNDLE_COST);
    const errors = await enterArchive(page, canvas ? 'canvas' : 'candle-webgl');
    const prompt = page.locator('#interaction-prompt');
    const view = (position, target) => page.evaluate(([position, target]) => window.candleTest.view(position, target), [position, target]);
    const litCount = () => page.evaluate(() => window.candleTest.world.candles
      .filter(candle => candle.collider.userData.lit).length);
    assert.equal(await litCount(), 1);
    await view([7.32, 1.78, ENTRANCE_CANDLE.z], [8.62, 1.30, ENTRANCE_CANDLE.z]);
    await prompt.getByText(/Поднести ключ к пламени/).waitFor();
    await page.keyboard.press('e');
    await prompt.getByText(/Воск тает/).waitFor();
    await view([7.32, 1.78, ENTRANCE_CANDLE.z], [6.3, 1.30, ENTRANCE_CANDLE.z]);
    await page.waitForFunction(() => !document.querySelector('#interaction-prompt').textContent.includes('Воск тает'));
    assert.equal(await page.evaluate(() => window.candleTest.state.keys.find(key => key.wax && key.status === 'held')?.wax), true);
    await view([7.32, 1.78, ENTRANCE_CANDLE.z], [8.62, 1.30, ENTRANCE_CANDLE.z]);
    await prompt.getByText(/Поднести ключ к пламени/).waitFor();
    await page.keyboard.press('e');
    await page.waitForFunction(() => !window.candleTest.state.keys.some(key => key.wax && key.status === 'held'));
    await view([0, 1.78, 1.55], [0, 1.28, .08]);
    await prompt.getByText(/Купить связку/).waitFor();
    await page.keyboard.press('e');
    await page.locator('#carried-bundle').getByText('В связке · Часовой ×4').waitFor();
    assert.equal(await page.locator('#bundle-keys img').count(), 4);
    assert.equal(await occupiedSlots(page).count(), 0);
    await page.reload();
    await page.locator('#start-btn').click();
    await page.locator('#carried-bundle').getByText('В связке · Часовой ×4').waitFor();
    const aimAtSlot = slot => page.evaluate(async slot => {
      const { pegForSlot, CABINET_CELL_BACK_Z } = await import('/js/cabinet-layout.js');
      const q = window.candleTest, cabinet = q.world.cabinets[3], peg = pegForSlot(slot);
      const target = cabinet.group.localToWorld(new q.world.THREE.Vector3(peg.x, peg.y,
        cabinet.cellAimDepth ?? CABINET_CELL_BACK_Z));
      q.view([target.x + 1.8, 1.78, target.z], target.toArray());
    }, slot);
    await aimAtSlot(92);
    await prompt.getByText(/Повесить связку/).waitFor();
    await page.keyboard.press('e');
    assert.equal(await litCount(), 1);
    await page.waitForFunction(() => window.candleTest.world.candles.filter(candle => candle.collider.userData.lit).length === 3);
    const contacts = await page.evaluate(() => window.candleTest.cabinetContacts);
    assert.equal(contacts.length, 4);
    const launches = await page.evaluate(() => window.candleTest.launches);
    assert.deepEqual(launches.map(launch => launch.slot), [92, 93, 94, 95]);
    assert.deepEqual(launches.map(launch => launch.delay), [0, 330, 660, 990]);
    assert.equal(await page.evaluate(() => window.candleTest.state.bundles), 1);
    await page.reload();
    await page.locator('#start-btn').click();
    assert.equal(await litCount(), 3);
    await aimAtSlot(92);
    await prompt.getByText(/Взять ключ из ячейки 93/).waitFor();
    await page.keyboard.press('e');
    await page.waitForFunction(() => window.candleTest.world.candles.filter(candle => candle.collider.userData.lit).length === 1);
    assert.deepEqual(errors, []);
    await page.close();
  }
});
