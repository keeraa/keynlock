import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.js';
import { createPaintedRenderer } from '../dist/js/painted-renderer.js';
import { DEFAULT_VISUAL_SETTINGS } from '../dist/js/visual-settings.js';

function mockRenderer() {
  let target = null;
  let failOutline = false;
  const rendered = [];
  return {
    rendered,
    info: { reset() {} },
    getPixelRatio: () => 1,
    getDrawingBufferSize: size => size.set(640, 360),
    getRenderTarget: () => target,
    setRenderTarget(value) { target = value; },
    readRenderTargetPixels(buffer, x, y, width, height, pixels) {
      pixels.set([x % 255, y % 255, (x + y) % 255, 255]);
    },
    render(scene) {
      const fragment = scene.children[0]?.material?.fragmentShader || '';
      const stage = fragment.includes('inkEdge(vUv)') ? 'outline' :
        fragment.includes('brushContrast') ? 'brush' :
        fragment.includes('bandCenter') ? 'toon' :
        fragment.includes('texture2D(tScene') ? 'copy' : 'world';
      if (failOutline && stage === 'outline') throw new Error('Test outline shader failure');
      rendered.push(stage);
    },
    failOutline(value) { failOutline = value; },
  };
}

test('toon remains active when outline GPU pass fails', () => {
  const renderer = mockRenderer();
  const pipeline = createPaintedRenderer(renderer, new THREE.Scene(), new THREE.Camera(), DEFAULT_VISUAL_SETTINGS);
  const warn = console.warn;
  try {
    console.warn = () => {};
    renderer.failOutline(true);
    pipeline.render();
    assert.deepEqual(pipeline.getStatus().stages, {
      toon: 'active', outline: 'error', distanceBlur: 'active',
    });
    assert.ok(renderer.rendered.includes('copy'));
    renderer.failOutline(false);
    pipeline.setSettings({ ...DEFAULT_VISUAL_SETTINGS, outlineSensitivity: 60 });
    pipeline.render();
    assert.equal(pipeline.getStatus().stages.outline, 'active');
    assert.equal(pipeline.getStatus().mode, 'active');
  } finally {
    console.warn = warn;
    pipeline.dispose();
  }
});

test('toon and contour passes can be switched independently', () => {
  const renderer = mockRenderer();
  const pipeline = createPaintedRenderer(renderer, new THREE.Scene(), new THREE.Camera(),
    { ...DEFAULT_VISUAL_SETTINGS, toonEnabled: false });
  pipeline.render();
  assert.deepEqual(pipeline.getStatus().stages,
    { toon: 'off', outline: 'active', distanceBlur: 'active' });
  assert.ok(renderer.rendered.includes('outline'));
  assert.ok(!renderer.rendered.includes('toon'));
  assert.ok(!renderer.rendered.includes('brush'));
  pipeline.dispose();
});
