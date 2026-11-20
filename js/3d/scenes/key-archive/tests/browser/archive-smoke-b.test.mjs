// Browser smoke tests, part B: stations and outlines: wax, rust, save recovery, contour rendering.
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

test('wax melts at the entrance and a bundle lights cabinet candles', { timeout: 120000 * SLOW }, async t => {
  {
    const page = await browser.newPage({ viewport: { width: 1024, height: 720 } });
    t.after(() => page.close());
    await page.addInitScript(() => {
      HTMLCanvasElement.prototype.requestPointerLock = undefined;
      HTMLMediaElement.prototype.play = async () => {};
    });
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
    const errors = await enterArchive(page, 'candle-webgl');
    const prompt = page.locator('#interaction-prompt');
    const view = (position, target) => page.evaluate(([position, target]) => window.candleTest.view(position, target), [position, target]);
    const litCount = () => page.evaluate(() => window.candleTest.world.candles
      .filter(candle => candle.collider.userData.lit).length);
    assert.equal(await litCount(), 1);
    await view([7.32, 1.78, ENTRANCE_CANDLE.z], [8.62, 1.30, ENTRANCE_CANDLE.z]);
    await prompt.getByText(/Поднести ключ к пламени/).waitFor();
    // Hold the station clock while checking that looking away interrupts the
    // melt: on slow software-rendered CI the melt could otherwise finish first.
    await page.evaluate(() => {
      const real = performance.now.bind(performance);
      const frozenAt = real();
      window.restoreClock = () => { performance.now = real; };
      performance.now = () => frozenAt;
    });
    await page.keyboard.press('e');
    await prompt.getByText(/Воск тает/).waitFor();
    await view([7.32, 1.78, ENTRANCE_CANDLE.z], [6.3, 1.30, ENTRANCE_CANDLE.z]);
    await page.waitForFunction(() => !document.querySelector('#interaction-prompt').textContent.includes('Воск тает'));
    assert.equal(await page.evaluate(() => window.candleTest.state.keys.find(key => key.wax && key.status === 'held')?.wax), true);
    await page.evaluate(() => window.restoreClock());
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
