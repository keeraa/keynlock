import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import * as THREE from 'three';
import { createMaterials } from '../src/room/materials.js';
import { buildLair } from '../src/room/build.js';
import { createRoomOutlines } from '../src/ui/visual-settings.js';
import { windowLightAt, FLOOR_Y, WINDOW_LIGHT_SLOPE } from '../src/room/window-light.js';
import { WINDOW_OPENING } from '../src/room/window.js';
import { ALCHEMY_Z, ATELIER_Z, ROOM_END, ROOM_LENGTH, WORKBENCH_Z } from '../src/room/layout.js';

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
assert.equal(scene.getObjectByName('atelier-side-wall')?.material, materials.galleryPlaster,
  'the gallery wall uses its own sand-colored gouache plaster');
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
assert.equal(ceilingRibs.length, 6, 'six widely spaced ribs support the ceiling');
assert.ok(ceilingRibs.every(beam => beam.material === materials.roomTimber),
  'the ceiling ribs use the subdued architectural timber finish');
assert.ok(ceilingRibs.every(beam => !beam.castShadow),
  'the roof ribs do not project long diagonal stripes onto the gallery and floor');
const ceilingUnderside = bounds('lair-ceiling').min.y;
for (const beam of [...ceilingRibs, ...['left', 'right', 'back'].map(side => unique(`lair-wall-beam-${side}`))]) {
  assert.ok(new THREE.Box3().setFromObject(beam).max.y > ceilingUnderside, 'beams meet the ceiling without a gap');
}
const beamGrainOffsets = ceilingRibs.map(beam => {
  const uv = beam.geometry.getAttribute('uv');
  return `${uv.getX(0)},${uv.getY(0)}`;
});
assert.equal(new Set(beamGrainOffsets).size, ceilingRibs.length, 'each rib samples a different part of the timber');
const post = unique('lair-wall-post-1');
const postPositions = post.geometry.getAttribute('position');
const postUV = post.geometry.getAttribute('uv');
const postIndices = post.geometry.getIndex();
const front = post.geometry.groups[4];
const frontFace = Array.from({ length: front.count }, (_, i) => postIndices.getX(front.start + i));
const verticalGrain = frontFace.filter(i => postPositions.getX(i) < 0);
assert.ok(new Set(verticalGrain.map(i => postUV.getX(i))).size > 1,
  'wood grain follows the height of the wall posts');
assert.equal(unique('atelier-side-wall').castShadow, false,
  'structural wall facing does not cast shadows across the room');
for (const side of ['back-left', 'back-right', 'left', 'right']) {
  const panel = unique(`lair-wainscot-${side}-panel`);
  assert.equal(panel.material, materials.roomTimber);
  assert.equal(panel.position.y, unique('lair-wainscot-back-left-panel').position.y);
  assert.ok(bounds(`lair-wainscot-${side}-cap`).max.y > 1.5, 'lower wall trim reaches the raised height');
}
assert.ok(unique('planning-main-table').children.some(child => child.castShadow),
  'furniture retains its local contact shadows');
const restWall = bounds('atelier-side-wall');
const alchemyWall = bounds('alchemy-right-wall');
for (const name of ['planning-wall-board', 'planning-wall-shelf']) {
  assert.ok(bounds(name).min.z <= WINDOW_OPENING.wallZ, `${name} touches the finished wall`);
}
const planningRug = bounds('planning-rug');
assert.ok(Math.abs(planningRug.min.y - .0385) < .001, 'the rug lies flat on the floor');
for (const [name, surface, height] of [
  ['planning-desk-mat', planningRug.max.y, .92],
  ['planning-chair-seat', .0385, .5215],
  ['gramophone-tabletop', .0385, .88],
  ['workbench-tabletop', .0385, .94],
]) {
  assert.ok(Math.abs(bounds(name).max.y - surface - height) < .003, `${name} is at its intended height`);
}
for (const [name, surface] of [
  ['planning-main-table', planningRug.max.y],
  ['gramophone-table', .0385],
  ['workbench-right-of-alchemy', .0385],
]) {
  assert.ok(Math.abs(bounds(name).min.y - surface) < .003, `${name} meets its support`);
}
for (const foot of unique('planning-chair').children.filter(object => object.name === 'planning-chair-leg')) {
  const footBounds = new THREE.Box3().setFromObject(foot, true);
  const surface = foot.position.z < 0 ? planningRug.max.y : .0385;
  assert.ok(Math.abs(footBounds.min.y - surface) < .003, 'each chair foot reaches the rug or the floor');
}
assert.ok(bounds('workbench-tool-wall').max.x >= alchemyWall.min.x, 'the workbench board is mounted to the tiled wall');
scene.traverse(object => {
  if (object.name !== 'lair-sconce-backplate') return;
  const plate = new THREE.Box3().setFromObject(object);
  assert.ok(plate.min.x <= restWall.max.x || plate.max.x >= alchemyWall.min.x, 'the sconce backplate touches the wall');
  assert.ok(plate.min.z > restWall.min.z && plate.max.z < restWall.max.z, 'the sconce stays inside the room');
});
const portalRay = (x,z,direction,object) => new THREE.Raycaster(
  new THREE.Vector3(x,2.8,z),new THREE.Vector3(direction,0,0)).intersectObject(object).length;
assert.ok(portalRay(0,ATELIER_Z,-1,unique('atelier-side-wall'))>0,'atelier side is one uninterrupted wall');
assert.ok(portalRay(0,ALCHEMY_Z,1,unique('alchemy-right-wall'))>0,'alchemy side remains solid without a doorway');
assert.ok(portalRay(0,WORKBENCH_Z,1,unique('alchemy-right-wall'))>0,'workbench side remains solid without a doorway');
assert.equal(scene.getObjectByName('lair-left-portal-masonry'),undefined,'no invented left door frame');
assert.equal(scene.getObjectByName('lair-right-portal-masonry'),undefined,'no invented right door frame');
const archedWindow = bounds('main-arched-window');
const workbench = bounds('workbench-right-of-alchemy');

assert.ok(restWall.max.y > 13.4, 'left wall reaches the double-height ceiling');
assert.ok(restWall.max.x < -8.3, 'gallery plaster lies on the left wall');
assert.ok(Math.abs(restWall.max.z - restWall.min.z - (ROOM_LENGTH - .12)) < .001,
  'the gallery wall fits the shortened room');
for (const name of ['lair-floor-base', 'lair-ceiling']) {
  assert.ok(Math.abs(bounds(name).max.z - ROOM_END) < .001, `${name} reaches the new entrance`);
}
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
const sillBounds = bounds('main-arched-window-sill');
assert.ok(Math.abs(sillBounds.max.y - .0385 - 1.05) < .005, 'the sill reaches waist height');
assert.ok(sillBounds.max.z - sillBounds.min.z < .4, 'the shallow sill leaves space for the curtains');
const curtainPole = bounds('curtain-pole-full-width');
assert.ok(curtainPole.max.x - curtainPole.min.x > 9, 'curtain pole extends past the window on both sides');
for (const side of ['left', 'right']) {
  const bracket = bounds(`curtain-bracket-${side}`);
  assert.ok(bracket.min.z < WINDOW_OPENING.wallZ && bracket.intersectsBox(curtainPole), 'curtain bracket joins the pole to the wall');
  for (let i = 0; i <= 5; i++) {
    assert.ok(bounds(`curtain-ring-${side}-${i}`).intersectsBox(curtainPole), 'ring wraps the curtain pole');
  }
}
assert.equal(unique('main-arched-window').children.filter(child => child.geometry?.type === 'SphereGeometry').length, 0, 'window-edge ball finials removed');
const wall = unique('back-wall-arched-cutout');
assert.equal(wall.geometry.type, 'ExtrudeGeometry', 'the masonry has a dimensional arched reveal');
const openingRay = new THREE.Raycaster(new THREE.Vector3(0, 5.6, 0), new THREE.Vector3(0, 0, -1));
assert.equal(openingRay.intersectObject(wall).length, 0, 'the window opening is actually open');
const lowerPaneRay = new THREE.Raycaster(new THREE.Vector3(.65, 1.28, 0), new THREE.Vector3(0, 0, -1));
assert.equal(lowerPaneRay.intersectObjects([wall, unique('lair-wainscot')], true).length, 0,
  'masonry and timber trim leave the lowered window pane open');
const masonryRay = new THREE.Raycaster(new THREE.Vector3(6, 5.6, 0), new THREE.Vector3(0, 0, -1));
assert.ok(masonryRay.intersectObject(wall).length > 0, 'the plaster remains solid beside the window');
const roomWindow = unique('main-arched-window');
assert.ok(roomWindow.position.z < -5.55, 'the window frame is recessed into the masonry');
const distant = unique('city-distant-panorama');
const middle = unique('city-middle-rooftops');
const near = unique('city-near-canalside');
assert.ok(distant.position.z < middle.position.z && middle.position.z < near.position.z, 'three exterior depth planes create real orbit parallax');
assert.ok(near.position.z < roomWindow.position.z - 2, 'nearest buildings remain outside the room');
const canal = unique('city-canal-water');
assert.equal(canal.rotation.x, -Math.PI / 2, 'canal water is a horizontal world-space surface');
assert.ok(near.position.z - middle.position.z > 15, 'the banks have distinct depths for lateral camera moves');
assert.ok(middle.position.z - distant.position.z >= 30, 'the sky is farther behind the houses');

const hangingCloths = [];
for (const side of ['left', 'right']) {
  const curtain = unique(`window-curtain-${side}`);
  assert.equal(curtain.geometry.parameters.width, 1.92, 'each curtain is twice as wide');
  assert.ok(curtain.geometry.getAttribute('position').count > 1200, 'linen is a subdivided cloth mesh');
  assert.ok(curtain.material.isMeshPhysicalMaterial && curtain.material.sheen > 0, 'linen reacts to physical lighting');
  assert.equal(curtain.userData.windAnimated, true, 'curtain is registered for wind animation');
  const clothBounds = bounds(curtain.name);
  assert.ok(clothBounds.min.y > FLOOR_Y && clothBounds.min.y < FLOOR_Y + .055, 'hem reaches the floor without clipping');
  assert.ok(clothBounds.min.z > sillBounds.max.z, 'the curtains hang in front of the sill');
  const positions = curtain.geometry.getAttribute('position');
  const topBefore = positions.getZ(0);
  const hemCount = curtain.geometry.parameters.widthSegments + 1;
  const hemBefore = Array.from({ length: hemCount }, (_, i) => positions.getZ(positions.count - hemCount + i));
  hangingCloths.push({ positions, topBefore, hemBefore });
}
world.animated.forEach(update => update(2.9));
for (const { positions, topBefore, hemBefore } of hangingCloths) {
  assert.ok(Math.abs(positions.getZ(0) - topBefore) < .00001, 'the upper seam remains fixed');
  assert.ok(hemBefore.some((value, i) => Math.abs(positions.getZ(positions.count - hemBefore.length + i) - value) > .01), 'wind moves the free hem');
}
assert.ok(workbench.min.z > ALCHEMY_Z + 3 && workbench.max.z < ROOM_END,
  'workbench stays between the alchemy station and the new entrance');
assert.ok(workbench.max.x < alchemyWall.min.x, 'workbench does not enter the tile wall');
assert.equal(unique('workbench-tool-wall').position.z, WORKBENCH_Z, 'tool wall moved with the workbench');
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
const furnitureUniform = world.windowLight.shaderUniforms.uWindowFurnitureMap;
assert.equal(unique('window-light-floor').material.uniforms.uWindowFurnitureMap, furnitureUniform);
assert.equal(unique('window-light-air').material.uniforms.uWindowFurnitureMap, furnitureUniform);
assert.equal(unique('ambient-dust-engine').material.uniforms.uWindowFurnitureMap, furnitureUniform);
const { width, height, data } = furnitureUniform.value.image;
const apertureBottom = WINDOW_OPENING.sill - .16;
const apertureHeight = WINDOW_OPENING.crown + .12 - apertureBottom;
function windowDepthAt(point) {
  const distance = point.z - WINDOW_OPENING.wallZ;
  const offset = point.x + distance * WINDOW_LIGHT_SLOPE.x - WINDOW_OPENING.centerX;
  const rayHeight = point.y + distance * WINDOW_LIGHT_SLOPE.y;
  const x = Math.floor(width * (.5 + offset / (2.16 * WINDOW_OPENING.halfWidth)));
  const y = Math.floor(height * (rayHeight - apertureBottom) / apertureHeight);
  return data[y * width + x] * 26 / 255;
}
// The lowered gramophone stand is below the sill, but the horn still catches sunlight.
const deskMat = unique('planning-desk-mat');
const hornStem = unique('gramophone-horn-stem');
for (const [name, point] of [
  ['planning-main-table', deskMat.localToWorld(new THREE.Vector3(0, .03, 0))],
  ['gramophone-table', hornStem.localToWorld(new THREE.Vector3(0, .25, 0))],
]) {
  const distance = (point.y - FLOOR_Y) / WINDOW_LIGHT_SLOPE.y;
  const floorShadow = point.clone().add(new THREE.Vector3(-distance * WINDOW_LIGHT_SLOPE.x, FLOOR_Y - point.y, distance));
  assert.ok(windowLightAt(floorShadow.x, floorShadow.y, floorShadow.z) > .4, `${name} is in the window light`);
  const furnitureDepth = windowDepthAt(floorShadow);
  assert.ok(Math.abs(furnitureDepth - (point.z - WINDOW_OPENING.wallZ)) < 1.4, `${name} records a shadow at the furniture depth`);
  assert.ok(furnitureDepth + .1 < floorShadow.z - WINDOW_OPENING.wallZ, `${name} interrupts the ray before it meets the floor`);
}
world.windowLight.setStrength(0);
assert.equal(unique('window-light-air').visible, false, 'the window light can be switched off');
world.windowLight.setStrength(1);
// The bird only appears while it flies past; night swaps sun for moonlight.
assert.equal(unique('window-bird').visible, false, 'no bird between its flights');
const bird = unique('window-bird');
world.windowLight.update(6);
assert.equal(bird.visible, true);
world.windowLight.update(7.625);
const firstAltitude = bird.position.y;
assert.ok(Math.abs(bird.position.x - WINDOW_OPENING.centerX) < .0001, 'the first flight reaches the middle in 1.625 s');
const random = Math.random;
try {
  Math.random = () => .5; // 40-second pause before the return trip.
  world.windowLight.update(9.25);
} finally {
  Math.random = random;
}
assert.equal(bird.visible, false, 'one flight lasts 3.25 s');
world.windowLight.update(50.875);
assert.equal(bird.visible, true);
assert.equal(bird.scale.x, -1, 'the return flight reverses direction');
assert.ok(Math.abs(bird.position.y - firstAltitude) > .8, 'successive flights cross the window at visibly different heights');

const city = unique('city-distant-panorama').material;
const airTint = unique('window-light-air').material.uniforms.uAirTint.value;
const dayTint = airTint.getHex();
world.setNight(true);
assert.ok(airTint.b > airTint.r && city.color.getHex() !== 0xffffff, 'moonlight and a dark city at night');
world.setNight(false);
assert.equal(airTint.getHex(), dayTint);
assert.equal(city.color.getHex(), 0xffffff, 'day comes back exactly');
// Lamps: three chandeliers are the only real lamp lights, and they reach the
// floor; the sconces paint their light on the wall. Glows and patches are light.
const chandelierLights = [], pointLights = [], lampLight = [];
scene.traverse(object => {
  if (object.isPointLight) pointLights.push(object);
  if (object.name === 'lair-chandelier-light') chandelierLights.push(object);
  if (object.parent?.name === 'lair-wall-sconce' || object.parent?.name === 'lair-chandelier')
    if (object.material?.isShaderMaterial) lampLight.push(object);
});
assert.equal(chandelierLights.length, 3, 'three chandeliers');
assert.equal(scene.children.flatMap(c => c.children).filter(o => o.name === 'lair-wall-sconce').length, 8, 'eight wall sconces');
assert.ok(pointLights.length <= 6, `the room keeps few point lights, got ${pointLights.length}`);
for (const [index, light] of chandelierLights.entries()) {
  const height = light.getWorldPosition(new THREE.Vector3()).y;
  assert.ok(light.distance > height + 2, 'chandelier light reaches the floor');
  assert.equal(light.parent.position.z, unique(`lair-ceiling-beam-${index * 2 + 1}`).position.z,
    'the chandelier hangs from a ceiling beam');
}
assert.ok(lampLight.length >= 11 && lampLight.every(o => o.userData.atmosphere), 'lamp glows are never ink-outlined');
const dayLamp = chandelierLights[0].intensity;
world.setNight(1);
assert.ok(chandelierLights[0].intensity > 3 * dayLamp, 'at night the lamps are the main light');
world.setNight(.5);
assert.ok(chandelierLights[0].intensity > dayLamp && chandelierLights[0].intensity < 3 * dayLamp * 2, 'night comes in gradually');
world.setNight(0);
assert.equal(chandelierLights[0].intensity, dayLamp, 'day comes back exactly');
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
