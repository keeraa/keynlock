import * as THREE from '../vendor/three.js';
import { CANDLE_WICK_Y } from './archive-candles.js';
import { ARCHIVE_DESK, ARCHIVE_SIDE_TABLES } from './archive-ledger.js';
import { floorSurfaceY, RUG_TOP } from './floor-contact.js';
import { BENCH } from './wash-forge-stations.js';
import { CHANDELIER_Z } from './world-lighting.js';

const furnitureScale = 1.3;
const candleTurn = Math.PI * (3 - Math.sqrt(5));
const candleDimensions = [
  { base: .00085, wick: .1327, x: -.0035, z: .0011 },
  { base: .002, wick: .2414, x: -.0026, z: .0006 },
];
const chandelierWicks = [
  [-.409, -.969, -.409], [-.577, -.917, 0], [-.405, -.917, .415], [-.002, -.943, .575],
  [.402, -.969, .408], [.578, -.917, .006], [.407, -.917, -.407], [-.001, -.943, -.569],
];
const tabletop = [
  ['Bottle_1', ARCHIVE_DESK, .60, -.68, .28, .89],
  ['Book_7', ARCHIVE_DESK, .52, .13, -.30, furnitureScale],
  ['BookGroup_Medium_1', ARCHIVE_SIDE_TABLES[1], -.29, -.18, Math.PI / 2, .92 * furnitureScale],
  ['BookGroup_Medium_2', ARCHIVE_SIDE_TABLES[1], .21, .23, Math.PI / 2, .92 * furnitureScale],
  ['BookGroup_Medium_3', ARCHIVE_SIDE_TABLES[2], .15, .20, -Math.PI / 2, .93 * furnitureScale],
];

function shadows(model) {
  model.traverse(part => {
    if (!part.isMesh) return;
    part.castShadow = !part.material.transparent;
    part.receiveShadow = true;
  });
}

function placeOn(model, x, y, z, yaw, scale) {
  model.rotation.y = yaw;
  model.scale.setScalar(scale);
  model.position.set(x, y, z);
  const bounds = new THREE.Box3().setFromObject(model, true);
  model.position.y += y - bounds.min.y;
}

function fitCandle(model, variant, baseY, width, yaw) {
  const { base, wick, x, z } = candleDimensions[variant];
  const h = (CANDLE_WICK_Y - baseY) / (wick - base);
  model.scale.set(width, h, width);
  model.rotation.y = yaw;
  // Rotate the wick offset too so the flame stays centered on it.
  const c = Math.cos(yaw), s = Math.sin(yaw);
  model.position.set(-(x * c + z * s) * width, baseY - base * h, (x * s - z * c) * width);
}

function replaceCandles(scene, candles, source, holder, onPlaced) {
  for (let variant = 0; variant < source.length; variant++) {
    const wall = candles.filter(candle => candle.type !== null && candle.variant === variant);
    const mesh = source[variant].getObjectByProperty('isMesh', true);
    const batch = new THREE.InstancedMesh(mesh.geometry, mesh.material, wall.length);
    batch.name = `cabinet-candles-${variant + 1}`;
    batch.castShadow = true;
    batch.receiveShadow = true;
    const transform = new THREE.Object3D();
    const origin = new THREE.Vector3();
    wall.forEach((candle, index) => {
      fitCandle(transform, variant, .05, 1.12, (index * 2 + variant + 1) * candleTurn);
      candle.body.getWorldPosition(origin);
      transform.position.add(origin);
      transform.updateMatrix();
      batch.setMatrixAt(index, transform.matrix);
      candle.body.removeFromParent();
    });
    scene.add(batch);
    onPlaced(batch);
  }
  const desk = candles.find(candle => candle.type === null);
  const top = new THREE.Group();
  const holderShape = new THREE.Box3().setFromObject(holder, true);
  top.name = 'desk-candle-and-holder';
  top.add(holder);
  const wax = source[0].clone(true);
  fitCandle(wax, 0, holderShape.max.y - .001, .76, candles.length * candleTurn);
  top.add(wax);
  desk.body.parent.add(top);
  desk.body.removeFromParent();
  desk.holder.removeFromParent();
  onPlaced(top);
}

function replaceChandeliers(scene, fallback, source, materials, onPlaced) {
  const scale = 2.13;
  const y = 10.60;
  const flames = new THREE.InstancedMesh(new THREE.SphereGeometry(.047, 7, 5),
    materials.light, CHANDELIER_Z.length * chandelierWicks.length);
  flames.name = 'chandelier-flames';
  const bulb = new THREE.Object3D();
  bulb.scale.set(.72, 1.65, .72);
  CHANDELIER_Z.forEach((z, index) => {
    const model = source.clone(true);
    model.name = 'archive-chandelier';
    model.position.set(0, y, z);
    model.scale.setScalar(scale);
    scene.add(model);
    onPlaced(model);
    const lower = y + .023 * scale;
    const upper = 13.36;
    const support = new THREE.Mesh(new THREE.CylinderGeometry(.036, .036, upper - lower, 8), materials.agedBronze);
    support.position.set(0, (lower + upper) / 2, z);
    scene.add(support);
    chandelierWicks.forEach(([x, wickY, localZ], candle) => {
      bulb.position.set(x * scale, y + wickY * scale + .049, z + localZ * scale);
      bulb.updateMatrix();
      flames.setMatrixAt(index * chandelierWicks.length + candle, bulb.matrix);
    });
  });
  scene.add(flames);
  fallback.removeFromParent();
}

function paintBench(model, finish) {
  const bounds = new THREE.Box3().setFromObject(model, true);
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  model.scale.set(BENCH.width / size.x, (BENCH.surfaceY - RUG_TOP) / size.y, BENCH.depth / size.z);
  model.position.set(-center.x * model.scale.x, RUG_TOP - bounds.min.y * model.scale.y,
    BENCH.z - center.z * model.scale.z);

  model.traverse(mesh => {
    if (!mesh.isMesh) return;
    const base = mesh.geometry;
    const geometry = base.index ? base.toNonIndexed() : base.clone();
    const position = geometry.attributes.position;
    const uv = geometry.attributes.uv;
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), normal = new THREE.Vector3();
    const top = [], sides = [];
    for (let i = 0; i < position.count; i += 3) {
      a.fromBufferAttribute(position, i);
      b.fromBufferAttribute(position, i + 1);
      c.fromBufferAttribute(position, i + 2);
      normal.subVectors(b, a).cross(c.sub(a)).normalize();
      const isTop = normal.y > .75 && a.y > bounds.max.y - .055;
      (isTop ? top : sides).push(i, i + 1, i + 2);
      for (let j = i; j < i + 3; j++) {
        const x = (position.getX(j) - bounds.min.x) / size.x;
        const z = (position.getZ(j) - bounds.min.z) / size.z;
        const y = (position.getY(j) - bounds.min.y) / size.y;
        uv.setXY(j, Math.abs(normal.x) > .75 ? z : x, Math.abs(normal.y) > .75 ? 1 - z : y);
      }
    }
    geometry.setIndex([...top, ...sides]);
    geometry.clearGroups();
    geometry.addGroup(0, top.length, 0);
    geometry.addGroup(top.length, sides.length, 1);
    mesh.geometry = geometry;
    mesh.material = [finish.benchTop, finish.benchEdge];
  });
}

function placeStools(scene, source, material, onPlaced) {
  const positions = ARCHIVE_SIDE_TABLES.flatMap(({ x, z }) => [-.87, .87].map((offset, index) => [
    x - Math.sign(x) * 1.28, z + offset, index ? -.27 : .13,
  ]));
  // Foot centers in source-model coordinates. Draw all contact shadows in one pass.
  const feet = [[.154, .173], [-.145, .171], [.154, -.150], [-.145, -.151]];
  const shadows = new THREE.InstancedMesh(new THREE.PlaneGeometry(.25, .25).rotateX(-Math.PI / 2),
    material, positions.length * feet.length);
  shadows.name = 'archive-stool-contact-shadows';
  shadows.renderOrder = 2;
  const shadowPosition = new THREE.Vector3();
  const shadowMatrix = new THREE.Matrix4();
  let index = 0;
  for (const [x, z, yaw] of positions) {
    const stool = source.clone(true);
    stool.name = 'archive-painted-stool';
    placeOn(stool, x, floorSurfaceY(x, z), z, yaw, .84 * furnitureScale);
    scene.add(stool);
    for (const [footX, footZ] of feet) {
      stool.localToWorld(shadowPosition.set(footX, 0, footZ));
      shadowPosition.y = floorSurfaceY(shadowPosition.x, shadowPosition.z) + .003;
      shadows.setMatrixAt(index++, shadowMatrix.makeTranslation(shadowPosition.x, shadowPosition.y, shadowPosition.z));
    }
    onPlaced(stool, new THREE.Box3().setFromObject(stool, true), true);
  }
  scene.add(shadows);
}

export async function addArchiveRoomProps(scene, { candles, chandeliers, workstations, materials, onPlaced }) {
  try {
    const { GLTFLoader } = await import('../vendor/loaders/GLTFLoader.js');
    const loader = new GLTFLoader().setResourcePath(new URL('../assets/selected-archive-props/', import.meta.url).href);
    async function load(name, extension = 'gltf') {
      const url = new URL(`../assets/selected-archive-props/${name}.${extension}`, import.meta.url);
      const { scene: object } = await loader.loadAsync(url.href);
      object.name = name;
      shadows(object);
      return object;
    }
    async function place(label, task) {
      try { await task(); }
      catch (error) { console.warn(`Archive could not place ${label}`, error); }
    }
    await Promise.all([
      place('candles', async () => {
        const [one, two, holder] = await Promise.all([load('Candle_1'), load('Candle_2'), load('wooden-candle-holder', 'glb')]);
        replaceCandles(scene, candles, [one, two], holder, onPlaced);
      }),
      place('chandeliers', async () => {
        replaceChandeliers(scene, chandeliers, await load('Chandelier'), materials, onPlaced);
      }),
      place('central table', async () => {
        const model = await load('painted_wooden_table', 'glb');
        const station = workstations.stations[0];
        paintBench(model, workstations.finish);
        station.group.add(model);
        // Keep the old slab as an invisible aiming surface underneath the bowls.
        station.benchBody.visible = false;
        station.floorShadow.material = materials.furnitureShadows.paintedBenchFloor.material;
        onPlaced(model);
      }),
      place('stools', async () => placeStools(scene, await load('painted_wooden_stool', 'glb'), materials.contactShadow, onPlaced)),
      place('peg rack', async () => {
        const rack = await load('Peg_Rack');
        rack.rotation.y = Math.PI;
        rack.scale.setScalar(furnitureScale);
        rack.position.set(3.90, 1.85, 23.16);
        scene.add(rack);
        onPlaced(rack);
      }),
      ...tabletop.map(([name, table, x, z, yaw, scale]) => place(name, async () => {
        const model = await load(name);
        placeOn(model, table.x + x, ARCHIVE_DESK.y + .002, table.z + z, yaw, scale);
        scene.add(model);
        onPlaced(model, new THREE.Box3().setFromObject(model, true));
      })),
    ]);
  } catch (error) {
    console.warn('Archive room models are unavailable', error);
  }
}
