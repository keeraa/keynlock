import test from 'node:test';
import assert from 'node:assert/strict';
import { createSceneGeometryStatsCache } from '../dist/js/geometry-stats.js';

test('scene statistics stay cached until geometry is invalidated', () => {
  let traversals = 0;
  const mesh = { isMesh: true, visible: true, userData: {}, parent: null,
    geometry: { index: { count: 12 } }, count: 1 };
  const scene = { traverse(callback) { traversals++; callback(mesh); } };
  const stats = createSceneGeometryStatsCache(scene);
  assert.deepEqual(stats.get(), { polygons: 4, triangles: 4 });
  stats.get();
  assert.equal(traversals, 1);
  mesh.geometry.index.count = 18;
  stats.invalidate();
  assert.deepEqual(stats.get(), { polygons: 6, triangles: 6 });
  assert.equal(traversals, 2);
});
