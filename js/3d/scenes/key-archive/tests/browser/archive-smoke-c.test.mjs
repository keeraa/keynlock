// Browser smoke tests, part C: the hall: rendering, drop, routes, light beams, shelf candles, the no-WebGL notice.
// The three parts are balanced by CI run time so they run as parallel shards.
import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { ENTRANCE_CANDLE } from '../../dist/js/archive-candles.js';
import { BACKUP_STORAGE_KEY } from '../../dist/js/archive-save-state-with-route.js';
import { BUNDLE_COST, createInitialState, pickupKey, STORAGE_KEY } from '../../dist/js/rules.js';
import { CABINET_CELL_BACK_Z, CABINET_GRID_BOTTOM_Y, CABINET_GROUND_OFFSET, CABINET_HEADER_Y, CABINET_Z, pegForSlot } from '../../dist/js/cabinet-layout.js';
import { FIRST_ROUTE_KEY_ID } from '../../dist/js/archive-first-route-guide.js';
import { FIXTURE_OFFSETS } from '../../dist/js/station-layout.js';
import { RUST_TRAY } from '../../dist/js/rust-tray.js';
import { SLOW, screenshots, browser, baseUrl, occupiedSlots, enterArchive, installTestCamera } from './harness.mjs';

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

test('the hall retains held keys, migrates old baths and accepts a drop action', { timeout: 120000 * SLOW }, async t => {
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
  t.after(() => page.close());
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
  const errors = await enterArchive(page, 'old-baths');
  assert.equal(await occupiedSlots(page).count(), 1);
  assert.equal(await page.locator('.slot-thumbnail').count(), 1);
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  assert.equal(saved.keys.find(key => key.id === muddy.id).bathId, 'center-mud');
  await page.screenshot({ path: join(screenshots, 'archive-old-baths.png') });
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

test('the starter key can be placed in a suggested cell, retrieved and moved by hand', { timeout: 120000 * SLOW }, async t => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  t.after(() => page.close());
  await page.addInitScript(() => { HTMLCanvasElement.prototype.requestPointerLock = undefined; });
  const aim = await installTestCamera(page);
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

test('without WebGL the page asks for a WebGL browser instead of a 2D mode', { timeout: 60000 * SLOW }, async t => {
  const page = await browser.newPage({ viewport: { width: 960, height: 640 } });
  t.after(() => page.close());
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      return ['webgl', 'webgl2', 'experimental-webgl'].includes(type) ? null : original.call(this, type, ...args);
    };
  });
  await page.goto(baseUrl);
  const notice = page.locator('#webgl-required');
  await notice.waitFor({ state: 'visible' });
  assert.match(await notice.textContent(), /Нужен браузер с WebGL/);
  assert.equal(await page.evaluate(() => document.body.classList.contains('webgl-missing')), true);
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
