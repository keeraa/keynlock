import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.js';
import { getSceneGeometryStats } from '../dist/js/geometry-stats.js';

test('geometry HUD counts instanced meshes but ignores colliders and hidden meshes', () => {
  const scene = new THREE.Scene();
  scene.add(new THREE.InstancedMesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial(), 10));
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 })));
  const hidden = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
  hidden.visible = false;
  scene.add(hidden);
  assert.deepEqual(getSceneGeometryStats(scene), { polygons: 120, triangles: 120 });
});
