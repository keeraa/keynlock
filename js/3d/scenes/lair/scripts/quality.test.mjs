import test from 'node:test';
import assert from 'node:assert/strict';
import { QUALITY_LEVELS, createFrameCap, createQuality } from '../src/rendering/quality.js';

function fakeRenderer(ratio = 1) {
  return { ratio, getPixelRatio() { return this.ratio; }, setPixelRatio(value) { this.ratio = value; } };
}

test('a 60 FPS cap draws every other refresh of a 120 Hz screen and every refresh at 60 Hz', () => {
  const count = (hz, cap) => {
    const skip = createFrameCap(() => cap);
    let drawn = 0;
    for (let i = 0; i < hz * 2; i++) if (!skip(i * 1000 / hz + (i % 3) * .3)) drawn++;
    return drawn / 2;
  };
  assert.ok(Math.abs(count(120, 60) - 60) <= 1, `120 Hz capped: ${count(120, 60)}`);
  assert.ok(Math.abs(count(60, 60) - 60) <= 1, `60 Hz capped: ${count(60, 60)}`);
  assert.equal(count(120, 0), 120, 'no cap draws every refresh');
});

test('levels set the pixel ratio, smoothing and normal pass; the lab bounds the ratio', () => {
  const renderer = fakeRenderer();
  const seen = [];
  const quality = createQuality({ renderer, outline: { setQuality: options => seen.push(options) }, devicePixelRatio: 2 });
  quality.apply();
  assert.equal(renderer.ratio, 1.75);
  assert.deepEqual(seen.at(-1), { samples: 4, normals: true });
  quality.setMode('low');
  assert.equal(renderer.ratio, 1);
  assert.deepEqual(seen.at(-1), { samples: 0, normals: false });
  quality.setMode('high');
  quality.setLabOpen(true);
  assert.equal(renderer.ratio, 1.35);
  quality.setMode('nonsense');
  assert.equal(quality.state().mode, 'auto');
});

test('auto steps down one level after a slow stretch, not after a pause', () => {
  const renderer = fakeRenderer();
  const quality = createQuality({ renderer, outline: null, devicePixelRatio: 2, windowMs: 1000, settleMs: 0 });
  quality.apply();
  // 30 FPS for two seconds.
  for (let now = 0; now <= 2000; now += 33) quality.sample(now, 33, true);
  assert.equal(quality.state().level, QUALITY_LEVELS[1].id);
  // A one-second stall (hidden tab) is not slowness.
  quality.sample(3500, 1500, true);
  assert.equal(quality.state().level, QUALITY_LEVELS[1].id);
  // 60 FPS keeps the level.
  for (let now = 4000; now <= 7000; now += 16.7) quality.sample(now, 16.7, true);
  assert.equal(quality.state().level, QUALITY_LEVELS[1].id);
});
