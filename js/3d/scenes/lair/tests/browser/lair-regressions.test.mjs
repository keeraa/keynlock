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

// The catalog loads paintings from GitHub. Serve them from this checkout so the
// tests neither wait on the network nor depend on what is on the remote branch.
const repoRoot = fileURLToPath(new URL('../../../../../../', import.meta.url));
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
  const activeStationLights = id => {
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
    restorationLights: activeStationLights('restoration'),
    alchemyLights: activeStationLights('alchemy'),
  };
}

before(async () => {
  server = await preview({ preview: { host: '127.0.0.1', port: 0 } });
  baseUrl = `http://127.0.0.1:${server.httpServer.address().port}/`;
  const channel = process.env.PLAYWRIGHT_CHROMIUM_CHANNEL;
  const webglArgs = process.platform === 'darwin'
    ? ['--enable-gpu', '--use-angle=metal']
    : ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
  browser = await chromium.launch({ channel, args: [...webglArgs, '--mute-audio'] });
});

after(async () => {
  await browser?.close();
  if (server) await new Promise(resolve => server.httpServer.close(resolve));
});

async function openRoom(t, { locale = 'ru-RU' } = {}) {
  const context = await browser.newContext({ viewport, locale });
  t.after(() => context.close());
  await servePaintingsLocally(context);
  const page = await context.newPage();
  page.setDefaultTimeout(timeout);
  const response = await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout });
  assert.equal(response.status(), 200);
  await page.locator('#app > #loading').waitFor({ state: 'hidden' });
  assert.equal(await page.locator('#app > #fallback').isVisible(), false, 'WebGL must render the room');
  return page;
}

async function enterAlchemy(page) {
  await page.locator('.zone-nav [data-zone="alchemy"]').click();
  await page.waitForFunction(() => window.__keynlockDebug.workshop('alchemy')?.lifecycle.isActive());
  await page.getByRole('button', { name: 'Выйти из алхимии в логово' }).waitFor();
  const visualToggle = page.locator('#alchemy-visual-toggle');
  if (await visualToggle.getAttribute('aria-expanded') === 'true') await visualToggle.click();
}

async function clickAlchemyObject(page, kind, id) {
  const point = await page.evaluate(({ kind, id }) => {
    const camera = window.__keynlockDebug.host.camera;
    const scene = window.__keynlockDebug.host.renderer.getUnifiedScene();
    const station = scene.getObjectByName('keynlock-world-alchemy:main');
    const object = station.getObjectsByProperty('isMesh', true).find(mesh => {
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
  await page.getByRole('button', { name: 'Выйти из алхимии в логово' }).click();
  assert.equal(await page.evaluate(() => window.__keynlockDebug.workshop('alchemy').lifecycle.isActive()), false);
  const pausedHeat = await page.evaluate(() => window.__keynlockDebug.workshop('alchemy').getState().recipeHeatSeconds);

  await page.waitForTimeout(600);
  assert.equal(await page.evaluate(() => window.__keynlockDebug.workshop('alchemy').getState().recipeHeatSeconds), pausedHeat);
  // Observe the first simulation step rather than sampling an arbitrary rendered frame.
  await page.evaluate(() => {
    const api = window.__keynlockDebug.workshop('alchemy');
    const host = window.__keynlockDebug.host.renderer;
    const step = host.stepWorldRuntime;
    window.addEventListener('keynlock:alchemy:v1', function onResume(event) {
      if (event.detail.type !== 'resume') return;
      window.removeEventListener('keynlock:alchemy:v1', onResume);
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
  await page.locator('.zone-nav [data-zone="restoration"]').click();
  await page.waitForFunction(() => window.__keynlockDebug.workshop('restoration')?.bridge?.isReady());
  const bridge = await page.evaluateHandle(() => window.__keynlockDebug.workshop('restoration')?.bridge);
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
    window.__keynlockDebug.workshop('restoration')?.bridge.snapshot().selected === index, previous);
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
  await page.waitForFunction(() => window.__keynlockDebug.workshop('restoration')?.bridge.isReady());
  await atelier.locator('[data-tool="brush"]').click();
  assert.equal(await bridge.evaluate(api => api.snapshot().tool), 'brush');
});

test('switching workshops returns the shared camera, input, and lights to the room', async t => {
  const page = await openRoom(t);
  const home = await page.evaluate(readRoom);
  assert.ok(home.roomLights.some(light => light.visible));
  assert.equal(home.restorationLights, 0);
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
    assert.equal(restored.restorationLights, 0);
    assert.equal(restored.alchemyLights, 0);
    assert.equal(await page.locator('#alchemy-input-plane').isVisible(), false);
    assert.equal(await page.evaluate(() => window.__keynlockDebug.workshop('alchemy').lifecycle.isActive()), false);
  }

  const reset = page.locator('#reset-camera');
  await page.locator('.zone-nav [data-zone="restoration"]').click();
  await page.waitForFunction(position =>
    window.__keynlockDebug.host.camera.position.toArray().some((value, axis) => Math.abs(value - position[axis]) > 3),
  home.position);
  await page.locator('#lair-focus-copy').click();
  await page.waitForFunction(() => window.__keynlockDebug.host.controls.minDistance < 2);
  const closeUp = await page.evaluate(readRoom);
  assert.ok(closeUp.restorationLights > 0);
  assert.equal(closeUp.alchemyLights, 0);
  await reset.click();
  await assertHome();

  await enterAlchemy(page);
  await settleAlchemyCamera(page);
  const lab = await page.evaluate(readRoom);
  assert.equal(lab.controls.enabled, false);
  assert.ok(lab.roomLights.every(light => !light.visible));
  assert.ok(lab.alchemyLights > 0);
  assert.equal(lab.restorationLights, 0);
  await page.keyboard.press('1');
  await page.locator('#lair-easel-camera-controls').waitFor();
  const atelier = await page.evaluate(readRoom);
  assert.equal(atelier.controls.enabled, true);
  assert.deepEqual(atelier.roomLights, home.roomLights);
  assert.ok(atelier.restorationLights > 0);
  assert.equal(atelier.alchemyLights, 0);
  assert.equal(await page.locator('#alchemy-input-plane').isVisible(), false);

  await page.locator('#wall-collection-entry').click();
  await page.locator('#lair-gallery-controls').waitFor();
  assert.equal((await page.evaluate(readRoom)).controls.enabled, false);
  await reset.click();
  await assertHome();

  await enterAlchemy(page);
  await page.getByRole('button', { name: 'Выйти из алхимии в логово' }).click();
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
  await page.waitForFunction(() => window.__keynlockDebug.workshop('restoration')?.bridge?.isReady()
    && window.__keynlockDebug.workshop('alchemy'));
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
    window.__keynlockDebug.host.renderer.getUnifiedScene().getObjectByName('keynlock-world-restoration')
      .traverse(object => { if (object.isDirectionalLight && object.castShadow) count++; });
    return count;
  });
  assert.equal(atelierShadowLights, 0);

  // The Atelier's own tools work inside the room.
  await page.locator('.zone-nav [data-zone="restoration"]').click();
  await page.locator('#lair-focus-copy').click();
  await page.waitForFunction(() => window.__keynlockDebug.host.controls.minDistance < 2);
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
  await page.locator('.zone-nav [data-zone="restoration"]').click();
  await page.locator('#wall-collection-entry').click();
  await page.waitForFunction(() => window.__keynlockDebug.host.atelier.galleryActive === true);
  assert.equal(await page.locator('#lair-gallery-controls').isVisible(), true);
  await page.locator('#gallery-easels').click();
  await page.waitForFunction(() => window.__keynlockDebug.host.atelier.galleryActive === false);
  assert.equal(await page.locator('#lair-gallery-controls').isVisible(), false);
});

test('an English browser gets the Lair in English, with a language switch', async t => {
  const page = await openRoom(t, { locale: 'en-US' });
  assert.equal(await page.title(), "KEYNLOCK · The team's lair");
  assert.equal(await page.evaluate(() => document.documentElement.lang), 'en');
  assert.equal(await page.locator('.zone-nav [data-zone="workbench"] span:last-child').innerText(), 'Workbench');
  assert.equal(await page.locator('#lair-language').inputValue(), 'en');
  assert.deepEqual(await page.locator('#lair-language option').evaluateAll(options => options.map(o => o.value)), ['ru', 'en']);
});
