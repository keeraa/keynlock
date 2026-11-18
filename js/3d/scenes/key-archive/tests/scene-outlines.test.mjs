import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { KEY_ART } from '../dist/js/key-art.js';
import {
  SCENE_OUTLINE_GLSL, createSceneOutlineUniforms, applySceneOutlineSettings,
} from '../dist/js/scene-outline.js';
import { normalizeVisualSettings } from '../dist/js/visual-settings.js';

test('Key Forge eight-direction silhouette and crease shader is shared by the full scene', () => {
  assert.equal((SCENE_OUTLINE_GLSL.match(/edgeAt\(vec2\(/g) || []).length, 8);
  assert.match(SCENE_OUTLINE_GLSL, /texture2D\(tDepth, uv\)/);
  assert.match(SCENE_OUTLINE_GLSL, /texture2D\(tNormal, uv\)/);
  assert.match(SCENE_OUTLINE_GLSL, /normalDifference/);
  assert.match(SCENE_OUTLINE_GLSL, /depthDifference/);
  assert.doesNotMatch(SCENE_OUTLINE_GLSL, /tScene|luminance|paintedBand/);
});

test('contour controls preserve Forge pigment and tune pixels, strength, and sensitivity', () => {
  const uniforms = createSceneOutlineUniforms();
  const settings = normalizeVisualSettings(null);
  applySceneOutlineSettings(uniforms, settings, 1.35);
  assert.equal(uniforms.uInkColor.value.getHexString(), KEY_ART.outline.ink.slice(1));
  assert.equal(uniforms.uWidth.value, KEY_ART.outline.radius * 1.35);
  assert.equal(uniforms.uNormalThreshold.value, KEY_ART.outline.normalThreshold);
  assert.equal(uniforms.uDepthThreshold.value, KEY_ART.outline.depthThreshold);
  assert.equal(uniforms.uInk.value, KEY_ART.outline.opacity * .7);

  applySceneOutlineSettings(uniforms,
    normalizeVisualSettings({ ...settings, outlineWidth: 4, outlineStrength: 100,
      outlineSensitivity: 100 }), 1.35);
  assert.equal(uniforms.uWidth.value, KEY_ART.outline.radius * 1.35 * 4);
  assert.equal(uniforms.uInk.value, KEY_ART.outline.opacity);
  assert.ok(uniforms.uNormalThreshold.value < KEY_ART.outline.normalThreshold);
  assert.ok(uniforms.uDepthThreshold.value < KEY_ART.outline.depthThreshold);

  applySceneOutlineSettings(uniforms,
    normalizeVisualSettings({ ...settings, outlineSensitivity: 0 }), 1);
  assert.ok(uniforms.uNormalThreshold.value > KEY_ART.outline.normalThreshold);
  applySceneOutlineSettings(uniforms,
    normalizeVisualSettings({ ...settings, outlineEnabled: false }), 1);
  assert.equal(uniforms.uInk.value, 0);
});

test('outline uses its own GPU pass without allocating key or room hulls', () => {
  const painter = readFileSync(new URL('../dist/js/painted-renderer.js', import.meta.url), 'utf8');
  const shader = readFileSync(new URL('../dist/js/painted-shader.js', import.meta.url), 'utf8');
  const world = readFileSync(new URL('../dist/js/world.js', import.meta.url), 'utf8');
  const page = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
  assert.match(shader, /\$\{SCENE_OUTLINE_GLSL\}/);
  assert.match(painter, /applySceneOutlineSettings\(stages\.outline\.uniforms, next, renderer\.getPixelRatio\(\)\)/);
  assert.match(painter, /if \(name === 'outline'\) renderNormals\(\)/);
  assert.match(painter, /createToonShader, createOutlineShader/);
  assert.match(world, /createPaintedRenderer\(renderer, scene, camera, visualSettings\)/);
  assert.match(world, /painted\.setSettings\(settings\)/);
  assert.doesNotMatch(world, /inkOutlines|createInkOutlines/);
  assert.match(page, /id="outlineSensitivity" type="range"/);
});
