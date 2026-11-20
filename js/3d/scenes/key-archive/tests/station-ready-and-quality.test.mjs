import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createAutoQuality, qualityLevels } from '../dist/js/auto-quality.js';
import { DEFAULT_VISUAL_SETTINGS, normalizeVisualSettings } from '../dist/js/visual-settings.js';

// Feeds `seconds` of frames at `fps`; returns every ratio change.
function run(quality, start, seconds, fps, active = true) {
  const changes = [];
  const step = 1000 / fps;
  let now = start;
  for (; now < start + seconds * 1000; now += step) {
    const ratio = quality.sample(now, step, active);
    if (ratio) changes.push(ratio);
  }
  return { changes, now };
}

test('quality levels start at the device ratio (at most 2) and only go down', () => {
  assert.deepEqual(qualityLevels(2), [2, 1.5, 1, .75]);
  assert.deepEqual(qualityLevels(3), [2, 1.5, 1, .75]);
  assert.deepEqual(qualityLevels(1), [1, .75]);
  assert.deepEqual(qualityLevels(1.25), [1.25, 1, .75]);
});

test('a smooth hall keeps full detail', () => {
  const quality = createAutoQuality({ devicePixelRatio: 2 });
  assert.deepEqual(run(quality, 0, 30, 60).changes, []);
  assert.equal(quality.pixelRatio, 2);
});

test('a slow hall lowers resolution one step at a time, never below the last level', () => {
  const quality = createAutoQuality({ devicePixelRatio: 2 });
  const first = run(quality, 0, 8, 25);
  assert.deepEqual(first.changes, [1.5], 'one step after the settle time and one window');
  const rest = run(quality, first.now, 60, 25);
  assert.deepEqual(rest.changes, [1, .75]);
  assert.equal(quality.pixelRatio, .75);
});

test('pauses, hidden tabs and single stalls are not slowness', () => {
  const quality = createAutoQuality({ devicePixelRatio: 2 });
  assert.deepEqual(run(quality, 0, 30, 20, false).changes, [], 'not playing');
  let now = 0;
  for (let i = 0; i < 40; i++) { now += 1000; assert.equal(quality.sample(now, 1000, true), null); }
  assert.deepEqual(run(quality, now, 30, 58).changes, [], 'a steady game after stalls');
  assert.equal(quality.reset(), 2);
});

test('the auto quality option is on by default and can be turned off', () => {
  assert.equal(DEFAULT_VISUAL_SETTINGS.autoQuality, true);
  assert.equal(normalizeVisualSettings({ autoQuality: false }).autoQuality, false);
  assert.equal(normalizeVisualSettings({}).autoQuality, true);
  const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
  assert.match(html, /<input id="autoQuality" type="checkbox" checked \/>/);
  const world = readFileSync(new URL('../dist/js/world.js', import.meta.url), 'utf8');
  assert.match(world, /adaptQuality\(now, frameMs, active\)/);
  const main = readFileSync(new URL('../dist/js/main.js', import.meta.url), 'utf8');
  assert.match(main, /world\.adaptQuality\?\.\(now, frameMs, playing && document\.visibilityState === 'visible'\)/);
});

test('a finished bath is announced across the hall, not only next to it', async () => {
  const main = readFileSync(new URL('../dist/js/main.js', import.meta.url), 'utf8');
  assert.match(main, /tone\('ready', Math\.max\(\.35, level\)\)/, 'audible from afar');
  assert.match(main, /if \(distance > 4\) toast\(t\(`toast\.bathReady\.\$\{kind\}`\)\)/);
  assert.match(main, /bathProgress\.update\(playing, playAt, announceBathReady\)/);
  // No glow over the bath: the player found it ugly. Sound and toast only.
  const effects = readFileSync(new URL('../dist/js/station-visual-effects.js', import.meta.url), 'utf8');
  assert.doesNotMatch(effects, /beacon|readyRing|readyGlow/);
  const { default: ru } = await import('../dist/js/locales/ru.js');
  assert.ok(ru['toast.bathReady.mud'] && ru['toast.bathReady.rust']);
});

test('bath progress calls onReady once, when a soaking key finishes', async () => {
  const THREE = await import('../dist/vendor/three.js');
  const { createBathProgress } = await import('../dist/js/archive-bath-progress.js');
  const element = () => ({ hidden: false, dataset: {}, style: {}, value: 0,
    querySelector: () => ({ style: {}, textContent: '' }) });
  const elements = new Map();
  const document = { getElementById: id => {
    if (!elements.has(id)) elements.set(id, id === 'world' ? { clientWidth: 800, clientHeight: 600 } : element());
    return elements.get(id);
  } };
  const camera = new THREE.PerspectiveCamera(70, 4 / 3, .1, 100);
  camera.position.set(0, 1.7, 20);
  let now = 1000;
  const key = { id: 'k', status: 'bath', bathId: 'center-mud', bathUntil: 5000, mud: true };
  const keyIndex = { bathKeys: id => id === 'center-mud' ? [key] : [] };
  const progress = createBathProgress(document, { camera, THREE }, keyIndex, null, () => now);
  const announced = [];
  const onReady = (kind, position) => announced.push([kind, position.x]);
  progress.update(true, () => {}, onReady);
  assert.deepEqual(announced, [], 'still soaking');
  now = 6000;
  progress.update(true, () => {}, onReady);
  progress.update(true, () => {}, onReady);
  assert.equal(announced.length, 1, 'once, not every frame');
  assert.equal(announced[0][0], 'mud');
});
