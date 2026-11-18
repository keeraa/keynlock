import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from '../dist/vendor/three.js';
import { createInkOutlines } from '../dist/js/ink-outlines.js';
import { normalizeVisualSettings } from '../dist/js/visual-settings.js';

test('Village Engine ink contours use a screen-space shader and follow visual controls', () => {
  const scene = new THREE.Scene();
  const wood = new THREE.Mesh(new THREE.BoxGeometry(2, 3, .5),
    new THREE.MeshStandardMaterial({ color: 0xa08160 }));
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: .5 }));
  scene.add(wood, glass);
  const on = normalizeVisualSettings({ outlineEnabled: true, outlineWidth: 1, outlineStrength: 70 });
  const outlines = createInkOutlines(scene, on);
  outlines.register(wood);
  outlines.register(glass);
  assert.equal(wood.children.length, 1);
  assert.equal(glass.children.length, 0);
  const shell = wood.children[0];
  assert.notEqual(shell.geometry, wood.geometry);
  assert.ok(shell.material.isShaderMaterial);
  assert.match(shell.material.vertexShader, /projected\.xy\s*\+=\s*screenNormal/);
  assert.match(shell.material.vertexShader, /normalMatrix/);
  assert.equal(shell.material.side, THREE.BackSide);
  assert.equal(shell.material.uniforms.inkOpacity.value, .7);
  assert.equal(shell.visible, true);
  const originalWidth = shell.material.uniforms.strokeScale.value;
  outlines.setSettings({ ...on, outlineWidth: 4, outlineStrength: 100 });
  assert.ok(shell.material.uniforms.strokeScale.value > originalWidth);
  assert.equal(shell.material.uniforms.inkOpacity.value, 1);
  outlines.setSettings({ ...on, outlineEnabled: false });
  assert.equal(shell.visible, false);
  outlines.setSettings(on);
  assert.equal(shell.visible, true);
  outlines.dispose();
  assert.equal(wood.children.length, 0);
});

test('instanced ink contours reuse key matrices and follow cabinet counts', () => {
  const scene = new THREE.Scene();
  const key = new THREE.InstancedMesh(new THREE.BoxGeometry(.4, .6, .07),
    new THREE.MeshStandardMaterial({ color: 0xc8ad78 }), 10);
  scene.add(key);
  const outlines = createInkOutlines(scene, normalizeVisualSettings(null));
  outlines.register(key);
  const shell = scene.children.find(mesh => mesh.userData.inkOutlineShell);
  assert.ok(shell.isInstancedMesh);
  assert.notEqual(shell, key);
  assert.ok(shell.material.isShaderMaterial);
  assert.equal(shell.instanceMatrix, key.instanceMatrix);
  key.count = 3;
  outlines.update();
  assert.equal(shell.count, 3);
  outlines.unregister(key);
  assert.ok(!scene.children.includes(shell));
  outlines.dispose();
});

test('contour cleanup detaches dynamic key shells without leaving geometry children', () => {
  const scene = new THREE.Scene();
  const group = new THREE.Group();
  group.add(new THREE.Mesh(new THREE.BoxGeometry(.5, .3, .04),
    new THREE.MeshStandardMaterial({ color: 0xc8ad78 })));
  scene.add(group);
  const outlines = createInkOutlines(scene, normalizeVisualSettings(null));
  outlines.register(group);
  assert.ok(group.children.some(mesh => mesh.userData.inkOutlineShell));
  outlines.unregister(group);
  assert.ok(!group.children.some(mesh => mesh.userData.inkOutlineShell));
  outlines.register(group);
  assert.ok(group.children.some(mesh => mesh.userData.inkOutlineShell));
  outlines.dispose();
  assert.ok(!group.children.some(mesh => mesh.userData.inkOutlineShell));
});
