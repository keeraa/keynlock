import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import * as THREE from 'three';
import { createMaterials } from '../src/materials.js';
import { buildLair } from '../src/room.js';

// Exercise the scene graph without a GPU or browser canvas.
const noop = () => {};
globalThis.document = {
  createElement: () => ({
    width: 1, height: 1,
    getContext: () => new Proxy({}, {
      get: (_obj, key) => key === 'createLinearGradient' ? () => ({ addColorStop: noop }) : noop,
      set: () => true,
    }),
  }),
};
THREE.TextureLoader.prototype.load = () => new THREE.Texture();

const scene = new THREE.Scene();
const { materials } = createMaterials();
const world = buildLair(scene, materials);
scene.updateMatrixWorld(true);
const unique = name => {
  const found = scene.getObjectByName(name);
  assert.ok(found, `${name} is present`);
  return found;
};
const bounds = name => new THREE.Box3().setFromObject(unique(name));
const restWall = bounds('restoration-left-wall');
const alchemyWall = bounds('alchemy-right-wall');
const alchemyTable = bounds('alchemy-facing-wall-table');

assert.ok(restWall.max.y > 13.4, 'left wall reaches the double-height ceiling');
assert.ok(restWall.max.x < -8.3, 'ochre plaster lies on left wall');
assert.ok(alchemyWall.min.x > 8.25 && alchemyWall.max.x < 8.45, 'sage tiles lie against right wall');
assert.ok(alchemyWall.max.y > 13.4 && alchemyWall.min.y < .1, 'tiles cover the entire wall height');
assert.ok(alchemyWall.min.z < -5.6 && alchemyWall.max.z > 7.1, 'tiles cover the entire wall width');
assert.ok(alchemyTable.max.x < alchemyWall.min.x, 'alchemy tabletop sits in front of tile wall');
assert.ok(alchemyTable.max.x > 8.0, 'alchemy tabletop is close to tile wall');
assert.ok(alchemyTable.min.x > 5.7, 'alchemy tabletop does not cross the room');
assert.ok(unique('restoration-easel-reference').position.x < -6.0);
assert.ok(unique('restoration-easel-work').position.x < -6.0);
const reference = unique('restoration-easel-reference');
const work = unique('restoration-easel-work');
assert.equal(reference.position.x, work.position.x, 'paintings align at the same wall depth');
assert.ok(reference.position.z > work.position.z, 'reference appears to the left of the restoration');
assert.equal(reference.rotation.y, Math.PI / 2, 'the reference faces the restoration camera');
assert.equal(work.rotation.y, reference.rotation.y, 'both paintings face the same direction');
assert.ok(unique('restoration-weathered-patina'), 'the right painting is visibly aged');
assert.ok(unique('restoration-caption-reference').position.y > 3.4, 'reference caption sits above the easel');
assert.ok(unique('restoration-caption-work').position.y > 3.4, 'work caption sits above the easel');
assert.equal(Object.keys(world.anchors).length, 5, 'all five hotspots retained');

for (const name of ['sardanapalus.jpg', 'starry-night.jpg', 'wood-gouache-walnut.webp', 'wood-gouache-ash.webp', 'wood-gouache-oak.webp']) {
  assert.ok(existsSync(new URL(`../public/assets/${name}`, import.meta.url)), `${name} available`);
}
for (const metal of ['aurum', 'argentum', 'ferrum', 'cuprum', 'stannum', 'plumbum', 'hydrargyrum']) {
  assert.ok(existsSync(new URL(`../public/assets/label-${metal}.png`, import.meta.url)), `${metal} label available`);
}
let objects = 0, triangles = 0;
scene.traverse(obj => {
  if (!obj.isMesh || !obj.geometry) return;
  objects++;
  const index = obj.geometry.getIndex();
  triangles += index ? index.count / 3 : obj.geometry.getAttribute('position').count / 3;
});
console.log(`Scene verified: ${objects} meshes, ${Math.round(triangles).toLocaleString('en-US')} triangles, 2 easels, 5 hotspots`);
