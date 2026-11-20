// Browser smoke tests, part A: the play loop: cleaning, filing, celebrations, pointer lock, the window bird.
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
  for (const count of [11, 95]) {
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
    const errors = await enterArchive(page, `completion-${count}`);
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
