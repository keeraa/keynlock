import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createCartoonFilter } from '../src/effects/cartoon-filter.js';
import { drawingFragmentShader } from '../src/effects/drawing-shader.js';

test('background blur stays active when toon shading and outlines are off', () => {
  const camera = new THREE.PerspectiveCamera(39, 1, .1, 65);
  const scene = new THREE.Scene();
  let composite = null;
  let renderCount = 0;
  const renderer = {
    info: { render: { calls: 1, triangles: 2 } },
    getPixelRatio: () => 2,
    getRenderTarget: () => null,
    setRenderTarget() {},
    render(target) {
      renderCount++;
      if (target !== scene) composite = target.children[0].material.uniforms;
    },
  };
  const filter = createCartoonFilter({ THREE, renderer, scene, camera });
  filter.resize(640, 480, 2);
  filter.setOptions({ toon: false, outline: false });
  filter.setFocus(7.65);
  filter.render();
  assert.equal(renderCount, 2, 'room is drawn through the blur composite');
  assert.ok(composite.uBackgroundBlur.value >= .9);
  assert.equal(composite.uBlurRadius.value, 22, 'radius scales with pixel ratio');
  assert.equal(composite.uFocus.value, 7.65);
  filter.dispose();
});

test('background mask follows the focus plane and excludes foreground taps', () => {
  assert.match(drawingFragmentShader, /backgroundMask\(centerDepth\)/);
  assert.match(drawingFragmentShader, /backgroundMask\(eyeDepth\(uv\)\)/);
  assert.match(drawingFragmentShader, /uTexel \* uBlurRadius/);
  assert.match(drawingFragmentShader, /i < 8/);
});
