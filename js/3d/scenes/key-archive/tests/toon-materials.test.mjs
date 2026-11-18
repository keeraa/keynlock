import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createToonShader } from '../dist/js/painted-shader.js';

test('toon controls operate through one GPU stage without changing scene materials or exposure', () => {
  const world = readFileSync(new URL('../dist/js/world.js', import.meta.url), 'utf8');
  const renderer = readFileSync(new URL('../dist/js/painted-renderer.js', import.meta.url), 'utf8');
  const { shader, uniforms } = createToonShader();
  try {
    assert.doesNotMatch(world, /createToonMaterials|toneMappingExposure\s*-=|\.material = .*Toon/);
    assert.match(renderer, /stages\.toon\.uniforms\.uSteps\.value = next\.toonSteps/);
    assert.match(renderer, /stages\.toon\.uniforms\.uToonLight\.value/);
    assert.match(shader.fragmentShader, /float bandCenter/);
    assert.match(shader.fragmentShader, /float archiveLuma\(vec3 c\)/);
    assert.doesNotMatch(shader.fragmentShader, /float luminance\(/, 'Three.js already defines luminance in shader chunks');
    assert.match(shader.fragmentShader, /clamp\(bandCenter - light, -\.075, \.075\)/);
    assert.equal(uniforms.uSteps.value, 4);
  } finally {
    shader.dispose();
  }
});

test('toon light-band adjustment cannot crush the original scene brightness', () => {
  for (const steps of [2, 4, 8]) {
    for (let light = 0; light <= 1; light += .005) {
      const center = (Math.floor(light * steps) + .5) / steps;
      const adjustment = Math.max(-.075, Math.min(.075, center - light));
      const multiplier = 1 + adjustment * 1.35;
      assert.ok(multiplier >= .898 && multiplier <= 1.102);
    }
  }
});
