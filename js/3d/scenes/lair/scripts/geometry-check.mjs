import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import * as THREE from 'three';
import { createMaterials } from '../src/room/materials.js';
import { buildLair } from '../src/room/build.js';
import { createRoomOutlines } from '../src/ui/visual-settings.js';
import { windowLightAt, FLOOR_Y, WINDOW_LIGHT_SLOPE } from '../src/room/window-light.js';
import { WINDOW_OPENING } from '../src/room/window.js';

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
const { materials, visual } = createMaterials();
const world = buildLair(scene, materials);
assert.equal(scene.getObjectByName('atelier-side-wall')?.material, materials.atelierSideWall,
  'the Atelier wall uses a gouache-mapped material while the source wallpaper loads');
assert.equal(scene.getObjectByName('restoration-easel-reference'),undefined,
  'the room never builds its own easels: the real Atelier owns them');
assert.ok(world.anchors.atelier,'the atelier interaction target is retained');
scene.updateMatrixWorld(true);
const unique = name => {
  const found = scene.getObjectByName(name);
  assert.ok(found, `${name} is present`);
  return found;
};
const bounds = name => new THREE.Box3().setFromObject(unique(name));
const ceilingRibs = [];
scene.traverse(object => {
  if (object.name.startsWith('lair-ceiling-beam-')) ceilingRibs.push(object);
});
assert.ok(ceilingRibs.length >= 8, 'the long room retains its complete timber ceiling');
assert.ok(ceilingRibs.every(beam => !beam.castShadow),
  'the roof ribs do not project long diagonal stripes onto the gallery and floor');
assert.equal(unique('atelier-side-wall').castShadow, false,
  'structural wall facing does not cast shadows across the room');
assert.ok(unique('planning-main-table').children.some(child => child.castShadow),
  'furniture retains its local contact shadows');
const restWall = bounds('atelier-side-wall');
const alchemyWall = bounds('alchemy-right-wall');
const portalRay = (x,z,direction,object) => new THREE.Raycaster(
  new THREE.Vector3(x,2.8,z),new THREE.Vector3(direction,0,0)).intersectObject(object).length;
assert.ok(portalRay(0,12.1,-1,unique('atelier-side-wall'))>0,'atelier side is once again one uninterrupted wall');
assert.ok(portalRay(0,10.1,1,unique('alchemy-right-wall'))>0,'alchemy side remains solid without a doorway');
assert.ok(portalRay(0,20.07,1,unique('alchemy-right-wall'))>0,'workbench side remains solid without a doorway');
assert.equal(scene.getObjectByName('lair-left-portal-masonry'),undefined,'no invented left door frame');
assert.equal(scene.getObjectByName('lair-right-portal-masonry'),undefined,'no invented right door frame');
const archedWindow = bounds('main-arched-window');
const workbench = bounds('workbench-right-of-alchemy');

assert.ok(restWall.max.y > 13.4, 'left wall reaches the double-height ceiling');
assert.ok(restWall.max.x < -8.3, 'ochre plaster lies on left wall');
assert.ok(restWall.max.z - restWall.min.z > 31.9, 'restoration gallery wing spans original 30m wall');
assert.ok(alchemyWall.max.z - alchemyWall.min.z > 31.9, 'opposite work wing grows symmetrically');
assert.ok(Math.abs((restWall.max.z-restWall.min.z)-(alchemyWall.max.z-alchemyWall.min.z))<.1,
  'left and right wing have matching depth');
assert.ok(alchemyWall.min.x > 8.25 && alchemyWall.max.x < 8.45, 'sage tiles lie against right wall');
assert.ok(alchemyWall.max.y > 13.4 && alchemyWall.min.y < .1, 'tiles cover the entire wall height');
assert.ok(alchemyWall.min.z < -5.6 && alchemyWall.max.z > 7.1, 'tiles cover the entire wall width');
assert.equal(scene.getObjectByName('alchemy-facing-wall-table'),undefined,
  'the legacy imitated laboratory is absent: the original module owns every bottle and table');
assert.ok(world.anchors.alchemy,'the original laboratory still has a navigation hotspot');
assert.ok(archedWindow.max.x - archedWindow.min.x > 8.20, 'new window is twice as wide');
assert.ok(archedWindow.max.y - archedWindow.min.y > 7.20, 'new window is twice as tall');
assert.ok(unique('main-arched-window-frame').geometry.type === 'TubeGeometry', 'arched frame follows the curved upper edge');
assert.ok(unique('main-arched-window-glass').geometry.type === 'ShapeGeometry', 'glass fits inside the arch');
assert.equal(unique('main-arched-window-glass').material.transparent, true, 'the exterior is visible through the glazing');
assert.equal(unique('main-arched-window-sill').geometry.userData.paintedWoodUV, true, 'wood uses physical-scale UV mapping');
const curtainPole = unique('curtain-pole-full-width');
assert.ok(new THREE.Box3().setFromObject(curtainPole).max.x - new THREE.Box3().setFromObject(curtainPole).min.x > 8.2, 'curtain pole spans the window');
assert.equal(unique('main-arched-window').children.filter(child => child.geometry?.type === 'SphereGeometry').length, 0, 'window-edge ball finials removed');
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
  assert.ok(Math.abs(positions.getZ(0) - topBefore) < .00001, 'the upper seam remains fixed');
  assert.ok(hemBefore.some((value, i) => Math.abs(positions.getZ(positions.count - 29 + i) - value) > .01), 'wind moves the free hem');
}
assert.ok(workbench.min.z > 15, 'workbench stays beyond the original alchemy workshop');
assert.ok(workbench.max.x < alchemyWall.min.x, 'workbench does not enter the tile wall');
assert.ok(unique('workbench-tool-wall').position.z > 3.5, 'tool wall moved with the workbench');
assert.equal(Object.keys(world.anchors).length, 5, 'all five hotspots retained');
const wallpaper = unique('alchemy-right-wall');
assert.equal(wallpaper.material, materials.alchemyTile, 'green tile remains the default right-wall finish');
assert.equal(world.setRightWallpaper('botanical'), true);
assert.equal(wallpaper.material, materials.wallpaperBotanical, 'botanical wallpaper option changes the actual 3D material');
assert.equal(world.setRightWallpaper('damask'), true);
assert.equal(wallpaper.material, materials.wallpaperDamask, 'dark wallpaper option is available');
assert.equal(world.setRightWallpaper('unknown'), false);
assert.equal(world.setRightWallpaper('tile'), true);
const paintedScale = materials.walnut.map.repeat.x;
visual.setPaintSettings({ saturation: 140, contrast: 120, scale: 170 });
assert.ok(materials.walnut.map.repeat.x < paintedScale, 'texture scale control affects Three.js UV repeat');
visual.setPaintSettings();
const brassRoughness = materials.brass.roughness;
visual.setMetalSettings({ roughness: 12, metalness: 88, palette: 'silver' });
assert.ok(materials.brass.roughness < brassRoughness, 'metal polish setting changes physical roughness');
assert.equal(materials.brass.color.getHexString(), 'b1b5b3', 'metal palette changes the metal finish');
visual.setMetalSettings();
const motes = unique('ambient-dust-engine');
assert.ok(motes.isPoints && motes.material.isShaderMaterial, 'ambient particles use one shader-driven Points cloud');
const dustBefore = motes.geometry.getAttribute('position').getX(0);
world.ambientParticles.update(3.8);
assert.ok(Math.abs(dustBefore - motes.geometry.getAttribute('position').getX(0)) > .001, 'wind drifts floating particles');
world.ambientParticles.setDensity(.25);
assert.equal(motes.geometry.drawRange.count, 105, 'particle density changes draw range');
world.ambientParticles.setEnabled(false);
assert.equal(motes.visible, false, 'air particles are switchable');
world.ambientParticles.setEnabled(true);
const outlines = createRoomOutlines(scene);
assert.ok(outlines.shells.length >= 4, 'shared Village Engine outlines attach to the room\'s own furniture');
const paintShader = { uniforms: {}, fragmentShader: THREE.ShaderLib.standard.fragmentShader };
materials.walnut.onBeforeCompile(paintShader);
assert.ok(paintShader.fragmentShader.includes('pigmentGray') && paintShader.uniforms.uPigmentContrast, 'painted pigments are adjustable in a Three.js shader');
assert.ok(paintShader.fragmentShader.includes('inkFacing'), 'shared ink rim shading is installed');
outlines.setEnabled(false);
assert.ok(outlines.shells.every(shell => shell.visible === false), 'ink outline toggle works');
outlines.setEnabled(true);
outlines.setWidth(110);
assert.ok(outlines.shells.every(shell => shell.material.uniforms.strokeScale.value === 1.1), 'outline width is adjustable');

for (const name of ['wood-gouache-walnut.webp', 'wood-gouache-ash.webp', 'wood-gouache-oak.webp']) {
  assert.ok(existsSync(new URL(`../../../workshops/alchemy/src/assets/${name}`, import.meta.url)), `${name} available`);
}
// Window light: one function places the beams, the floor patch and the lit dust.
assert.ok(unique('window-light-air').visible && unique('window-light-floor').visible, 'window light is on by default');
// A ray through the middle of the lower pane: between the sill and the first transom.
const landing = WINDOW_OPENING.wallZ + ((WINDOW_OPENING.sill + WINDOW_OPENING.transomHeights[0]) / 2 - FLOOR_Y) / WINDOW_LIGHT_SLOPE.y;
const sideways = WINDOW_OPENING.centerX + 1.0 - (landing - WINDOW_OPENING.wallZ) * WINDOW_LIGHT_SLOPE.x;
assert.ok(windowLightAt(sideways, FLOOR_Y, landing) > .8, 'sunlight lands on the floor inside the room');
assert.equal(windowLightAt(sideways, FLOOR_Y, WINDOW_OPENING.wallZ - 1), 0, 'no light behind the window wall');
assert.equal(windowLightAt(WINDOW_OPENING.centerX + 7, FLOOR_Y, landing), 0, 'no light beside the window');
const underMullion = WINDOW_OPENING.centerX + WINDOW_OPENING.mullionOffsets[2] - (landing - WINDOW_OPENING.wallZ) * WINDOW_LIGHT_SLOPE.x;
assert.ok(windowLightAt(underMullion, FLOOR_Y, landing) < .6 * windowLightAt(sideways, FLOOR_Y, landing),
  'the window frame casts its shadow into the light');
world.windowLight.setStrength(0);
assert.equal(unique('window-light-air').visible, false, 'the window light can be switched off');
world.windowLight.setStrength(1);
// One tiled surface for the whole right wall, with the laboratory's tile size.
const tiles = materials.alchemyTile.map.image;
assert.ok(tiles.width >= 2048 && tiles.height >= 1024, 'the right wall tiles are sharp enough');

let objects = 0, triangles = 0;
scene.traverse(obj => {
  if (!obj.isMesh || !obj.geometry) return;
  objects++;
  const index = obj.geometry.getIndex();
  triangles += index ? index.count / 3 : obj.geometry.getAttribute('position').count / 3;
});
console.log(`Scene verified: ${objects} meshes, ${Math.round(triangles).toLocaleString('en-US')} triangles, 2 easels, 5 hotspots`);
