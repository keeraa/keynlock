import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createCartoonFilter } from '../src/effects/cartoon-filter.js';
import { backgroundBlurFragmentShader } from '../src/effects/background-blur-shader.js';
import { drawingFragmentShader } from '../src/effects/drawing-shader.js';

test('background blur uses two half-resolution passes even without toon or outlines', () => {
  const camera = new THREE.PerspectiveCamera(39, 1, .1, 65);
  const scene = new THREE.Scene();
  const passes = [];
  let currentTarget = null;
  const renderer = {
    info: { render: { calls: 1, triangles: 2 } },
    getPixelRatio: () => 2,
    getRenderTarget: () => currentTarget,
    setRenderTarget(target) { currentTarget = target; },
    render(renderScene) {
      const uniforms = renderScene === scene ? null : renderScene.children[0].material.uniforms;
      passes.push({
        target: currentTarget,
        uniforms,
        direction: uniforms?.uDirection?.value.toArray(),
        premultiplied: uniforms?.uPremultiplied?.value,
        source: uniforms?.tSource?.value,
      });
    },
  };
  const filter = createCartoonFilter({ THREE, renderer, scene, camera });
  filter.resize(640, 480, 2);
  filter.setOptions({ toon: false, outline: false });
  filter.setFocus(7.65);
  filter.render();
  assert.equal(passes.length, 4, 'scene, horizontal Gaussian, vertical Gaussian, composite');
  assert.deepEqual(passes.slice(1, 3).map(pass => pass.direction), [[1, 0], [0, 1]]);
  assert.deepEqual(passes.slice(1, 3).map(pass => pass.premultiplied), [0, 1]);
  assert.equal(passes[1].target.width, 640);
  assert.equal(passes[1].target.height, 480);
  assert.equal(passes[2].source, passes[1].target.texture);
  assert.equal(passes[3].uniforms.tBlur.value, passes[2].target.texture);
  assert.equal(passes[3].uniforms.uBackgroundBlur.value, .72);
  assert.equal(passes[1].uniforms.uBlurRadius.value, 13, 'radius scales with pixel ratio');
  assert.equal(passes[3].uniforms.uFocus.value, 7.65);
  assert.equal(passes[1].uniforms.uFocus.value, 7.65);

  passes.length = 0;
  filter.setOptions({ backgroundBlur: 0, toon: true });
  filter.render();
  assert.equal(passes.length, 2, 'blur passes are skipped when only toon is enabled');
  filter.dispose();
});

test('Gaussian blur rejects foreground colors and composites without depth-edge halos', () => {
  assert.match(backgroundBlurFragmentShader, /backgroundMask\(eyeDepth\(uv\)\)/);
  assert.match(backgroundBlurFragmentShader, /color\.rgb \* mask, mask/);
  assert.match(backgroundBlurFragmentShader, /uPremultiplied > 0\.5/);
  assert.match(backgroundBlurFragmentShader, /\.2270270/);
  assert.match(backgroundBlurFragmentShader, /direction \* 4\.0/);
  assert.match(drawingFragmentShader, /backgroundMask\(centerDepth\)/);
  assert.match(drawingFragmentShader, /soft\.rgb \/ soft\.a/);
  assert.doesNotMatch(drawingFragmentShader, /vec2 offset|for \(int i = 0; i < 8/);
});

test('outline falls off before the wall and gallery so only foreground objects keep ink', () => {
  assert.match(drawingFragmentShader, /float outlineForeground\(float distance\)/);
  assert.match(drawingFragmentShader, /1\.0 - smoothstep\(\.35, 1\.35, distance - uFocus\)/);
  assert.match(drawingFragmentShader, /inkEdge\(vUv\) \* uOutline \* outlineForeground\(eyeDepth\(vUv\)\)/);
});
