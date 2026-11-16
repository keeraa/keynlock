import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseDemoWallPaintings } from '../src/wall-demo.js';
import { keynlockPaintings } from '../src/painting-catalog.js';

function rng(initial) {
  let seed = initial;
  return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
}

test('demo samples 30 unique real reproductions without altering the source collection', () => {
  const before = keynlockPaintings.map((art) => art.id);
  const sample = chooseDemoWallPaintings(keynlockPaintings, rng(123));
  assert.equal(sample.length, 30);
  assert.equal(new Set(sample.map((art) => art.id)).size, 30);
  assert.ok(sample.every((art) => art.image && art.title));
  assert.deepEqual(keynlockPaintings.map((art) => art.id), before);
});

test('different demo shuffles produce different layouts and never duplicate a painting', () => {
  const arts = [...keynlockPaintings, keynlockPaintings[0]];
  const first = chooseDemoWallPaintings(arts, rng(10));
  const repeated = chooseDemoWallPaintings(arts, rng(10));
  const second = chooseDemoWallPaintings(arts, rng(20));
  assert.deepEqual(first.map((art) => art.id), repeated.map((art) => art.id));
  assert.notDeepEqual(first.map((art) => art.id), second.map((art) => art.id));
  assert.equal(new Set(second.map((art) => art.id)).size, 30);
});
