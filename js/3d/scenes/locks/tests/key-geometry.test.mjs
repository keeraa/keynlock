import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../src/vendor/three-core.js';
import { createKeyGeometry } from '../src/js/geometry/key.js';

test('first key builds from cylinder-provided chamber positions before shared state exists', () => {
  const initialPositions = [-1.16, -.68, -.2, .28];
  let availablePositions = null;
  const parts = [];
  const module = createKeyGeometry({
    THREE,
    getPinXs: () => {
      if (!availablePositions) throw new Error('Main has not initialized pinXs');
      return availablePositions;
    },
    coreCenterY: -.43,
    coreCenterZ: -.05,
    addMesh: (parent, geometry, material, position = [0, 0, 0]) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(...position);
      parent.add(mesh);
      return mesh;
    },
    mat: { key: new THREE.MeshStandardMaterial({ color: 0xc9a979 }) },
    tag() {},
    rod() {},
    parts,
  });
  const parent = new THREE.Group();
  const { rig, blade } = module.makeKey(parent, initialPositions);
  assert.equal(parent.children.includes(rig), true);
  assert.equal(blade.geometry.type, 'ExtrudeGeometry');
  assert.ok(blade.geometry.attributes.position.count > 200);
  assert.equal(parts.length, 1);
  assert.equal(parts[0].obj, rig);
  assert.throws(() => module.makeKeyProfile(), /not initialized/);

  availablePositions = initialPositions;
  assert.equal(module.keySurfaceAt(-.2), .03);
  assert.ok(Math.abs(module.keySurfaceAt(-.2, true) - (-.09)) < 1e-9);
  assert.equal(module.keySurfaceAt(-3), null);
  const nextPositions = [-1.34, -1.04, -.74, -.44, -.14, .16, .46];
  availablePositions = nextPositions;
  const nextBlade = module.makeKeyProfile();
  assert.equal(nextBlade.type, 'ExtrudeGeometry');
  assert.ok(nextBlade.attributes.position.count > blade.geometry.attributes.position.count);
  nextBlade.dispose();
  blade.geometry.dispose();
});
