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
const archedWindow = bounds('main-arched-window');
const workbench = bounds('workbench-right-of-alchemy');

assert.ok(restWall.max.y > 13.4, 'left wall reaches the double-height ceiling');
assert.ok(restWall.max.x < -8.3, 'ochre plaster lies on left wall');
assert.ok(alchemyWall.min.x > 8.25 && alchemyWall.max.x < 8.45, 'sage tiles lie against right wall');
assert.ok(alchemyWall.max.y > 13.4 && alchemyWall.min.y < .1, 'tiles cover the entire wall height');
assert.ok(alchemyWall.min.z < -5.6 && alchemyWall.max.z > 7.1, 'tiles cover the entire wall width');
assert.ok(alchemyTable.max.x < alchemyWall.min.x, 'alchemy tabletop sits in front of tile wall');
assert.ok(alchemyTable.max.x > 8.0, 'alchemy tabletop is close to tile wall');
assert.ok(alchemyTable.min.x > 5.7, 'alchemy tabletop does not cross the room');
assert.ok(archedWindow.max.x - archedWindow.min.x > 8.20, 'new window is twice as wide');
assert.ok(archedWindow.max.y - archedWindow.min.y > 7.20, 'new window is twice as tall');
assert.ok(unique('main-arched-window-frame').geometry.type === 'TubeGeometry', 'arched frame follows the curved upper edge');
assert.ok(unique('main-arched-window-glass').geometry.type === 'ShapeGeometry', 'glass fits inside the arch');
assert.equal(unique('main-arched-window-glass').material.transparent, true, 'the exterior is visible through the glazing');
assert.equal(unique('main-arched-window-sill').geometry.userData.paintedWoodUV, true, 'wood uses physical-scale UV mapping');
const wall = unique('back-wall-arched-cutout');
assert.equal(wall.geometry.type, 'ExtrudeGeometry', 'the masonry has a dimensional arched reveal');
const openingRay = new THREE.Raycaster(new THREE.Vector3(0, 5.6, 0), new THREE.Vector3(0, 0, -1));
assert.equal(openingRay.intersectObject(wall).length, 0, 'the window opening is actually open');
const masonryRay = new THREE.Raycaster(new THREE.Vector3(6, 5.6, 0), new THREE.Vector3(0, 0, -1));
assert.ok(masonryRay.intersectObject(wall).length > 0, 'the plaster remains solid beside the window');
const roomWindow = unique('main-arched-window');
assert.ok(roomWindow.position.z < -5.55, 'the window frame is recessed into the masonry');
const distant = unique('city-distant-panorama');
const middle = unique('city-middle-rooftops');
const near = unique('city-near-canalside');
assert.ok(distant.position.z < middle.position.z && middle.position.z < near.position.z, 'three exterior depth planes create real orbit parallax');
assert.ok(near.position.z < roomWindow.position.z - 2, 'nearest buildings remain outside the room');
const hangingCloths = [];
for (const side of ['left', 'right']) {
  const curtain = unique(`window-curtain-${side}`);
  assert.ok(curtain.geometry.getAttribute('position').count > 1200, 'linen is a subdivided cloth mesh');
  assert.ok(curtain.material.isMeshPhysicalMaterial && curtain.material.sheen > 0, 'linen reacts to physical lighting');
  assert.equal(curtain.userData.windAnimated, true, 'curtain is registered for wind animation');
  const positions = curtain.geometry.getAttribute('position');
  const topBefore = positions.getZ(0);
  const hemBefore = Array.from({ length: 29 }, (_, i) => positions.getZ(positions.count - 29 + i));
  hangingCloths.push({ positions, topBefore, hemBefore });
}
world.animated.forEach(update => update(2.9));
for (const { positions, topBefore, hemBefore } of hangingCloths) {
  assert.equal(positions.getZ(0), topBefore, 'the upper seam remains fixed');
  assert.ok(hemBefore.some((value, i) => Math.abs(positions.getZ(positions.count - 29 + i) - value) > .01), 'wind moves the free hem');
}
assert.ok(workbench.min.z > alchemyTable.max.z + 1.0, 'workbench is separated to the right of alchemy');
assert.ok(workbench.max.x < alchemyWall.min.x, 'workbench does not enter the tile wall');
assert.ok(unique('workbench-tool-wall').position.z > 3.5, 'tool wall moved with the workbench');
assert.ok(unique('restoration-easel-reference').position.x < -7.0);
assert.ok(unique('restoration-easel-work').position.x < -7.0);
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
