import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { mergeStaticMeshes } from '../../../core/rendering/merge-static.js';

test('static siblings with one material become one mesh; named, moving and see-through ones stay', () => {
  const root = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial(), glass = new THREE.MeshStandardMaterial({ transparent: true });
  const table = new THREE.Group(); table.name = 'planning-main-table'; root.add(table);
  for (let i = 0; i < 4; i++) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(.1, 1, .1), wood);
    leg.position.set(i, .5, 0); leg.castShadow = true; table.add(leg);
  }
  const top = new THREE.Mesh(new THREE.BoxGeometry(4, .1, 1), wood); top.name = 'planning-tabletop'; table.add(top);
  const vinyl = new THREE.Mesh(new THREE.CylinderGeometry(.3, .3, .02), wood); vinyl.userData.dynamic = true; table.add(vinyl);
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(), glass); table.add(pane);
  table.add(new THREE.Mesh(new THREE.PlaneGeometry(), glass));

  mergeStaticMeshes(root);
  const meshes = table.children.filter(child => child.isMesh);
  const merged = meshes.find(mesh => mesh.userData.mergedStatic);
  assert.equal(merged.userData.mergedStatic, 4);
  assert.equal(merged.castShadow, true);
  assert.equal(merged.material, wood);
  assert.ok(table.getObjectByName('planning-tabletop'));
  assert.ok(meshes.includes(vinyl) && meshes.includes(pane));
  assert.equal(meshes.length, 5, 'four legs became one; the rest stayed');
  const box = new THREE.Box3().setFromObject(merged);
  assert.ok(Math.abs(box.min.x + .05) < 1e-6 && Math.abs(box.max.x - 3.05) < 1e-6, 'each leg keeps its place');
});
