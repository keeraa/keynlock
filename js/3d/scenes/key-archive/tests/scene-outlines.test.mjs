import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { KEY_ART } from '../dist/js/key-art.js';
import {
  SCENE_OUTLINE_GLSL, createSceneOutlineUniforms, applySceneOutlineSettings,
} from '../dist/js/scene-outline.js';
import { normalizeVisualSettings } from '../dist/js/visual-settings.js';
import { worldSource } from './helpers/world-source.mjs';

test('Key Forge eight-direction silhouette and crease shader is shared by the full scene', () => {
  assert.equal((SCENE_OUTLINE_GLSL.match(/edgeAt\(vec2\(/g) || []).length, 8);
  assert.match(SCENE_OUTLINE_GLSL, /texture2D\(tDepth, uv\)/);
  assert.match(SCENE_OUTLINE_GLSL, /texture2D\(tNormal, uv\)/);
  assert.match(SCENE_OUTLINE_GLSL, /normalDifference/);
  assert.match(SCENE_OUTLINE_GLSL, /depthDifference/);
  assert.match(SCENE_OUTLINE_GLSL, /smoothstep\(3.0, 12.0, distance\)/);
  assert.doesNotMatch(SCENE_OUTLINE_GLSL, /tScene|luminance|paintedBand/);
});

test('contour controls preserve Forge pigment and fix width and tune strength and sensitivity', () => {
  const uniforms = createSceneOutlineUniforms();
  const settings = normalizeVisualSettings(null);
  applySceneOutlineSettings(uniforms, { ...settings, outlineSensitivity: 50 }, 1.35);
  assert.equal(uniforms.uInkColor.value.getHexString(), KEY_ART.outline.ink.slice(1));
  assert.equal(uniforms.uWidth.value, KEY_ART.outline.radius * 1.35);
  assert.equal(uniforms.uNormalThreshold.value, KEY_ART.outline.normalThreshold);
  assert.equal(uniforms.uDepthThreshold.value, KEY_ART.outline.depthThreshold);
  assert.equal(uniforms.uInk.value, KEY_ART.outline.opacity);

  applySceneOutlineSettings(uniforms,
    normalizeVisualSettings({ ...settings, outlineWidth: 4, outlineStrength: 100,
      outlineSensitivity: 100 }), 1.35);
  assert.equal(uniforms.uWidth.value, KEY_ART.outline.radius * 1.35);
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
  const world = worldSource();
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

test('giant cabinet keys receive a local ink edge while sharing global contour controls', () => {
  const cabinets = readFileSync(new URL('../dist/js/world-cabinet.js', import.meta.url), 'utf8');
  const world = worldSource();
  const painter = readFileSync(new URL('../dist/js/painted-renderer.js', import.meta.url), 'utf8');
  assert.match(cabinets, /color: KEY_ART\.outline\.ink/);
  assert.match(cabinets, /crownContour\.visible = Boolean\(settings\.outlineEnabled\)/);
  assert.match(world, /cabinets\.forEach\(cabinet => cabinet\.setContour\(visualSettings\)\)/);
  assert.match(world, /cabinets\.forEach\(cabinet => cabinet\.setContour\(settings\)\)/);
  assert.match(painter, /object\.isPoints \|\| object\.isLine \|\| object\.isSprite/);
});

test('ink stays on both sides of a fold, so lines do not break into dashes', () => {
  const outline = readFileSync(new URL('../dist/js/scene-outline.js', import.meta.url), 'utf8');
  assert.match(outline, /float decisive = smoothstep/);
  assert.match(outline, /float outside = mix\(1\.0, farther, decisive\)/);
});

test('shadow hatching patches lit materials once and toggles without recompiling', async () => {
  const THREE = await import('../dist/vendor/three.js');
  const { patchShadowHatch, patchSceneShadowHatch, setShadowHatch, shadowHatchEnabled } =
    await import('../dist/js/shadow-hatch.js');
  const metal = new THREE.MeshStandardMaterial();
  const keyKey = metal.customProgramCacheKey();
  assert.equal(patchShadowHatch(metal), true);
  assert.equal(patchShadowHatch(metal), false, 'a material is patched only once');
  assert.equal(patchShadowHatch(new THREE.MeshBasicMaterial()), false, 'unlit materials have no shadow');
  assert.notEqual(metal.customProgramCacheKey(), keyKey);
  const shader = { uniforms: {},
    vertexShader: '#include <common>\n#include <beginnormal_vertex>\n#include <project_vertex>',
    fragmentShader: '#include <common>\n#include <opaque_fragment>' };
  metal.onBeforeCompile(shader);
  assert.match(shader.vertexShader, /vHatchWorld = \(modelMatrix \* hatchPoint\)\.xyz/);
  assert.match(shader.fragmentShader, /float received = dot\(outgoingLight/);
  const clone = metal.clone();
  patchShadowHatch(clone);
  clone.onBeforeCompile = (inner => function (s2, r) { metal.onBeforeCompile(s2, r); inner.call(this, s2, r); })(clone.onBeforeCompile);
  const twice = { uniforms: {}, vertexShader: '#include <common>\n#include <project_vertex>',
    fragmentShader: '#include <common>\n#include <opaque_fragment>' };
  clone.onBeforeCompile(twice);
  assert.equal(twice.fragmentShader.split('uniform float uShadowHatch;').length, 2, 'hatching is injected once');
  assert.equal(twice.vertexShader.split('varying vec3 vHatchWorld;').length, 2);
  setShadowHatch(true);
  assert.equal(shader.uniforms.uShadowHatch.value, 1);
  assert.equal(shadowHatchEnabled(), true);
  setShadowHatch(false);
  assert.equal(shader.uniforms.uShadowHatch.value, 0);
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshLambertMaterial()));
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(), metal));
  assert.equal(patchSceneShadowHatch(scene), 1);
  const world = worldSource();
  assert.match(world, /setShadowHatch\(settings\.hatchShadows\)/);
});
