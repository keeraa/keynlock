import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createInitialState, STORAGE_KEY } from '../../dist/js/rules.js';

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
    args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
});

after(async () => {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
});

async function enterArchive(page, label) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('response', response => {
    if (response.status() >= 400) errors.push(`HTTP ${response.status()}: ${response.url()}`);
  });
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  try {
    await page.waitForFunction(() => {
      const value = document.querySelector('#fps')?.textContent?.trim();
      return value && value !== '—';
    }, null, { timeout: 30000 });
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

test('Chromium renders the Three.js hall and opens the visual controls', { timeout: 120000 }, async t => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  t.after(() => page.close());
  const errors = await enterArchive(page, 'webgl');
  const visualState = await page.locator('#visual-status').textContent();
  assert.notEqual(visualState, 'Canvas 2D', 'WebGL unexpectedly fell back to Canvas');
  const frameCount = Number(await page.locator('#fps').textContent());
  assert.ok(Number.isFinite(frameCount) && frameCount > 0);
  await page.screenshot({ path: join(screenshots, 'archive-webgl.png') });
  await page.keyboard.press('v');
  await page.locator('#visual').waitFor({ state: 'visible' });
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

test('Canvas fallback retains keys, migrates old baths and accepts a drop action', { timeout: 120000 }, async t => {
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
  const errors = await enterArchive(page, 'canvas');
  assert.equal(await page.locator('#visual-status').textContent(), 'Canvas 2D');
  assert.equal(await page.locator('#hand-count').textContent(), '1 / 4');
  assert.equal(await page.locator('.slot-thumbnail').count(), 1);
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  assert.equal(saved.keys.find(key => key.id === muddy.id).bathId, 'center-mud');
  await page.screenshot({ path: join(screenshots, 'archive-canvas.png') });
  await page.keyboard.press('r');
  await page.waitForFunction(key => JSON.parse(localStorage.getItem(key))?.held.length === 0, STORAGE_KEY);
  const dropped = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  assert.equal(dropped.keys.find(key => key.id === held.id).status, 'floor');
  assert.deepEqual(errors, []);
});
