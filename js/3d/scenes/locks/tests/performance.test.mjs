import test from 'node:test';
import assert from 'node:assert/strict';
import { createPerformanceMonitor, combineFrameStats } from '../src/js/performance/metrics.js';
import { createOilMaterialPalettes } from '../src/js/effects/oil-materials.js';
import * as THREE from '../src/vendor/three-core.js';

test('performance benchmark records average FPS, P95, draw calls and memory', () => {
  const elements = [];
  const document = { body: { append: element => elements.push(element) }, createElement: () => ({
    style: {}, setAttribute() {}, textContent: '',
  }) };
  const window = {};
  const monitor = createPerformanceMonitor({ enabled: true, document, window });
  for (let i = 1; i <= 120; i++) {
    monitor.record(i * (1000 / 60), { calls: 72, triangles: 12800 }, { geometries: 40, textures: 15 });
  }
  assert.equal(elements.length, 1);
  assert.equal(monitor.snapshot().fps, 60);
  assert.ok(Math.abs(monitor.snapshot().frameP95Ms - 16.7) < .2);
  assert.equal(monitor.snapshot().drawCalls, 72);
  assert.equal(monitor.snapshot().geometries, 40);
  assert.equal(window.__keynlockPerf.textures, 15);
});

test('production mode allocates no telemetry nodes or samples', () => {
  const monitor = createPerformanceMonitor({ enabled: false });
  monitor.record(16.67);
  assert.equal(monitor.snapshot(), null);
});

test('frame telemetry includes both secondary WebGL previews without inflating scene polygons', () => {
  const combined=combineFrameStats(
    {calls: 20, triangles: 2000, sceneTriangles: 1000, points: 340},
    {calls: 4, triangles: 120}, null, {calls: 6, triangles: 180, points: 8});
  assert.deepEqual(combined,{calls:30,triangles:2300,sceneTriangles:1000,points:348,lines:0});
  assert.deepEqual(combineFrameStats({calls:9,triangles:700},null,undefined),
    {calls:9,triangles:700});
});

test('oil marks and runs reuse bounded GPU material palettes', () => {
  const palette = createOilMaterialPalettes(THREE, new THREE.Texture(), new THREE.Texture());
  assert.ok(palette.blotMaterials.length <= 16);
  assert.ok(palette.runMaterials.length <= 14);
  assert.equal(palette.blot(.78), palette.blot(.78));
  assert.equal(palette.run(.64), palette.run(.63));
  assert.ok(palette.blot(.25).opacity < palette.blot(.78).opacity);
});
