import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  HALL_PALETTE, HALL_SURFACE_TILE_METERS, HALL_SURFACE_URLS,
} from '../dist/js/hall-surface-textures.js';

test('the walls, brightened vault and carpet each use a small original gouache surface', () => {
  const surfaces = Object.entries(HALL_SURFACE_URLS);
  assert.deepEqual(surfaces.map(([name]) => name), ['wall', 'ceiling', 'carpet', 'wood']);
  assert.match(HALL_SURFACE_URLS.ceiling, /ivory-v3\.webp$/);
  assert.match(HALL_SURFACE_URLS.wall, /warm-plaster-v5\.webp$/);
  assert.match(HALL_SURFACE_URLS.wood, /walnut-v4\.webp$/);
  assert.ok(HALL_SURFACE_TILE_METERS.wall > 2 && HALL_SURFACE_TILE_METERS.wall < 6);
  assert.ok(HALL_SURFACE_TILE_METERS.ceiling > 3 && HALL_SURFACE_TILE_METERS.ceiling < 7);
  assert.ok(HALL_SURFACE_TILE_METERS.carpet > 2 && HALL_SURFACE_TILE_METERS.carpet < 6);
  const paintings = surfaces.map(([name, file]) => {
    const buffer = readFileSync(new URL(file));
    assert.equal(buffer.toString('ascii', 0, 4), 'RIFF', `${name} image header`);
    assert.equal(buffer.toString('ascii', 8, 12), 'WEBP', `${name} WebP format`);
    assert.ok(buffer.byteLength > 30_000 && buffer.byteLength < 350_000,
      `${name} should retain painted details without a large GPU download`);
    return buffer;
  });
  assert.notDeepEqual(paintings[0], paintings[1]);
  assert.notDeepEqual(paintings[1], paintings[2]);
  assert.notDeepEqual(paintings[0], paintings[2]);
});

test('shared room palette keeps architectural materials warm and distinct', () => {
  const red = hex => (hex >>> 16) & 0xff;
  const green = hex => (hex >>> 8) & 0xff;
  const blue = hex => hex & 0xff;
  assert.ok(red(HALL_PALETTE.wall) > green(HALL_PALETTE.wall));
  assert.ok(red(HALL_PALETTE.pilaster) > green(HALL_PALETTE.pilaster));
  assert.ok(red(HALL_PALETTE.ceiling) >= blue(HALL_PALETTE.ceiling));
  assert.ok(red(HALL_PALETTE.carpet) > green(HALL_PALETTE.carpet));
  assert.ok(red(HALL_PALETTE.trim) > blue(HALL_PALETTE.trim));
});
