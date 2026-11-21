import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright';
import { preview } from 'vite';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// CI renders WebGL in software, about 20 times slower than a desktop GPU. The
// camera flights and pouring advance per frame, so their waits stretch with it.
const timeout = process.env.CI ? 240_000 : 30_000;
const viewport = { width: 1280, height: 860 };
let server;
let browser;
let baseUrl;
const channel = process.env.PLAYWRIGHT_CHROMIUM_CHANNEL;
const webglArgs = process.platform === 'darwin'
  ? ['--enable-gpu', '--use-angle=metal']
  : ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const browserArgs = [...webglArgs, '--mute-audio'];

// The catalog loads paintings from GitHub. Serve them from this checkout so the
// tests neither wait on the network nor depend on what is on the remote branch.
const repoRoot = fileURLToPath(new URL('../../../../../..', import.meta.url));
async function servePaintingsLocally(context) {
  await context.route(/^https:\/\/raw\.githubusercontent\.com\/keeraa\/keynlock\/[^/]+\/(assets\/restoration\/.+)$/, route => {
    const path = repoRoot + decodeURIComponent(new URL(route.request().url()).pathname.split('/').slice(4).join('/'));
    if (!existsSync(path)) return route.fulfill({ status: 404 });
    return route.fulfill({ path, headers: { 'access-control-allow-origin': '*' } });
  });
}

function readRoom() {
  const camera = window.__keynlockDebug.host.camera;
  const controls = window.__keynlockDebug.host.controls;
  const scene = window.__keynlockDebug.host.renderer.getUnifiedScene();
  const activeWorkshopLights = id => {
    let count = 0;
    scene.getObjectByName(`keynlock-world-${id}`).traverse(object => {
      if (object.isLight && object.visible) count++;
    });
    return count;
  };
  return {
    position: camera.position.toArray(),
    target: controls.target.toArray(),
    fov: camera.fov,
    controls: { enabled: controls.enabled, minDistance: controls.minDistance },
    roomLights: scene.children.filter(object => object.isLight)
      .map(light => ({ visible: light.visible, intensity: light.intensity })),
    atelierLights: activeWorkshopLights('atelier'),
    alchemyLights: activeWorkshopLights('alchemy'),
  };
}

before(async () => {
  server = await preview({ preview: { host: '127.0.0.1', port: 0 } });
  baseUrl = `http://127.0.0.1:${server.httpServer.address().port}/`;
  browser = await chromium.launch({ channel, args: browserArgs });
});

after(async () => {
  await browser?.close();
  if (server) await new Promise(resolve => server.httpServer.close(resolve));
});

async function openRoom(t, { locale = 'ru-RU', pointerLock = false, beforeLoad } = {}) {
  // The headless shell rejects native pointer lock. Use full Chromium for that case.
  const roomBrowser = pointerLock && !channel
    ? await chromium.launch({ channel: 'chromium', args: browserArgs })
    : browser;
  if (roomBrowser !== browser) t.after(() => roomBrowser.close());
  const context = await roomBrowser.newContext({ viewport, locale });
  if (roomBrowser === browser) t.after(() => context.close());
  await servePaintingsLocally(context);
  const page = await context.newPage();
  page.setDefaultTimeout(timeout);
  await beforeLoad?.(page);
  const response = await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout });
  assert.equal(response.status(), 200);
  await page.locator('#app > #loading').waitFor({ state: 'hidden' });
  assert.equal(await page.locator('#app > #fallback').isVisible(), false, 'WebGL must render the room');
  assert.equal(await page.locator('#reset-camera').isHidden(), true, 'nothing to return to at the overview');
  return page;
}

async function enterAlchemy(page) {
  await page.locator('.zone-nav [data-zone="alchemy"]').click();
  await page.waitForFunction(() => window.__keynlockDebug.workshop('alchemy')?.lifecycle?.isActive());
  await page.getByRole('button', { name: 'Вернуться в логово' }).waitFor();
  // One way back for every mode, in one place: no second exit inside the lab.
  assert.equal(await page.getByRole('button', { name: /в логово/i }).count(), 1);
  assert.equal((await page.locator('#reset-camera span').innerText()).trim(), 'В ЛОГОВО');
  const visualToggle = page.locator('#alchemy-visual-toggle');
  if (await visualToggle.getAttribute('aria-expanded') === 'true') await visualToggle.click();
}

async function clickAlchemyObject(page, kind, id) {
  const point = await page.evaluate(({ kind, id }) => {
    const camera = window.__keynlockDebug.host.camera;
    const scene = window.__keynlockDebug.host.renderer.getUnifiedScene();
    const workshopId = scene.getObjectByName('keynlock-world-alchemy:main');
    const object = workshopId.getObjectsByProperty('isMesh', true).find(mesh => {
      const interaction = mesh.userData.interaction;
      return interaction?.kind === kind && interaction.id === id;
    });
    if (!object) throw new Error(`Alchemy interaction not found: ${kind} ${id ?? ''}`);
    const position = object.getWorldPosition(object.position.clone()).project(camera);
    const rect = document.querySelector('#alchemy-input-plane').getBoundingClientRect();
    return {
      x: rect.left + (position.x + 1) * rect.width / 2,
      y: rect.top + (1 - position.y) * rect.height / 2,
    };
  }, { kind, id });
  const topElement = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.id, point);
  assert.equal(topElement, 'alchemy-input-plane');
  await page.mouse.click(point.x, point.y);
}

async function settleAlchemyCamera(page) {
  await page.waitForFunction(() => {
    const pose = window.__keynlockDebug.host.renderer.getWorldPose('alchemy');
    return window.__keynlockDebug.host.camera.position.distanceTo(pose.position) < .04;
  });
}

test('the built Lair pours reagents into a vessel on its transformed alchemy table', async t => {
  const page = await openRoom(t);
  const favicon = await page.request.get(new URL('favicon.ico', baseUrl).href);
  assert.equal(favicon.status(), 200);
  assert.match(favicon.headers()['content-type'], /^image\//);
  assert.equal((await page.locator('link[rel="icon"]').getAttribute('href')), '/favicon.ico');

  await enterAlchemy(page);
  const panelTargets = await page.evaluate(() => {
    return ['lair-visual-toggle', 'atelier-visual-trigger', 'alchemy-visual-toggle'].map(id => {
      const trigger = document.getElementById(id);
      const panelId = trigger.getAttribute('aria-controls');
      const matches = [...document.querySelectorAll(`#${panelId}`)];
      return { panelId, count: matches.length };
    });
  });
  assert.deepEqual(panelTargets, [
    { panelId: 'lair-visual-panel', count: 1 },
    { panelId: 'atelier-visual-panel', count: 1 },
    { panelId: 'alchemy-visual-panel', count: 1 },
  ]);
  await settleAlchemyCamera(page);
  await clickAlchemyObject(page, 'source', 'red');
  await clickAlchemyObject(page, 'receiver', 'left');
  await page.waitForFunction(() => {
    const { receivers } = window.__keynlockDebug.workshop('alchemy').getState();
    return receivers.find(vessel => vessel.id === 'left').volume >= 24.9;
  });
  const { receivers, sources } = await page.evaluate(() => window.__keynlockDebug.workshop('alchemy').getState());
  assert.equal(receivers.find(vessel => vessel.id === 'right').volume, 0);
  assert.ok(Math.abs(sources.find(source => source.id === 'red').volume - 75) < .1);
});

test('the burner accounts for active time when returning to the lab', async t => {
  const page = await openRoom(t);
  await enterAlchemy(page);
  await page.evaluate(() => window.__keynlockDebug.workshop('alchemy').toggleBurner());
  assert.equal(await page.evaluate(() => window.__keynlockDebug.workshop('alchemy').getState().burnerOn), true);
  await page.waitForFunction(() => window.__keynlockDebug.workshop('alchemy').getState().recipeHeatSeconds > .1);
  await page.getByRole('button', { name: 'Вернуться в логово' }).click();
  assert.equal(await page.evaluate(() => window.__keynlockDebug.workshop('alchemy').lifecycle.isActive()), false);
  const pausedHeat = await page.evaluate(() => window.__keynlockDebug.workshop('alchemy').getState().recipeHeatSeconds);

  await page.waitForTimeout(600);
  assert.equal(await page.evaluate(() => window.__keynlockDebug.workshop('alchemy').getState().recipeHeatSeconds), pausedHeat);
  // Observe the first simulation step rather than sampling an arbitrary rendered frame.
  await page.evaluate(() => {
    const api = window.__keynlockDebug.workshop('alchemy');
    const host = window.__keynlockDebug.host.renderer;
    const step = host.stepWorldRuntime;
    const unsubscribe = api.status.subscribe((status, previous) => {
      if (!status.active || previous?.active !== false) return;
      unsubscribe();
      const resumedAt = performance.now();
      const previousHeat = api.getState().recipeHeatSeconds;
      host.stepWorldRuntime = now => {
        step(now);
        const heatDelta = api.getState().recipeHeatSeconds - previousHeat;
        if (heatDelta <= 0) return;
        host.stepWorldRuntime = step;
        window.firstHeatAfterResume = { heatDelta, elapsed: (performance.now() - resumedAt) / 1000 };
      };
    });
  });
  await enterAlchemy(page);
  await page.waitForFunction(() => window.firstHeatAfterResume);
  const { heatDelta, elapsed } = await page.evaluate(() => window.firstHeatAfterResume);
  assert.ok(heatDelta <= elapsed + .04, `The first step added ${heatDelta}s after only ${elapsed}s in the lab`);
});

test('an image load failure leaves the current painting editable', async t => {
  const page = await openRoom(t);
  const atelier = page.locator('#atelier-embedded-app');
  await page.locator('.zone-nav [data-zone="atelier"]').click();
  await page.waitForFunction(() => window.__keynlockDebug.workshop('atelier')?.bridge?.isReady());
  const bridge = await page.evaluateHandle(() => window.__keynlockDebug.workshop('atelier')?.bridge);
  const catalogue = await bridge.evaluate(api => api.catalog());
  const previous = 1;
  const broken = 2;
  // Hold the next painting's saved layer until the competing image fails.
  await page.evaluate(() => {
    const descriptor = Object.getOwnPropertyDescriptor(IDBTransaction.prototype, 'oncomplete');
    let holdNextRead = true;
    Object.defineProperty(IDBTransaction.prototype, 'oncomplete', {
      ...descriptor,
      set(handler) {
        if (holdNextRead && this.mode === 'readonly' && this.objectStoreNames.contains('paintings')) {
          holdNextRead = false;
          descriptor.set.call(this, event => { window.releaseRestorationRead = () => handler.call(this, event); });
        } else descriptor.set.call(this, handler);
      },
    });
  });
  const artItems = atelier.locator('.art-item');
  await artItems.nth(previous).click();
  await page.waitForFunction(index => Boolean(window.releaseRestorationRead) &&
    window.__keynlockDebug.workshop('atelier')?.bridge.snapshot().selected === index, previous);
  assert.equal(await bridge.evaluate(api => api.isReady()), false, 'the current painting must be waiting on its editable layer');

  const imageUrl = new URL(catalogue[broken].image, baseUrl).href;
  await page.route(imageUrl, route => route.abort('failed'));
  const failedRequest = page.waitForEvent('requestfailed', request => request.url() === imageUrl);
  await artItems.nth(broken).click();
  await failedRequest;
  await page.waitForFunction(title =>
    document.querySelector('#atelier-embedded-app #art-title').textContent === title,
  catalogue[previous].title);
  assert.equal(await bridge.evaluate(api => api.snapshot().selected), previous);
  await page.evaluate(() => window.releaseRestorationRead());
  await page.waitForFunction(() => window.__keynlockDebug.workshop('atelier')?.bridge.isReady());
  await atelier.locator('[data-tool="brush"]').click();
  assert.equal(await bridge.evaluate(api => api.snapshot().tool), 'brush');
});

test('switching workshops returns the shared camera, input, and lights to the room', async t => {
  const page = await openRoom(t);
  const home = await page.evaluate(readRoom);
  assert.ok(home.roomLights.some(light => light.visible));
  assert.equal(home.atelierLights, 0);
  assert.equal(home.alchemyLights, 0);

  async function assertHome() {
    await page.waitForFunction(({ position, target, fov }) => {
      const camera = window.__keynlockDebug.host.camera;
      const controls = window.__keynlockDebug.host.controls;
      return camera.position.toArray().every((value, axis) => Math.abs(value - position[axis]) < .025) &&
        controls.target.toArray().every((value, axis) => Math.abs(value - target[axis]) < .025) &&
        Math.abs(camera.fov - fov) < .08;
    }, home);
    const restored = await page.evaluate(readRoom);
    assert.deepEqual(restored.controls, home.controls);
    assert.deepEqual(restored.roomLights, home.roomLights);
    assert.equal(restored.atelierLights, 0);
    assert.equal(restored.alchemyLights, 0);
    assert.equal(await page.locator('#alchemy-input-plane').isVisible(), false);
    assert.equal(await page.evaluate(() => window.__keynlockDebug.workshop('alchemy').lifecycle.isActive()), false);
  }

  const reset = page.locator('#reset-camera');
  // The planning corner is a placeholder: a panel, but no workshop to open.
  await page.locator('.zone-nav [data-zone="planning"]').click();
  await page.locator('#zone-panel').waitFor();
  assert.equal(await page.locator('#panel-link').isVisible(), false, 'no workshop link without a workshop');
  assert.equal((await page.locator('#reset-camera span').innerText()).trim(), 'ОБЩИЙ ВИД');
  await reset.click();
  await assertHome();

  await page.locator('.zone-nav [data-zone="atelier"]').click();
  await page.waitForFunction(position =>
    window.__keynlockDebug.host.camera.position.toArray().some((value, axis) => Math.abs(value - position[axis]) > 3),
  home.position);
  await page.locator('#lair-focus-copy').click();
  await page.waitForFunction(() => window.__keynlockDebug.host.controls.minDistance < 2);
  const closeUp = await page.evaluate(readRoom);
  assert.ok(closeUp.atelierLights > 0);
  assert.equal(closeUp.alchemyLights, 0);
  await reset.click();
  await assertHome();

  await enterAlchemy(page);
  await settleAlchemyCamera(page);
  const lab = await page.evaluate(readRoom);
  assert.equal(lab.controls.enabled, false);
  assert.ok(lab.roomLights.every(light => !light.visible));
  assert.ok(lab.alchemyLights > 0);
  assert.equal(lab.atelierLights, 0);
  await page.keyboard.press('1');
  await page.locator('#lair-easel-camera-controls').waitFor();
  const atelier = await page.evaluate(readRoom);
  assert.equal(atelier.controls.enabled, true);
  assert.deepEqual(atelier.roomLights, home.roomLights);
  assert.ok(atelier.atelierLights > 0);
  assert.equal(atelier.alchemyLights, 0);
  assert.equal(await page.locator('#alchemy-input-plane').isVisible(), false);

  await page.locator('#wall-collection-entry').click();
  await page.locator('#lair-gallery-controls').waitFor();
  assert.equal((await page.evaluate(readRoom)).controls.enabled, false);
  await reset.click();
  await assertHome();

  await enterAlchemy(page);
  await page.getByRole('button', { name: 'Вернуться в логово' }).click();
  await assertHome();

  const orbitPoint = await page.evaluate(() => {
    for (const y of [300, 380, 720]) {
      for (const x of [250, 500, 700]) {
        if (document.elementFromPoint(x, y)?.id === 'scene-interaction') return { x, y };
      }
    }
    return null;
  });
  assert.ok(orbitPoint, 'the room must receive pointer input after switching');
  await page.mouse.move(orbitPoint.x, orbitPoint.y);
  await page.mouse.down();
  await page.mouse.move(orbitPoint.x + 100, orbitPoint.y + 30, { steps: 8 });
  await page.mouse.up();
  await page.waitForFunction(position =>
    window.__keynlockDebug.host.camera.position.toArray().some((value, axis) => Math.abs(value - position[axis]) > .1),
  home.position);
});

test('the room hosts both workshops on one canvas through the host contract', async t => {
  const page = await openRoom(t);
  const debug = 'window.__keynlockDebug';
  await page.waitForFunction(() => window.__keynlockDebug.workshop('atelier')?.bridge?.isReady()
    && window.__keynlockDebug.workshop('atelier')?.status.get().galleryReady
    && window.__keynlockDebug.workshop('alchemy')?.status.get().ready);
  // One visible WebGL canvas: the workshops draw through the room's renderer.
  const visibleCanvases = await page.evaluate(() => [...document.querySelectorAll('canvas')].filter(canvas => {
    const box = canvas.getBoundingClientRect();
    const style = getComputedStyle(canvas);
    return box.width > 0 && box.height > 0 && style.visibility !== 'hidden' && Number(style.opacity) > 0;
  }).length);
  assert.equal(visibleCanvases, 1, `${debug}: only the room canvas is visible`);
  // The Atelier's own angled sun would throw long stripes across the shared room.
  const atelierShadowLights = await page.evaluate(() => {
    let count = 0;
    window.__keynlockDebug.host.renderer.getUnifiedScene().getObjectByName('keynlock-world-atelier')
      .traverse(object => { if (object.isDirectionalLight && object.castShadow) count++; });
    return count;
  });
  assert.equal(atelierShadowLights, 0);
  // The room's right wall is tiled from floor to ceiling; the lab's own shorter
  // wall and its tile colour buttons (which only paint that wall) are hidden.
  assert.equal(await page.evaluate(() => window.__keynlockDebug.host.renderer.getUnifiedScene()
    .getObjectByName('extended-back-wall').visible), false);
  assert.equal(await page.locator('#alchemy-embedded-app .wall-choices').isHidden(), true);
  const supports = await page.evaluate(() => {
    const scene = window.__keynlockDebug.host.renderer.getUnifiedScene();
    scene.updateMatrixWorld(true);
    const point = scene.position.clone();
    function range(object, axis) {
      let min = Infinity, max = -Infinity;
      object.traverseVisible(mesh => {
        const positions = mesh.geometry?.getAttribute('position');
        if (!mesh.isMesh || !positions) return;
        for (let i = 0; i < positions.count; i++) {
          const coordinate = point.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld)[axis];
          min = Math.min(min, coordinate);
          max = Math.max(max, coordinate);
        }
      });
      return { min, max };
    }
    const galleryWall = scene.getObjectByName('atelier-side-wall');
    const leftWall = galleryWall.position.x;
    const gallerySpan = range(galleryWall, 'z');
    const rightWall = scene.getObjectByName('alchemy-right-wall').position.x;
    const shelf = range(scene.getObjectByName('alchemy-wall-shelf'), 'y');
    const brackets = scene.getObjectsByProperty('name', 'alchemy-shelf-bracket');
    const paintings = scene.getObjectByName('restored-frames').children;
    const alchemyFeet = scene.getObjectsByProperty('name', 'table-foot');
    const alchemyTable = scene.getObjectByName('alchemy-main-tabletop');
    const alchemyTop = range(alchemyTable, 'y').max;
    const alchemySpan = range(alchemyTable, 'z');
    const shift = 1.5 * (alchemySpan.max - alchemySpan.min);
    const center = name => scene.getObjectByName(name).getWorldPosition(point).z;
    const easelCenter = (center('restoration-left-easel') + center('restoration-right-easel')) / 2;
    const insideGalleryWall = object => {
      const span = range(object, 'z');
      return span.min > gallerySpan.min && span.max < gallerySpan.max;
    };
    return {
      shelfBrackets: brackets.length === 2
        && brackets.every(bracket => range(bracket, 'x').max >= rightWall && range(bracket, 'y').max >= shelf.min),
      galleryMounted: paintings.length > 0
        && paintings.every(painting => range(painting, 'x').min <= leftWall + .001 && insideGalleryWall(painting))
        && insideGalleryWall(scene.getObjectByName('twelve-art-history-column-headings')),
      atelierShelfMounted: range(scene.getObjectByName('restoration-wall-shelf'), 'x').min <= leftWall,
      atelierTableOnFloor: Math.abs(range(scene.getObjectByName('restoration-worktable'), 'y').min - .0385) < .005,
      alchemyTableOnFloor: alchemyFeet.length === 4
        && alchemyFeet.every(foot => Math.abs(range(foot, 'y').min - .0385) < .005),
      alchemyTableLowered: Math.abs(alchemyTop - .0385 - .95) < .005,
      stationsMovedTogether: Math.abs(easelCenter - (10.35 - shift)) < .01
        && Math.abs(center('alchemy-main-tabletop') - (10.10 - shift)) < .01
        && Math.abs(center('workbench-right-of-alchemy') - (20.07 - shift)) < .01,
      roomShortened: Math.abs(range(scene.getObjectByName('lair-floor-base'), 'z').max - (26.42 - shift)) < .01,
    };
  });
  assert.deepEqual(supports, {
    shelfBrackets: true, galleryMounted: true, atelierShelfMounted: true, atelierTableOnFloor: true,
    alchemyTableOnFloor: true, alchemyTableLowered: true, stationsMovedTogether: true, roomShortened: true,
  });

  // The FPS button opens the performance panel; the triangle row shows where they are.
  await page.locator('#perf-toggle').click();
  await page.waitForFunction(() => /\d/.test(document.querySelector('#perf-calls').textContent));
  await page.locator('#perf-triangles-row').hover();
  assert.ok(await page.locator('#perf-breakdown-list li').count() >= 3, 'the largest triangle owners are listed');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#perf-panel').isHidden(), true);

  // The Atelier's own tools work inside the room.
  await page.locator('.zone-nav [data-zone="atelier"]').click();
  await page.locator('#lair-focus-copy').click();
  await page.waitForFunction(() => window.__keynlockDebug.host.controls.minDistance < 2);
  // The window's haze would wash out the paintings being restored.
  assert.equal(await page.evaluate(() => window.__keynlockDebug.host.renderer.getUnifiedScene()
    .getObjectByName('window-light-air').visible), false, 'no window haze in front of the easels');
  for (const tool of ['brush', 'swab', 'uv', 'reagent', 'retouch']) {
    const button = page.locator(`#atelier-embedded-app [data-tool="${tool}"]`);
    await button.click();
    assert.equal(await button.getAttribute('aria-pressed'), 'true', `${tool} is selected`);
  }
  // In a close-up the easel switcher sits right of the Atelier's panel toggle.
  const stepper = await page.locator('#lair-easel-camera-controls').boundingBox();
  const toggle = await page.locator('#atelier-embedded-app #workbench-toggle').boundingBox();
  assert.ok(stepper && toggle && stepper.x >= toggle.x + toggle.width, 'the easel switcher does not cover the toggle');

  // The painting wall opens from the room and returns to the easels.
  await page.locator('#reset-camera').click();
  await page.locator('.zone-nav [data-zone="atelier"]').click();
  await page.locator('#wall-collection-entry').click();
  await page.waitForFunction(() => window.__keynlockDebug.host.atelier.galleryActive === true);
  assert.equal(await page.locator('#lair-gallery-controls').isVisible(), true);
  const gallery = await page.evaluateHandle(() => window.__keynlockDebug.workshop('atelier').gallery);
  assert.equal(await gallery.evaluate(api => api.getState().canShuffle), true);
  await page.locator('#gallery-switch').click();
  await page.locator('#gallery-switch').and(page.getByText('ДЕМО · 30', { exact: true })).waitFor();
  assert.equal(await gallery.evaluate(api => api.getState().canShuffle), false);
  assert.equal(await page.locator('#gallery-shuffle').isHidden(), true);
  await page.locator('#gallery-select').click();
  await page.locator('#atelier-embedded-app #collection-modal').waitFor();
  assert.equal(await gallery.evaluate(api => api.getState().collectionOpen), true);
  await page.keyboard.press('Escape');
  await page.locator('#atelier-embedded-app #collection-modal').waitFor({ state: 'hidden' });
  assert.equal(await gallery.evaluate(api => api.getState().collectionOpen), false);
  assert.equal(await gallery.evaluate(api => api.getState().active), true);
  await page.locator('#gallery-easels').click();
  await page.waitForFunction(() => window.__keynlockDebug.host.atelier.galleryActive === false);
  assert.equal(await page.locator('#lair-gallery-controls').isVisible(), false);
});

for (const [id, healthy, chunk, message] of [
  ['atelier', 'alchemy', /\/assets\/main-[\w-]+\.js$/, 'Реставрация не запустилась'],
  ['alchemy', 'atelier', /\/assets\/alchemy-[\w-]+\.js$/, 'Ошибка лаборатории'],
]) {
  test(`a failed ${id} import reports an error without blocking ${healthy}`, async t => {
    const page = await openRoom(t, { beforeLoad: page => page.route(chunk, route => route.abort()) });
    await page.waitForFunction(({ id, healthy }) => {
      const workshop = window.__keynlockDebug.workshop;
      return workshop(id)?.status.get().error && workshop(healthy)?.status.get().ready;
    }, { id, healthy });
    const failed = await page.evaluate(id => window.__keynlockDebug.workshop(id).status.get(), id);
    assert.equal(failed.ready, false);
    assert.ok(failed.error);

    await page.locator(`.zone-nav [data-zone="${id}"]`).click();
    await page.locator(`#${id}-embedded-app`).getByRole('alert').filter({ hasText: message }).waitFor();
    await page.locator('#reset-camera').click();
    assert.equal(await page.locator(`#${id}-embedded-app`).isHidden(), true);

    if (healthy === 'alchemy') await enterAlchemy(page);
    else {
      await page.locator('.zone-nav [data-zone="atelier"]').click();
      await page.locator('#lair-easel-camera-controls').waitFor();
    }
  });
}

test('first-person walking slides against furniture and walls, interacts, and restores orbit controls', async t => {
  const page = await openRoom(t);
  await page.evaluate(() => {
    Object.defineProperty(document.querySelector('#scene-interaction'), 'requestPointerLock', { value: undefined });
  });
  const toggle = page.locator('#room-walk-toggle');
  await toggle.click();
  assert.equal(await toggle.getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('#room-walk-look').textContent(), 'Перетаскивай для обзора');
  const spawn = await page.evaluate(() => window.__keynlockDebug.host.camera.position.toArray());
  assert.ok(Math.abs(spawn[1] - .0385 - 1.70) < .001, 'the camera starts at eye level');
  assert.equal((await page.evaluate(readRoom)).controls.enabled, false);

  const measured = await page.evaluate(async spawnZ => {
    const camera = window.__keynlockDebug.host.camera;
    const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve));
    const key = (type, code) => document.dispatchEvent(new KeyboardEvent(type, { code }));
    async function sample(sprint) {
      camera.position.z = spawnZ;
      if (sprint) key('keydown', 'ShiftLeft');
      key('keydown', 'KeyW');
      let previous = await nextFrame();
      const start = camera.position.z;
      let elapsed = 0;
      for (let i = 0; i < 8; i++) {
        const now = await nextFrame();
        elapsed += Math.min((now - previous) / 1000, .05);
        previous = now;
      }
      key('keyup', 'KeyW');
      key('keyup', 'ShiftLeft');
      return (start - camera.position.z) / elapsed;
    }
    const walk = await sample(false);
    const sprint = await sample(true);
    camera.position.z = spawnZ;
    return { walk, sprint };
  }, spawn[2]);
  assert.ok(Math.abs(measured.walk - 4.4) < .5, `walking matches the Key Archive speed (${JSON.stringify(measured)})`);
  assert.ok(Math.abs(measured.sprint - 7.4) < .8, 'holding Shift matches the Key Archive sprint speed');

  await page.keyboard.down('KeyW');
  await page.waitForFunction(z => window.__keynlockDebug.host.camera.position.z < z - .45, spawn[2]);
  await page.keyboard.up('KeyW');
  await page.evaluate(y => window.__keynlockDebug.host.camera.position.set(.25, y, 4.16), spawn[1]);
  await page.keyboard.down('KeyW');
  await page.waitForFunction(() => window.__keynlockDebug.host.camera.position.z < 4.05);
  // Walk closer than the collision distance would permit without the chair.
  await page.evaluate(async () => {
    for (let i = 0; i < 12; i++) await new Promise(requestAnimationFrame);
  });
  await page.keyboard.up('KeyW');
  const position = await page.evaluate(() => window.__keynlockDebug.host.camera.position.toArray());
  assert.ok(position[2] > 3.7, 'the chair stops the player within the room');
  assert.equal(position[1], spawn[1], 'the eye height remains level');
  await page.getByText('E · Карта и дела', { exact: true }).waitFor();
  await page.keyboard.press('KeyE');
  await page.locator('#zone-panel').waitFor();
  assert.equal(await page.locator('#panel-title').textContent(), 'Карта и дела');
  assert.equal(await toggle.getAttribute('aria-pressed'), 'false');
  assert.equal((await page.evaluate(readRoom)).controls.enabled, true);

  await toggle.click();
  await page.evaluate(() => window.__keynlockDebug.host.camera.position.x = 7.85);
  await page.keyboard.down('KeyD');
  await page.waitForFunction(() => window.__keynlockDebug.host.camera.position.x > 7.90);
  await page.evaluate(async () => {
    for (let i = 0; i < 12; i++) await new Promise(requestAnimationFrame);
  });
  await page.keyboard.up('KeyD');
  assert.ok(await page.evaluate(() => window.__keynlockDebug.host.camera.position.x < 7.95), 'the wall blocks sideways movement');

  const yaw = await page.evaluate(() => window.__keynlockDebug.host.camera.quaternion.y);
  await page.mouse.move(620, 400);
  await page.mouse.down();
  await page.mouse.move(680, 415, { steps: 4 });
  await page.mouse.up();
  assert.ok(await page.evaluate(before => Math.abs(window.__keynlockDebug.host.camera.quaternion.y - before) > .03, yaw));
  await page.keyboard.press('Escape');
  await page.locator('#room-walk-hud').waitFor({ state: 'hidden' });
  assert.equal((await page.evaluate(readRoom)).controls.enabled, true);
});

test('E hands off a pointer-locked walk to alchemy exactly once', async t => {
  const page = await openRoom(t, { pointerLock: true });
  await page.bringToFront();
  const toggle = page.locator('#room-walk-toggle');
  await toggle.click();
  await page.waitForFunction(() => document.pointerLockElement === document.querySelector('#scene-interaction'));
  await page.evaluate(() => {
    const { camera, controls, renderer } = window.__keynlockDebug.host;
    const tabletop = renderer.getUnifiedScene().getObjectByName('alchemy-main-tabletop');
    const position = tabletop.getWorldPosition(camera.position.clone());
    camera.position.set(position.x - 3, camera.position.y, position.z);
    camera.lookAt(position.x, camera.position.y, position.z);

    const handoff = { releases: 0, resumes: 0, orbitChanges: [] };
    window.walkHandoff = handoff;
    document.addEventListener('pointerlockchange', () => {
      if (!document.pointerLockElement) handoff.releases++;
    });
    window.__keynlockDebug.workshop('alchemy').status.subscribe((status, previous) => {
      if (status.active && previous?.active === false) handoff.resumes++;
    });
    let enabled = controls.enabled;
    Object.defineProperty(controls, 'enabled', {
      get: () => enabled,
      set(value) {
        if (value !== enabled) handoff.orbitChanges.push(value);
        enabled = value;
      },
      configurable: true,
    });
  });
  await page.getByText('E · Алхимия', { exact: true }).waitFor();
  await page.keyboard.down('KeyE');
  await page.keyboard.down('KeyE'); // Repeated keydown while E is still held.
  await page.keyboard.up('KeyE');
  await page.waitForFunction(() => document.pointerLockElement === null
    && window.__keynlockDebug.workshop('alchemy').lifecycle.isActive());
  await settleAlchemyCamera(page);

  assert.equal(await toggle.getAttribute('aria-pressed'), 'false');
  assert.equal(await page.locator('#alchemy-input-plane').isVisible(), true);
  assert.equal((await page.evaluate(readRoom)).controls.enabled, false);
  await page.evaluate(() => window.__keynlockDebug.workshop('alchemy').openRecipeBook());
  const recipe = page.locator('#alchemy-embedded-app #recipe-overlay');
  await recipe.waitFor();
  await page.keyboard.press('Escape');
  await recipe.waitFor({ state: 'hidden' });
  assert.equal(await page.locator('#alchemy-input-plane').isVisible(), true);
  assert.deepEqual(await page.evaluate(() => window.walkHandoff),
    { releases: 1, resumes: 1, orbitChanges: [] });
});

test('an English browser gets the Lair in English, with a language switch', async t => {
  const page = await openRoom(t, { locale: 'en-US' });
  assert.equal(await page.title(), "KEYNLOCK · The team's lair");
  assert.equal(await page.evaluate(() => document.documentElement.lang), 'en');
  assert.equal(await page.locator('.zone-nav [data-zone="workbench"] span:last-child').innerText(), 'Workbench');
  assert.equal(await page.locator('#lair-language').inputValue(), 'en');
  assert.deepEqual(await page.locator('#lair-language option').evaluateAll(options => options.map(o => o.value)), ['ru', 'en']);
});

test('one music player follows the Lair into its workshops and switches tracks', async t => {
  const page = await openRoom(t);
  const title = page.locator('#lair-music .music-controls__title');
  assert.equal(await title.innerText(), 'Шопен · Ноктюрн op. 9 № 1');
  await page.locator('#lair-music').getByRole('button', { name: 'Следующий трек' }).click();
  assert.equal(await title.innerText(), 'Шопен · Ноктюрн op. 9 № 2');
  assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem('keynlock-archive-music-position-v1'))).track,
    'chopin-nocturne-op9-no2.mp3', 'the Key Archive resumes the same record');
  await page.locator('#lair-music').getByRole('button', { name: 'Пауза' }).click();
  assert.equal(await page.evaluate(() => localStorage.getItem('keynlock-music-stopped-v1')), '1');

  // The gramophone's panel shows the same player, with volume.
  await page.locator('.zone-nav [data-zone="gramophone"]').click();
  await page.locator('#panel-music').waitFor();
  assert.equal(await page.locator('#panel-music .music-controls__title').innerText(), 'Шопен · Ноктюрн op. 9 № 2');
  assert.equal(await page.locator('#panel-music .music-controls__volume').inputValue(), '25');
  await page.locator('#panel-music').getByRole('button', { name: 'Предыдущий трек' }).click();
  assert.equal(await title.innerText(), 'Шопен · Ноктюрн op. 9 № 1');

  // The lab is the same page: the player and its state stay.
  await enterAlchemy(page);
  assert.equal(await title.isVisible(), true);
  assert.equal(await title.innerText(), 'Шопен · Ноктюрн op. 9 № 1');
});

test('an English page shows the player in English', async t => {
  const page = await openRoom(t, { locale: 'en-US' });
  assert.equal(await page.locator('#lair-music .music-controls__title').innerText(), 'Chopin · Nocturne Op. 9 No. 1');
  assert.equal(await page.locator('#lair-music').getByRole('button', { name: 'Next track' }).count(), 1);
});

test('the room draws once per frame: no transmission pass and no per-frame shadow map', async t => {
  const page = await openRoom(t);
  const state = await page.evaluate(() => {
    const scene = window.__keynlockDebug.host.renderer.getUnifiedScene();
    const transmissive = [];
    scene.traverse(object => {
      const materials = [object.material].flat().filter(Boolean);
      if (object.isMesh && materials.some(material => material.transmission > 0)) transmissive.push(object.name || object.parent?.name);
    });
    return { transmissive };
  });
  // Any transmission material makes Three.js draw every opaque object again each frame.
  assert.deepEqual(state.transmissive, []);
  // The shadow map is refreshed about once a second, so most frames draw only to the screen.
  const passes = await page.evaluate(async () => {
    const gl = document.querySelector('#scene').getContext('webgl2');
    let target = null, offscreen = 0, frames = 0;
    const bind = gl.bindFramebuffer, draw = gl.drawElements;
    gl.bindFramebuffer = function (kind, framebuffer) { target = framebuffer; return bind.call(this, kind, framebuffer); };
    gl.drawElements = function (...args) { if (target) offscreen++; return draw.apply(this, args); };
    for (; frames < 20; frames++) await new Promise(resolve => requestAnimationFrame(resolve));
    Object.assign(gl, { bindFramebuffer: bind, drawElements: draw });
    return { offscreenPerFrame: offscreen / frames };
  });
  assert.ok(passes.offscreenPerFrame < 60, `offscreen draws per frame: ${passes.offscreenPerFrame}`);
});

test('the workshops share the room look: one gouache setting, no Atelier-only effects', async t => {
  const page = await openRoom(t);
  assert.equal(await page.locator('.atelier-effects, #atelier-toon-enabled').count(), 0, 'no separate Atelier effects');
  await page.waitForFunction(() => {
    const api = window.__keynlockDebug.workshop;
    return api('atelier')?.look?.paintedMaterials && api('alchemy')?.look?.paintedMaterials;
  });
  // Wait for the Lair to adopt them (on the workshops' ready events).
  const painted = await page.waitForFunction(() => {
    const api = window.__keynlockDebug.workshop;
    const adopted = list => list.every(material => material.customProgramCacheKey().includes('keynlock-painted'));
    return adopted(api('atelier').look.paintedMaterials()) && adopted(api('alchemy').look.paintedMaterials());
  }, null, { timeout: 30000 });
  assert.ok(await painted.jsonValue());
});
