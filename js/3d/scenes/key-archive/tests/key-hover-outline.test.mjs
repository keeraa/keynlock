import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.js';
import { readFileSync } from 'node:fs';
import { createKeyHoverOutline } from '../dist/js/key-hover-outline.js';

test('hover outline renders an exact key silhouette mask and a continuous 2.5px ring', () => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(.4, 1, .05));
  const calls = [];
  let target = null;
  const renderer = {
    autoClear: true,
    getDrawingBufferSize: size => size.set(640, 360),
    getRenderTarget: () => target,
    setRenderTarget(value) { target = value; },
    render(scene) { calls.push(scene); },
  };
  const hover = createKeyHoverOutline(renderer, new THREE.Camera(), mesh);
  hover.render(0);
  assert.equal(calls.length, 0);
  mesh.visible = true;
  hover.render(.65);
  assert.equal(calls.length, 2);
  assert.equal(hover.getPassCount(), 2);
  assert.equal(renderer.autoClear, true);
  assert.equal(renderer.getRenderTarget(), null);
  const maskScene = calls[0];
  assert.equal(maskScene.children[0], mesh);
  const shader = calls[1].children[0].material;
  assert.equal(shader.uniforms.uWidth.value, 2.5);
  assert.equal(shader.uniforms.uOpacity.value, .65);
  assert.match(shader.fragmentShader, /nearby \* \(1\.0 - center\)/);
  assert.match(shader.fragmentShader, /for \(int i = 0; i < 8; i\+\+\)/);
  hover.dispose();
  mesh.geometry.dispose();
});

test('old normal-expanded silhouette rendering is fully removed', () => {
  const world = readFileSync(new URL('../dist/js/world.js', import.meta.url), 'utf8');
  assert.match(world, /createKeyHoverOutline\(renderer, camera, keyOutline\)/);
  assert.match(world, /createKeyHoverOutline\(renderer, camera, objectMask\)/);
  assert.match(world, /objectOutline\.render\(objectHoverOpacity\)/);
  assert.match(world, /objectHoverOpacity \+= \(objectHoverTarget - objectHoverOpacity\)/);
  assert.doesNotMatch(world, /createKeyHoverMaterial|hoverOpacity\.value/);
});

test('cabinet and workstation hover use continuous mask outlines instead of geometry shells', () => {
  const cabinets = readFileSync(new URL('../dist/js/world-cabinet.js', import.meta.url), 'utf8');
  const stations = readFileSync(new URL('../dist/js/wash-forge-stations.js', import.meta.url), 'utf8');
  assert.doesNotMatch(cabinets, /border\.visible|setHovered\(/);
  assert.doesNotMatch(stations, /addHoverRim|hoverFixtures/);
  assert.match(stations, /getHoverCollider/);
  assert.doesNotMatch(stations, /СТАНЦИЯ ·/);
});

test('cabinet hover restores a front-face outline and highlights its aimed cell', () => {
  const world = readFileSync(new URL('../dist/js/world.js', import.meta.url), 'utf8');
  const canvas = readFileSync(new URL('../dist/js/fallback-canvas-renderer.js', import.meta.url), 'utf8');
  assert.match(world, /target\?\.kind === 'cabinet' \|\| target\?\.kind === 'bath'/);
  assert.match(world, /cabinetMaskGeometry/);
  assert.match(world, /pegForSlot\(target\.slot\)/);
  assert.match(world, /makeTranslation\(0, 2\.78, \.78\)/);
  assert.match(world, /makeTranslation\(peg\.x, peg\.y, CABINET_CELL_BACK_Z\)/);
  assert.doesNotMatch(canvas, /CABINET_OUTLINE/);
  assert.match(canvas, /hovered\?\.kind === 'cabinet'/);
  assert.match(canvas, /\[faceX, peg\.y - halfH, cellZ - halfW\]/);
  assert.match(canvas, /getKeyFallbackHeadPoints\(type\)/);
});
