// Shared set-up for the Key Archive browser smoke tests: a static server for
// dist/, one headless Chromium per test file, and helpers to enter the hall.
// Each smoke file imports this module, which registers the before/after hooks.
import { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';


// CI renders WebGL in software (SwiftShader, no GPU): frames are 3-60x slower
// than on a desktop, so every wait there gets proportionally more time.
export const SLOW = process.env.CI ? 4 : 1;

const directory = resolve(fileURLToPath(new URL('../../dist/', import.meta.url)));
export const screenshots = fileURLToPath(new URL('../../test-results/', import.meta.url));
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.webp': 'image/webp', '.png': 'image/png', '.json': 'application/json' };
let server;
// Live bindings: set in before(), read by the test files.
export let browser, baseUrl;

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

export function occupiedSlots(page) {
  return page.locator('#inventory .inventory-slot:has(.slot-name)');
}

export async function enterArchive(page, label) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() !== 'error') return;
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


export async function installTestCamera(page) {
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
