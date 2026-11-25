import assert from 'node:assert/strict';
import { after, before } from 'node:test';
import { chromium } from 'playwright';
import { preview } from 'vite';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// CI renders WebGL in software, about 20 times slower than a desktop GPU. The
// camera flights and pouring advance per frame, so their waits stretch with it.
const timeout = process.env.CI ? 240_000 : 30_000;
export const viewport = { width: 1280, height: 860 };
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

export function readRoom() {
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
export function openZone(page, id) {
  return page.evaluate(zone => window.__keynlockDebug.zones.open(zone), id);
}

/** Polls a Node-side condition (e.g. counted network events). */
export async function expectSoon(check, message, timeout = 30000) {
  const end = Date.now() + timeout;
  while (!check()) {
    if (Date.now() > end) assert.fail(message);
    await new Promise(resolve => setTimeout(resolve, 50));
  }
}

export async function openRoom(t, { locale = 'ru-RU', pointerLock = false, beforeLoad, startOnFoot = false } = {}) {
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

export async function enterAlchemy(page) {
  await openZone(page, 'alchemy');
  await page.waitForFunction(() => window.__keynlockDebug.workshop('alchemy')?.lifecycle?.isActive());
  await page.getByRole('button', { name: 'Вернуться в логово' }).waitFor();
  // One way back for every mode, in one place: no second exit inside the lab.
  assert.equal(await page.getByRole('button', { name: /в логово/i }).count(), 1);
  assert.equal((await page.locator('#reset-camera span').innerText()).trim(), 'В ЛОГОВО');
  const visualToggle = page.locator('#alchemy-visual-toggle');
  if (await visualToggle.getAttribute('aria-expanded') === 'true') await visualToggle.click();
}

export async function clickAlchemyObject(page, kind, id) {
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

export async function settleAlchemyCamera(page) {
  // The Lair frames the lab a little higher than its own pose, so wait for the
  // flight to end rather than for the camera to reach the lab's exact pose.
  await page.waitForFunction(() => window.__keynlockDebug.workshop('alchemy')?.lifecycle?.isActive()
    && !window.__keynlockDebug.zones.isTransitioning());
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
