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

/** Open a zone as a click on its spot in the room does (the zone bar is gone). */
function openZone(page, id) {
  return page.evaluate(zone => window.__keynlockDebug.zones.open(zone), id);
}

/** Polls a Node-side condition (e.g. counted network events). */
async function expectSoon(check, message, timeout = 30000) {
  const end = Date.now() + timeout;
  while (!check()) {
    if (Date.now() > end) assert.fail(message);
    await new Promise(resolve => setTimeout(resolve, 50));
  }
}

async function openRoom(t, { locale = 'ru-RU', pointerLock = false, beforeLoad, startOnFoot = false } = {}) {
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
  // LAIR_CPU_THROTTLE=8 slows the page down like software WebGL on CI.
  const throttle = Number(process.env.LAIR_CPU_THROTTLE) || 0;
  if (throttle > 1) {
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
  }
  await beforeLoad?.(page);
  // ?start=overview: these checks begin at the overview (the game starts on foot).
  const response = await page.goto(startOnFoot ? baseUrl : `${baseUrl}?start=overview`,
    { waitUntil: 'domcontentloaded', timeout });
  assert.equal(response.status(), 200);
  await page.locator('#app > #loading').waitFor({ state: 'hidden' });
  assert.equal(await page.locator('#app > #fallback').isVisible(), false, 'WebGL must render the room');
  if (!startOnFoot) assert.equal(await page.locator('#reset-camera').isHidden(), true, 'nothing to return to at the overview');
  return page;
}

async function enterAlchemy(page) {
  await openZone(page, 'alchemy');
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
  // The Lair frames the lab a little higher than its own pose, so wait for the
  // flight to end rather than for the camera to reach the lab's exact pose.
  await page.waitForFunction(() => window.__keynlockDebug.workshop('alchemy')?.lifecycle?.isActive()
    && !window.__keynlockDebug.zones.isTransitioning());
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
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
  // The third painting's image fails from the very start: a request made
  // before the test reaches it (the thumbnails, a neighbour fetched ahead)
  // would otherwise leave nothing to fail. Failures are counted.
  const failures = [];
  const page = await openRoom(t, { beforeLoad: async page => {
    page.on('requestfailed', request => { if (/vangogh-self/.test(request.url())) failures.push(request.url()); });
    await page.route(/vangogh-self[^/]*\.jpg$/, route => route.abort('failed'));
  } });
  const atelier = page.locator('#atelier-embedded-app');
  await openZone(page, 'atelier');
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
  // The collection chooses paintings in the Lair; the bridge does the same.
  // Not awaited: the held read keeps this selection pending on purpose.
  await bridge.evaluate((api, index) => { void api.showPainting(index); }, previous);
  await page.waitForFunction(index => Boolean(window.releaseRestorationRead) &&
    window.__keynlockDebug.workshop('atelier')?.bridge.snapshot().selected === index, previous);
  assert.equal(await bridge.evaluate(api => api.isReady()), false, 'the current painting must be waiting on its editable layer');

  assert.match(catalogue[broken].image, /vangogh-self/);
  const failedBefore = failures.length;
  await bridge.evaluate((api, index) => { void api.showPainting(index); }, broken);
  await expectSoon(() => failures.length > failedBefore, 'the broken painting was requested and failed');
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
    await page.waitForFunction(() => !window.__keynlockDebug.host.camera.view?.enabled);
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
  await openZone(page, 'planning');
  await page.locator('#zone-panel').waitFor();
  assert.equal(await page.locator('#panel-link').isVisible(), false, 'no workshop link without a workshop');
  assert.equal((await page.locator('#reset-camera span').innerText()).trim(), 'ОБЩИЙ ВИД');
  await reset.click();
  await assertHome();

  await openZone(page, 'atelier');
  await page.waitForFunction(position =>
    window.__keynlockDebug.host.camera.position.toArray().some((value, axis) => Math.abs(value - position[axis]) > 3),
  home.position);
  // The original/copy stepper shows only while the panel is hidden.
  await page.waitForFunction(() => window.__keynlockDebug.workshop('atelier')?.bridge?.focusEasel);
  await page.evaluate(() => window.__keynlockDebug.workshop('atelier').bridge.focusEasel('copy'));
  await page.waitForFunction(() => window.__keynlockDebug.host.controls.minDistance < 2);
  const closeUp = await page.evaluate(readRoom);
  assert.equal(closeUp.atelierLights, 0, 'the Atelier is lit by the room: no jump in brightness');
  assert.equal(closeUp.alchemyLights, 0);
  await reset.click();
  await assertHome();

  await enterAlchemy(page);
  await settleAlchemyCamera(page);
  const lab = await page.evaluate(readRoom);
  assert.equal(lab.controls.enabled, false);
  assert.deepEqual(lab.roomLights, home.roomLights, "the room lights the lab too (one set of lights)");
  assert.ok(lab.alchemyLights > 0);
  assert.equal(lab.atelierLights, 0);
  // The lab's «Размытие фона» is the shared depth blur of the Lair's outline pass.
  const blurred = () => window.__keynlockDebug.outlines.isBackgroundBlurred();
  await page.waitForFunction(blurred);
  const labApp = page.locator('#alchemy-embedded-app');
  await labApp.locator('#background-blur').dispatchEvent('click');
  await page.waitForFunction(on => window.__keynlockDebug.outlines.isBackgroundBlurred() === on, false);
  await labApp.locator('#background-blur').dispatchEvent('click');
  await page.waitForFunction(blurred);
  // «Фон мастерской» paints the Lair's right wall.
  await labApp.locator('.wall-choice[data-wall="ochre"]').dispatchEvent('click');
  assert.equal(await page.evaluate(() => window.__keynlockDebug.host.alchemy.getWallFinish()), 'ochre');
  assert.equal(await labApp.locator('.wall-choice[data-wall="ochre"]').getAttribute('aria-pressed'), 'true');
  await labApp.locator('.wall-choice[data-wall="sage"]').dispatchEvent('click');
  await page.keyboard.press('1');
  await page.locator('#lair-atelier-corner').waitFor();
  // The colours and the reset in the top right corner; the easels centred
  // above the open panel (the camera's view is lifted by half its height).
  assert.equal(await page.locator('#lair-atelier-corner .wood-pickers').count(), 1);
  assert.equal(await page.locator('#lair-atelier-corner #reset-button').count(), 1);
  await page.waitForFunction(() => window.__keynlockDebug.host.camera.view?.enabled &&
    window.__keynlockDebug.host.camera.view.offsetY > 50);
  const atelier = await page.evaluate(readRoom);
  assert.equal(atelier.controls.enabled, true);
  assert.deepEqual(atelier.roomLights, home.roomLights);
  assert.equal(atelier.atelierLights, 0);
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
    const easelNames = ['restoration-left-easel', 'restoration-right-easel'];
    const easels = easelNames.map(name => scene.getObjectByName(name));
    const easelCenter = (center(easelNames[0]) + center(easelNames[1])) / 2;
    const insideGalleryWall = object => {
      const span = range(object, 'z');
      return span.min > gallerySpan.min && span.max < gallerySpan.max;
    };
    const galleryCeiling = range(scene.getObjectByName('lair-wall-beam-left'), 'y').min;
    const gallerySconces = scene.getObjectsByProperty('name', 'lair-wall-sconce')
      .filter(sconce => sconce.position.x < 0);
    const sconceTop = Math.max(...gallerySconces.map(sconce => {
      const glass = sconce.children.find(part => part.material?.isMeshStandardMaterial && part.material.transparent);
      return range(glass, 'y').max;
    }));
    const galleryObjects = [...paintings, scene.getObjectByName('art-history-column-headings')];
    const workbench = scene.getObjectByName('workbench-right-of-alchemy');
    const workbenchSpan = range(workbench, 'z');
    const entranceZ = center('lair-entrance-wall') - .135;
    return {
      galleryFitsBelowBeam: galleryObjects.every(object => {
        const span = range(object, 'y');
        return span.min > sconceTop && span.max < galleryCeiling;
      }),
      shelfBrackets: brackets.length === 2
        && brackets.every(bracket => range(bracket, 'x').max >= rightWall && range(bracket, 'y').max >= shelf.min),
      galleryColumns: new Set(paintings.map(painting => painting.position.x)).size,
      galleryMounted: paintings.length === 30
        && paintings.every(painting => range(painting, 'x').min <= leftWall + .001 && insideGalleryWall(painting))
        && insideGalleryWall(scene.getObjectByName('art-history-column-headings')),
      atelierTableRemoved: ['restoration-worktable', 'restoration-brush-pad', 'restoration-palette']
        .every(name => !scene.getObjectByName(name)),
      smallerEaselsOnFloor: easels.every(easel => easel.scale.x === .8 && Math.abs(range(easel, 'y').min - .0385) < .005),
      alchemyTableOnFloor: alchemyFeet.length === 4
        && alchemyFeet.every(foot => Math.abs(range(foot, 'y').min - .0385) < .005),
      alchemyTableLowered: Math.abs(alchemyTop - .0385 - .95) < .005,
      workshopSpacing: Math.abs(easelCenter - (10.35 - shift)) < .01
        && Math.abs(center('alchemy-main-tabletop') - (11.20 - shift)) < .01
        && Math.abs(center(workbench.name) - center('alchemy-main-tabletop') - 4.90) < .01
        && workbenchSpan.min - alchemySpan.max > 1 && entranceZ - workbenchSpan.max > 1,
      roomShortened: Math.abs(entranceZ - 12.90) < .01
        && Math.abs(range(scene.getObjectByName('lair-floor-base'), 'z').max - entranceZ) < .01,
    };
  });
  assert.deepEqual(supports, {
    galleryFitsBelowBeam: true, shelfBrackets: true, galleryColumns: 8, galleryMounted: true, atelierTableRemoved: true, smallerEaselsOnFloor: true,
    alchemyTableOnFloor: true, alchemyTableLowered: true, workshopSpacing: true, roomShortened: true,
  });

  // The FPS button opens the performance panel; the triangle row shows where they are.
  await page.locator('#perf-toggle').click();
  await page.waitForFunction(() => /\d/.test(document.querySelector('#perf-calls').textContent));
  await page.locator('#perf-triangles-row').hover();
  assert.ok(await page.locator('#perf-breakdown-list li').count() >= 3, 'the largest triangle owners are listed');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#perf-panel').isHidden(), true);

  // The Atelier's own tools work inside the room.
  await openZone(page, 'atelier');
  // The original/copy stepper shows only while the panel is hidden.
  await page.waitForFunction(() => window.__keynlockDebug.workshop('atelier')?.bridge?.focusEasel);
  await page.evaluate(() => window.__keynlockDebug.workshop('atelier').bridge.focusEasel('copy'));
  await page.waitForFunction(() => window.__keynlockDebug.host.controls.minDistance < 2);
  // The window's haze would wash out the paintings being restored.
  // Set by the frame loop: wait for a frame (slow software WebGL on CI).
  await page.waitForFunction(() => window.__keynlockDebug.host.renderer.getUnifiedScene()
    .getObjectByName('window-light-air').visible === false);
  for (const tool of ['brush', 'swab', 'uv', 'reagent', 'retouch']) {
    const button = page.locator(`#atelier-embedded-app [data-tool="${tool}"]`);
    await button.click();
    assert.equal(await button.getAttribute('aria-pressed'), 'true', `${tool} is selected`);
  }
  // The reagent on a spot the UV lamp has not marked: the reason shows
  // beside the cursor (the panel's status line is hidden in the Lair).
  await page.locator('#atelier-embedded-app [data-tool="reagent"]').click();
  // Choosing a tool flies to the copy: wait until the camera stands still.
  await page.evaluate(async () => {
    const camera = window.__keynlockDebug.host.camera;
    let still = 0;
    const last = camera.position.clone();
    while (still < 8) {
      await new Promise(requestAnimationFrame);
      still = camera.position.distanceTo(last) < 1e-5 ? still + 1 : 0;
      last.copy(camera.position);
    }
  });
  const spot = await page.evaluate(() => {
    const { camera, renderer } = window.__keynlockDebug.host;
    const easel = renderer.getUnifiedScene().getObjectByName('restoration-right-easel');
    let canvas;
    easel.traverse(object => { if (object.material?.uniforms?.uPainting) canvas = object; });
    const point = canvas.getWorldPosition(camera.position.clone()).project(camera);
    const bounds = document.querySelector('#scene-interaction').getBoundingClientRect();
    return {
      x: bounds.left + (point.x + 1) * bounds.width / 2,
      y: bounds.top + (1 - point.y) * bounds.height / 2,
    };
  });
  await page.mouse.move(spot.x, spot.y);
  await page.locator('#atelier-scene-feedback #restoration-cursor[data-tool="reagent"]').waitFor();
  await page.mouse.click(spot.x, spot.y);
  await page.locator('#atelier-scene-feedback #restoration-notice').filter({ hasText: 'УФ-фонарём' }).waitFor();
  // The panel in the Lair: «ВСЯ КОЛЛЕКЦИЯ» right of «В ЛОГОВО», the readiness
  // beside the likeness, no stepper while the panel is open.
  const back = await page.locator('#reset-camera').boundingBox();
  const collection = await page.locator('#lair-atelier-header #collection-footer').boundingBox();
  assert.ok(back && collection && collection.x > back.x + back.width && Math.abs(collection.y - back.y) < 2,
    'the collection button stands right of «В ЛОГОВО»');
  assert.match(await page.locator('#lair-atelier-header .collection-total').innerText(), /^\d+$/, 'the collection size is filled in');
  assert.equal(await page.locator('#atelier-embedded-app .workbench-main #restoration-progress').count(), 1);
  assert.equal(await page.locator('#lair-easel-camera-controls').isHidden(), true);
  await page.locator('#atelier-embedded-app #workbench-toggle').click();
  await page.locator('#lair-easel-camera-controls').waitFor();
  await page.locator('#atelier-embedded-app #workbench-toggle').click();

  // The painting wall opens from the room and returns to the easels.
  await page.locator('#reset-camera').click();
  await openZone(page, 'atelier');
  await page.locator('#wall-collection-entry').click();
  await page.waitForFunction(() => window.__keynlockDebug.host.atelier.galleryActive === true);
  assert.equal(await page.locator('#lair-gallery-controls').isVisible(), true);
  const gallery = await page.evaluateHandle(() => window.__keynlockDebug.workshop('atelier').gallery);
  assert.equal(await gallery.evaluate(api => api.getState().canShuffle), true);
  assert.match(await page.locator('#wall-gallery-caption').textContent(), /8 вертикальных колонок/);
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

    await openZone(page, id);
    await page.locator(`#${id}-embedded-app`).getByRole('alert').filter({ hasText: message }).waitFor();
    await page.locator('#reset-camera').click();
    assert.equal(await page.locator(`#${id}-embedded-app`).isHidden(), true);

    if (healthy === 'alchemy') await enterAlchemy(page);
    else {
      await openZone(page, 'atelier');
      await page.locator('#lair-atelier-corner').waitFor();
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
  // The camera first comes down to the walker's eyes, then the walk starts.
  const overview = await page.evaluate(() => window.__keynlockDebug.host.camera.position.y);
  await page.waitForFunction(() => document.querySelector('#room-walk-toggle').getAttribute('aria-pressed') === 'true');
  assert.ok(overview > 2.5, 'the walk began from the overview, above eye level');
  assert.equal(await page.locator('#room-walk-look').textContent(), 'Мышь — обзор');
  // The walk starts turned a little left; these checks walk straight ahead.
  const spawn = await page.evaluate(() => {
    window.__keynlockDebug.walk.face(0, 0);
    return window.__keynlockDebug.host.camera.position.toArray();
  });
  assert.ok(Math.abs(spawn[1] - .0385 - 1.70) < .001, 'the camera starts at eye level');
  assert.equal((await page.evaluate(readRoom)).controls.enabled, false);

  const measured = await page.evaluate(spawnZ => {
    const { walk: movement, host: { camera } } = window.__keynlockDebug;
    const key = (type, code) => document.dispatchEvent(new KeyboardEvent(type, { code }));
    function sample(sprint) {
      camera.position.z = spawnZ;
      if (sprint) key('keydown', 'ShiftLeft');
      key('keydown', 'KeyW');
      const start = camera.position.z;
      // Step the same movement controller with known deltas so GPU scheduling
      // doesn't skew the comparison between walking and sprinting.
      const frameSeconds = 1 / 60;
      for (let i = 0; i < 8; i++) movement.update(frameSeconds);
      key('keyup', 'KeyW');
      key('keyup', 'ShiftLeft');
      return (start - camera.position.z) / (8 * frameSeconds);
    }
    const walk = sample(false);
    const sprint = sample(true);
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
  await page.waitForFunction(() => document.querySelector('#room-walk-toggle').getAttribute('aria-pressed') === 'true');
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
  assert.equal(await page.locator('#scene-interaction').evaluate(el => getComputedStyle(el).cursor), 'none');
  assert.equal(await page.locator('#room-walk-hud .room-walk-crosshair').count(), 1);
  const settings = page.locator('#lair-visual-panel');
  await page.locator('#lair-music-toggle').focus();
  await page.keyboard.press('Escape');
  await settings.waitFor();
  await page.locator('#room-walk-hud').waitFor({ state: 'hidden' });
  assert.equal(await toggle.getAttribute('aria-pressed'), 'true');
  assert.equal((await page.evaluate(readRoom)).controls.enabled, false);
  const paused = (await page.evaluate(readRoom)).position;
  await page.keyboard.down('KeyW');
  await page.evaluate(async () => { for (let i = 0; i < 4; i++) await new Promise(requestAnimationFrame); });
  await page.keyboard.up('KeyW');
  assert.deepEqual((await page.evaluate(readRoom)).position, paused);
  await page.keyboard.press('Escape');
  await settings.waitFor({ state: 'hidden' });
  await page.locator('#room-walk-hud').waitFor();
  assert.equal(await toggle.getAttribute('aria-pressed'), 'true');
  await page.locator('#reset-camera').click();
  await page.locator('#room-walk-hud').waitFor({ state: 'hidden' });
  assert.equal((await page.evaluate(readRoom)).controls.enabled, true);
});

test('E hands off a pointer-locked walk to alchemy exactly once', async t => {
  const page = await openRoom(t, { pointerLock: true });
  await page.bringToFront();
  const toggle = page.locator('#room-walk-toggle');
  await toggle.click();
  // The mouse is locked on the click itself, the walk begins after the descent.
  await page.waitForFunction(() => document.pointerLockElement === document.querySelector('#scene-interaction'));
  await page.waitForFunction(() => document.querySelector('#room-walk-toggle').getAttribute('aria-pressed') === 'true');
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
  assert.equal(await page.locator('.hotspot[data-zone="workbench"] span:last-child').innerText(), 'Workbench');
  assert.equal(await page.locator('#lair-language').inputValue(), 'en');
  assert.deepEqual(await page.locator('#lair-language option').evaluateAll(options => options.map(o => o.value)), ['ru', 'en']);
});

test('one music player follows the Lair into its workshops and switches tracks', async t => {
  const page = await openRoom(t);
  const note = page.getByRole('button', { name: 'Музыка', exact: true });
  const title = page.locator('#lair-music .music-controls__title');
  const titleText = async () => (await title.textContent()).replace(/\s*▾$/, '');
  const bounds = await note.boundingBox();
  assert.equal(bounds.width, 57);
  assert.equal(bounds.height, 57);
  assert.ok(bounds.x < 50 && viewport.height - (bounds.y + bounds.height) <= 25);
  assert.equal(await note.getAttribute('aria-expanded'), 'false');
  assert.equal(await title.isVisible(), false);
  await note.hover();
  await title.waitFor();
  assert.equal(await titleText(), 'Шопен · Ноктюрн op. 9 № 1');
  await page.locator('#lair-music').getByRole('button', { name: 'Следующий трек' }).click();
  assert.equal(await titleText(), 'Шопен · Ноктюрн op. 9 № 2');
  assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem('keynlock-archive-music-position-v1'))).track,
    'chopin-nocturne-op9-no2.mp3', 'the Key Archive resumes the same record');
  await page.locator('#lair-music').getByRole('button', { name: 'Пауза' }).click();
  assert.equal(await page.evaluate(() => localStorage.getItem('keynlock-music-stopped-v1')), '1');
  await page.mouse.move(viewport.width - 50, 115);
  await title.waitFor({ state: 'hidden' });
  assert.equal(await note.getAttribute('aria-expanded'), 'false');

  // The gramophone's panel shows the same player, with volume.
  await openZone(page, 'gramophone');
  await page.locator('#panel-music').waitFor();
  assert.equal(await page.locator('#panel-music .music-controls__title').innerText(), 'Шопен · Ноктюрн op. 9 № 2');
  assert.equal(await page.locator('#panel-music .music-controls__volume').inputValue(), '25');
  await page.locator('#panel-music').getByRole('button', { name: 'Предыдущий трек' }).click();
  assert.equal(await titleText(), 'Шопен · Ноктюрн op. 9 № 1');

  // The lab is the same page: the player and its state stay.
  await enterAlchemy(page);
  await note.hover();
  await title.waitFor();
  assert.equal(await titleText(), 'Шопен · Ноктюрн op. 9 № 1');
});

test('an English page shows the player in English', async t => {
  const page = await openRoom(t, { locale: 'en-US' });
  await page.getByRole('button', { name: 'Music', exact: true }).press('Enter');
  const title = page.locator('#lair-music .music-controls__title');
  await title.waitFor();
  assert.equal((await title.textContent()).replace(/\s*▾$/, ''), 'Chopin · Nocturne Op. 9 No. 1');
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
  // The scene is drawn into the ink outline's buffer (the opaque part once
  // more for its normals) and the shadow map about once a second. Counted per
  // second, not per frame: software WebGL on CI draws only a few frames a
  // second, so one shadow refresh is spread over very few frames.
  const passes = await page.evaluate(async () => {
    const gl = document.querySelector('#scene').getContext('webgl2');
    let target = null;
    const draws = new Map();
    const bind = gl.bindFramebuffer, draw = gl.drawElements, drawArrays = gl.drawArrays;
    const count = () => draws.set(target, (draws.get(target) ?? 0) + 1);
    gl.bindFramebuffer = function (kind, framebuffer) { target = framebuffer; return bind.call(this, kind, framebuffer); };
    gl.drawElements = function (...args) { count(); return draw.apply(this, args); };
    gl.drawArrays = function (...args) { count(); return drawArrays.apply(this, args); };
    const started = performance.now();
    let frames = 0;
    while (performance.now() - started < 3000 || frames < 3) {
      await new Promise(resolve => requestAnimationFrame(resolve));
      frames++;
    }
    const seconds = (performance.now() - started) / 1000;
    Object.assign(gl, { bindFramebuffer: bind, drawElements: draw, drawArrays });
    const totals = [...draws.values()].sort((a, b) => b - a);
    const scenePass = totals[0] / frames;
    // A pass drawing a good part of the scene each frame is a scene pass:
    // colour, and normals (opaque objects only, about half). The rest is per second.
    const scenePasses = totals.filter(total => total / frames >= scenePass * .3);
    const others = totals.filter(total => total / frames < scenePass * .3).reduce((sum, total) => sum + total, 0);
    return { othersPerSecond: Math.round(others / seconds), scenePasses: scenePasses.length };
  });
  assert.ok(passes.scenePasses <= 2, `scene-sized passes per frame: ${passes.scenePasses}`);
  // One shadow refresh (~320 draws) a second, plus the screen quad.
  assert.ok(passes.othersPerSecond < 450, `other draws per second: ${passes.othersPerSecond}`);
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

test('the Lair starts on foot and a zone opened from the walk returns to it', async t => {
  const page = await openRoom(t, { startOnFoot: true, pointerLock: true });
  const wallVisible = () => page.evaluate(() =>
    window.__keynlockDebug.host.renderer.getUnifiedScene().getObjectByName('lair-entrance-wall').visible);
  assert.equal(await page.locator('#room-walk-toggle').getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('.topbar #reset-camera').isVisible(), true);
  assert.equal(await page.locator('.bottom-ui').evaluate(footer => getComputedStyle(footer).backgroundImage), 'none');
  assert.equal(await wallVisible(), true, 'the default walk sees the entrance doors from inside');
  assert.equal(await page.evaluate(() => document.pointerLockElement), null, 'loading needs no mouse capture');
  await page.mouse.click(viewport.width / 2, viewport.height / 2);
  await page.waitForFunction(() => document.pointerLockElement?.id === 'scene-interaction');
  await page.keyboard.press('Escape');
  await page.locator('#lair-visual-panel').waitFor();
  await page.waitForFunction(() => document.pointerLockElement === null);
  assert.equal(await page.locator('#room-walk-toggle').getAttribute('aria-pressed'), 'true');
  await page.locator('#lair-visual-close').click();
  await page.locator('#room-walk-hud').waitFor();
  await page.mouse.click(viewport.width / 2, viewport.height / 2);
  await page.waitForFunction(() => document.pointerLockElement?.id === 'scene-interaction');
  const before = await page.evaluate(() => {
    const camera = window.__keynlockDebug.host.camera;
    camera.position.x += 1.2;
    return camera.position.toArray();
  });
  await page.keyboard.press('5');            // the zone bar is hidden while walking
  await page.locator('#zone-panel').waitFor();
  await page.waitForFunction(() => document.pointerLockElement === null);
  // The label follows the next frame.
  await page.waitForFunction(() => document.querySelector('#reset-camera span')?.textContent.trim() === 'К ПРОГУЛКЕ');
  await page.locator('#reset-camera').click();
  await page.waitForFunction(() => document.querySelector('#room-walk-toggle').getAttribute('aria-pressed') === 'true');
  const after = await page.evaluate(() => window.__keynlockDebug.host.camera.position.toArray());
  assert.ok(after.every((value, axis) => Math.abs(value - before[axis]) < .05), 'back where the walker stood');
  // The playlist lists every track and can switch to one.
  await page.locator('#lair-music-toggle').hover();
  await page.locator('#lair-music .music-controls__title').dispatchEvent('click');
  await page.locator('#lair-music .music-controls__track-button').nth(2).dispatchEvent('click');
  assert.equal(await page.locator('#lair-music .music-controls__track[aria-current="true"]').count(), 1);
  assert.match(await page.locator('#lair-music .music-controls__track[aria-current="true"]').innerText(), /си-бемоль/);
});

test('unlocked mouse movement turns the walker and real steps match the floor surface', async t => {
  const page = await openRoom(t, { startOnFoot: true, beforeLoad: page => page.addInitScript(() => {
    const files = new WeakMap(), samples = new WeakMap();
    // Stall decode so walking starts while the wooden steps are loading.
    const woodReady = new Promise(resolve => { window.releaseWoodSteps = resolve; });
    const fetch = window.fetch.bind(window);
    window.fetch = async (...args) => {
      const response = await fetch(...args);
      const surface = new URL(String(args[0]), location.href).pathname.match(/\/(wood|rug)-\d[^/]*\.wav$/)?.[1];
      if (surface) {
        const read = response.arrayBuffer.bind(response);
        response.arrayBuffer = async () => {
          const bytes = await read();
          files.set(bytes, surface);
          return bytes;
        };
      }
      return response;
    };
    const decode = BaseAudioContext.prototype.decodeAudioData;
    BaseAudioContext.prototype.decodeAudioData = function (bytes, ...args) {
      return decode.call(this, bytes, ...args).then(async buffer => {
        const surface = files.get(bytes);
        if (surface === 'wood') await woodReady;
        if (surface) samples.set(buffer, surface);
        return buffer;
      });
    };
    window.stepSurfaces = [];
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args) {
      window.stepSurfaces.push(samples.get(this.buffer) || 'synthetic');
      return start.apply(this, args);
    };
  }) });
  const yaw = () => page.evaluate(() => window.__keynlockDebug.walk.getPose().yaw);
  await page.mouse.move(400, 460);
  const original = await yaw();
  await page.mouse.move(700, 460);
  assert.ok(Math.abs(await yaw() - original) > .5);
  assert.equal(await page.evaluate(() => document.pointerLockElement), null);

  const startZ = await page.evaluate(() => {
    const { walk, host } = window.__keynlockDebug;
    walk.face(0, 0);
    return host.camera.position.z;
  });
  await page.keyboard.down('KeyW');
  await page.waitForFunction(z => window.__keynlockDebug.host.camera.position.z < z - 1.25, startZ);
  assert.deepEqual(await page.evaluate(() => window.stepSurfaces), []);
  await page.evaluate(() => window.releaseWoodSteps());
  await page.waitForFunction(() => window.stepSurfaces.includes('wood'));
  await page.keyboard.up('KeyW');

  await page.evaluate(() => {
    const { camera, renderer } = window.__keynlockDebug.host;
    const rug = renderer.getUnifiedScene().getObjectByName('planning-rug');
    camera.position.x = rug.position.x - 2.5;
    camera.position.z = rug.position.z + 1.8;
  });
  await page.keyboard.down('KeyW');
  await page.waitForFunction(() => window.stepSurfaces.includes('rug'));
  await page.keyboard.up('KeyW');
  assert.ok(await page.evaluate(() => window.stepSurfaces.every(surface => surface !== 'synthetic')));
});

test('the overview camera stays inside while rotating, zooming and panning', async t => {
  const page = await openRoom(t);
  const result = await page.evaluate(async () => {
    const { camera, controls, renderer } = window.__keynlockDebug.host;
    const scene = renderer.getUnifiedScene();
    const wall = scene.getObjectByName('lair-entrance-wall');
    const ceiling = scene.getObjectByName('lair-ceiling');
    ceiling.geometry.computeBoundingBox();
    const ceilingY = ceiling.geometry.boundingBox.clone().applyMatrix4(ceiling.matrixWorld).min.y;
    const poses = [];
    const apply = async move => {
      move();
      await new Promise(resolve => requestAnimationFrame(resolve));
      poses.push(camera.position.toArray());
    };
    await apply(() => controls.dollyOut(.3));
    for (let i = 0; i < 8; i++) await apply(() => controls.rotateLeft(Math.PI * .75));
    await apply(() => controls.rotateUp(Math.PI * 2));
    await apply(() => controls.rotateUp(-Math.PI * 2));
    await apply(() => controls.pan(-5000, 2000));
    return { poses, ceilingY, entranceZ: wall.position.z - .135, entranceVisible: wall.visible };
  });
  assert.equal(result.entranceVisible, true);
  for (const [x, y, z] of result.poses) {
    assert.ok(Math.abs(x) < 8.415 && y > .0385 && y < result.ceilingY && z > -5.485 && z < result.entranceZ,
      `outside the room at ${[x, y, z]}`);
  }
  assert.ok(Math.max(...result.poses.map(pose => pose[0])) - Math.min(...result.poses.map(pose => pose[0])) > 2,
    'the camera can still move around the room');
});

test('both sofas stand close to the corner walls and face the planning table', async t => {
  const page = await openRoom(t, { startOnFoot: true });
  const geometry = await page.waitForFunction(() => {
    const { camera, renderer } = window.__keynlockDebug.host;
    const scene = renderer.getUnifiedScene();
    const sofas = ['planning-sofa', 'planning-sofa-left'].map(name => scene.getObjectByName(name));
    if (sofas.some(sofa => !sofa)) return null;
    scene.updateMatrixWorld(true);
    const table = scene.getObjectByName('planning-main-table');
    return sofas.map(sofa => {
      // Measure the actual vertices. An axis-aligned box around the rotated
      // sofa's local box overestimates clearance needed at the corner.
      const meshes = sofa.getObjectsByProperty('isMesh', true);
      const points = meshes[0].geometry;
      points.computeBoundingBox();
      const bounds = points.boundingBox.clone().setFromObject(sofa, true);
      const toTable = table.position.clone().sub(sofa.position).setY(0).normalize();
      const sofaFront = camera.position.clone().set(0, 0, 1).transformDirection(sofa.matrixWorld);
      return { x: sofa.position.x, z: sofa.position.z, floor: bounds.min.y, scale: sofa.scale.x,
        outerSide: Math.max(bounds.max.x, -bounds.min.x), rearEdge: bounds.min.z,
        facing: sofaFront.dot(toTable), shadow: meshes.every(mesh => mesh.castShadow && mesh.receiveShadow) };
    });
  });
  const [right, left] = await geometry.jsonValue();
  assert.ok(right.x > 6.8 && right.z < -3.79);
  assert.ok(left.x < -6.48 && left.z < -3.72);
  assert.equal(right.scale, 1.23 * 1.6);
  for (const sofa of [right, left]) {
    assert.ok(sofa.outerSide < 8.24 && sofa.rearEdge > -5.33 && sofa.rearEdge < -5.20);
    assert.ok(Math.abs(sofa.floor - .0385) < .001);
    assert.ok(sofa.facing > .99);
    assert.equal(sofa.shadow, true);
  }
});

test('the added planning furniture loads and the chairs share render resources', async t => {
  const page = await openRoom(t, { startOnFoot: true });
  const placement = await page.waitForFunction(() => {
    const scene = window.__keynlockDebug.host.renderer.getUnifiedScene();
    const names = ['planning-sofa-left', 'planning-chair', 'planning-chair-right',
      'planning-armchair', 'planning-bookcase'];
    const models = names.map(name => scene.getObjectByName(name));
    const tables = ['planning-side-table', 'planning-side-table-between-seats',
      'planning-side-table-left-corner', 'planning-side-table-right-corner'].map(name => scene.getObjectByName(name));
    const vases = ['planning-vase-antique', 'planning-vase-ceramic'].map(name => scene.getObjectByName(name));
    if ([...models, ...tables, ...vases].some(model => !model)) return null;
    scene.updateMatrixWorld(true);
    const [left, chair, rightChair, armchair, bookcase] = models;
    const sofa = scene.getObjectByName('planning-sofa');
    const [front, between, leftCorner, rightCorner] = tables;
    const mesh = model => model.getObjectsByProperty('isMesh', true)[0];
    const worldBounds = model => {
      const first = mesh(model).geometry;
      first.computeBoundingBox();
      const result = first.boundingBox.clone().makeEmpty();
      model.traverse(part => {
        if (!part.isMesh) return;
        part.geometry.computeBoundingBox();
        result.union(part.geometry.boundingBox.clone().applyMatrix4(part.matrixWorld));
      });
      return result;
    };
    const width = model => {
      const bounds = mesh(model).geometry;
      bounds.computeBoundingBox();
      return (bounds.boundingBox.max.x - bounds.boundingBox.min.x) * model.scale.x;
    };
    const leftFacing = left.position.clone().set(0, 0, 1).transformDirection(left.matrixWorld);
    const armchairFacing = leftFacing.clone().set(0, 0, 1).transformDirection(armchair.matrixWorld);
    const toCoffeeTable = between.position.clone().sub(armchair.position).setY(0).normalize();
    const toMainTable = scene.getObjectByName('planning-main-table').position.clone()
      .sub(armchair.position).setY(0).normalize();
    const cabinet = worldBounds(bookcase);
    const alchemyTable = worldBounds(scene.getObjectByName('alchemy-main-tabletop'));
    const alchemyShelf = worldBounds(scene.getObjectByName('alchemy-wall-shelf'));
    const rightTrim = worldBounds(scene.getObjectByName('lair-wainscot-right-cap'));
    const vasesOnTables = vases.every((vase, i) => {
      const top = worldBounds([leftCorner, rightCorner][i]);
      const base = worldBounds(vase);
      return vase.scale.x === 1.5 && Math.abs(base.min.y - top.max.y) < .001 &&
        base.min.x > top.min.x && base.max.x < top.max.x &&
        base.min.z > top.min.z && base.max.z < top.max.z && mesh(vase).receiveShadow;
    });
    return { leftX: left.position.x, leftZ: left.position.z, widthRatio: width(left) / width(sofa),
      rightChair: rightChair.position.x > 1,
      chairScales: [chair.scale.x, rightChair.scale.x],
      armchairTurn: Math.atan2(
        toCoffeeTable.clone().cross(armchairFacing).y, toCoffeeTable.dot(armchairFacing)),
      facesMainTable: armchairFacing.dot(toMainTable) > toCoffeeTable.dot(toMainTable),
      bookcaseFits: cabinet.min.z > worldBounds(armchair).max.z &&
        cabinet.max.z < Math.min(alchemyTable.min.z, alchemyShelf.min.z) && cabinet.max.x < rightTrim.min.x &&
        Math.abs(cabinet.min.y - .0385) < .001,
      vasesOnTables,
      nightstandRemoved: !scene.getObjectByName('planning-nightstand'),
      sharedChair: mesh(chair).geometry === mesh(rightChair).geometry && mesh(chair).material === mesh(rightChair).material,
      armchairBesideSofa: armchair.scale.x === 1.4 && armchair.position.x > sofa.position.x &&
        between.position.z > sofa.position.z && between.position.z < armchair.position.z,
      roundTables: tables.every(table => {
        const box = worldBounds(table);
        const height = table === leftCorner || table === rightCorner ? 1.30 : .65;
        return Math.abs(box.max.x - box.min.x - .70) < .01 &&
          Math.abs(box.max.y - box.min.y - height) < .001 &&
          mesh(table).geometry === mesh(front).geometry;
      }) &&
        front.position.clone().sub(left.position).dot(leftFacing) > 1 &&
        leftCorner.position.z < left.position.z && rightCorner.position.z < sofa.position.z,
      allCastShadows: [...models, ...tables].every(model => mesh(model).castShadow) };
  });
  const result = await placement.jsonValue();
  assert.ok(result.leftX < -6 && result.leftZ < -3.4);
  assert.ok(Math.abs(result.widthRatio - 1.1) < .01);
  assert.ok(result.rightChair && result.sharedChair && result.allCastShadows);
  assert.ok(result.armchairBesideSofa && result.roundTables);
  assert.deepEqual(result.chairScales, [1.04 * 1.2, 1.04 * 1.2]);
  assert.ok(Math.abs(result.armchairTurn - Math.PI / 9) < .01 && result.facesMainTable);
  assert.ok(result.bookcaseFits, 'The bookcase stands between the armchair and the alchemy counter');
  assert.ok(result.vasesOnTables && result.nightstandRemoved);
});

test('the stacked books rest on the shifted planning shelf', async t => {
  const page = await openRoom(t);
  const placement = await page.waitForFunction(() => {
    const scene = window.__keynlockDebug.host.renderer.getUnifiedScene();
    const books = scene.getObjectByName('planning-shelf-books');
    if (!books) return null;
    const shelf = scene.getObjectByName('planning-wall-shelf');
    shelf.geometry.computeBoundingBox();
    const support = shelf.geometry.boundingBox.clone().applyMatrix4(shelf.matrixWorld);
    const stack = support.clone().makeEmpty();
    books.traverse(mesh => {
      if (!mesh.isMesh) return;
      mesh.geometry.computeBoundingBox();
      stack.union(mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld));
    });
    return { restsOnShelf: Math.abs(stack.min.y - support.max.y) < .001,
      fitsShelf: stack.min.x >= support.min.x && stack.max.x <= support.max.x &&
        stack.min.z >= support.min.z && stack.max.z <= support.max.z,
      boxBooks: scene.getObjectByName('planning-shelf-book') != null };
  });
  assert.deepEqual(await placement.jsonValue(), { restsOnShelf: true, fitsShelf: true, boxBooks: false });
});

test('both SIKISI bird models load and the flock flies outside at different heights', async t => {
  const page = await openRoom(t, { startOnFoot: true });
  const snapshot = () => page.evaluate(() => {
    const scene = window.__keynlockDebug.host.renderer.getUnifiedScene();
    const flock = scene.getObjectByName('bird-flock');
    return flock?.children.filter(actor => actor.userData.flight).map(actor => {
      let skinned = false;
      actor.traverse(object => { skinned ||= Boolean(object.isSkinnedMesh); });
      return { position: actor.position.toArray(), skinned };
    });
  });
  await page.waitForFunction(() => {
    const flock = window.__keynlockDebug.host.renderer.getUnifiedScene().getObjectByName('bird-flock');
    const heights = flock?.children.filter(actor => actor.userData.flight).map(actor => actor.position.y);
    return heights?.length === 3 && Math.max(...heights) - Math.min(...heights) > .5;
  });
  const before = await snapshot();
  assert.ok(before.every(actor => actor.skinned && actor.position[2] < -5.755));
  await page.waitForFunction(([x, , z]) => {
    const [first] = window.__keynlockDebug.host.renderer.getUnifiedScene().getObjectByName('bird-flock').children;
    return Math.hypot(first.position.x - x, first.position.z - z) > .75;
  }, before[0].position);
});

test('the settings choose a quality level and a 60 FPS cap, and remember them', async t => {
  const page = await openRoom(t);
  await page.locator('#lair-visual-toggle').click();
  await page.locator('#quality-mode').waitFor();
  assert.deepEqual(await page.locator('#lair-visual-panel .visual-section > h3').allTextContents(), [
    'Качество и скорость', 'Язык', 'Рисовка и воздух', 'Гуашевые текстуры',
    'Металлические поверхности', 'Отделка правой стены',
  ]);
  assert.equal(await page.locator('#quality-mode').inputValue(), 'auto');
  const bufferWidth = () => page.evaluate(() => document.querySelector('#scene').width);
  await page.locator('#quality-mode').selectOption('minimal');
  await page.waitForFunction(() => /Минимальное/.test(document.querySelector('#quality-now').textContent));
  const minimal = await bufferWidth();
  await page.locator('#quality-mode').selectOption('high');
  await page.waitForFunction(() => /Высокое/.test(document.querySelector('#quality-now').textContent));
  assert.ok(await bufferWidth() > minimal, 'a higher level draws more pixels');
  await page.locator('#fps-cap').check();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('keynlock-lair-visual-v1')));
  assert.equal(saved['quality-mode'], 'high');
  assert.equal(saved['fps-cap'], true);
});
