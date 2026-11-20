import * as THREE from '../vendor/three.js';
import { CABINET_BODY_WIDTH, CABINET_Z } from './cabinet-layout.js?v=wax-and-bundles';
import { HALL_SIDE_WALL_INNER_X } from './hall-architecture.js?v=alchemy-candles';
import { createCandleFlame, createCandleFlameMaterial } from './candle-flame.js?v=candlelight';
import { ARCHIVE_DESK } from './archive-ledger.js?v=ledger-candle';
import { batchStaticHallMeshes } from './static-mesh-batches.js';

export const WAX_MELT_MS = 2500;
export const CANDLE_FLAME_WIDTH = .12;
export const CANDLE_FLAME_HEIGHT = .24;
export const CANDLE_WICK_Y = .295;
export const ENTRANCE_CANDLE = Object.freeze({
  id: 'entrance-candle', type: null, x: ARCHIVE_DESK.x - ARCHIVE_DESK.width / 2 + .195,
  y: ARCHIVE_DESK.y, z: ARCHIVE_DESK.z - .27,
});

function candleNoise(time, seed) {
  const index = Math.floor(time);
  const phase = time - index;
  const weight = phase * phase * (3 - 2 * phase);
  const random = point => {
    const value = Math.sin(point * 12.9898 + seed) * 43758.5453;
    return value - Math.floor(value);
  };
  return 2 * (random(index) * (1 - weight) + random(index + 1) * weight) - 1;
}

export function sampleCandleFlicker(now, x, z) {
  const time = now / 1000;
  const seed = x * 2.1 + z * 4.3;
  return .74 * candleNoise(time * .56, seed) + .26 * candleNoise(time * 1.17, seed + 17);
}

const CABINET_CANDLE_X = 10.6;
const BRACKET_START = -.045;
const BRACKET_END = HALL_SIDE_WALL_INNER_X - CABINET_CANDLE_X + .027;
const BRACKET_PLATE_DEPTH = .09;
const BRACKET_PLATE_HALF_WIDTH = .12;

export function createArchiveCandles(scene, { drawMeshes = false } = {}) {
  const root = new THREE.Group();
  scene.add(root);
  const locations = [ENTRANCE_CANDLE];
  for (let type = 0; type < 10; type++) {
    for (const side of [-1, 1]) {
      locations.push({ id: `cabinet-candle-${type}-${side}`, type,
        x: (type < 5 ? -1 : 1) * CABINET_CANDLE_X, mountX: (type < 5 ? -1 : 1) * HALL_SIDE_WALL_INNER_X, y: 2.10, z: CABINET_Z[type % 5] + side * (CABINET_BODY_WIDTH / 2 - .03) });
    }
  }
  const colliderGeometry = new THREE.BoxGeometry(.42, .48, .42);
  const colliderMaterial = new THREE.MeshBasicMaterial({ visible: false, transparent: true });
  const candleGeometry = new THREE.CylinderGeometry(.055, .062, .26, 10);
  const holderGeometry = new THREE.CylinderGeometry(.11, .07, .05, 12);
  const bracketGeometry = new THREE.BoxGeometry(BRACKET_END - BRACKET_START, .055, .12);
  const plateGeometry = new THREE.BoxGeometry(BRACKET_PLATE_DEPTH, .29, BRACKET_PLATE_HALF_WIDTH * 2);
  const wickGeometry = new THREE.CylinderGeometry(.009, .01, .025, 6);
  const flameGeometry = new THREE.PlaneGeometry(CANDLE_FLAME_WIDTH, CANDLE_FLAME_HEIGHT)
    .translate(0, CANDLE_FLAME_HEIGHT / 2, 0);
  const flameTime = { value: 0 };
  const flameMaterial = drawMeshes ? createCandleFlameMaterial(THREE, flameTime) : null;
  const wax = new THREE.MeshStandardMaterial({ color: 0xd8bd87, roughness: .94 });
  const brass = new THREE.MeshStandardMaterial({ color: 0x896440, roughness: .65, metalness: .35 });
  const wickMaterial = new THREE.MeshStandardMaterial({ color: 0x3d2a1e, roughness: 1 });
  const colliders = [];
  const candles = locations.map(candle => {
    const { id, x, y, z, type } = candle;
    const group = new THREE.Group();
    group.position.set(x, y, z);
    root.add(group);
    const collider = new THREE.Mesh(colliderGeometry, colliderMaterial);
    collider.position.y = .22;
    collider.userData = { kind: 'candle', id, lit: type === null };
    group.add(collider);
    colliders.push(collider);
    let flame, halo, deskLight;
    if (drawMeshes) {
      const body = new THREE.Mesh(candleGeometry, wax);
      body.position.y = .15;
      const holder = new THREE.Mesh(holderGeometry, brass);
      holder.position.y = .025;
      const wick = new THREE.Mesh(wickGeometry, wickMaterial);
      wick.position.y = CANDLE_WICK_Y - .008;
      flame = createCandleFlame(THREE, flameMaterial, flameGeometry);
      flame.position.y = CANDLE_WICK_Y;
      if (type === null) {
        deskLight = new THREE.PointLight(0xffb46d, .94, 1.24, 2);
        deskLight.name = 'entrance-candle-light';
        deskLight.position.set(.035, CANDLE_WICK_Y + .087, .015);
        group.add(deskLight);
      }
      halo = new THREE.Sprite(new THREE.SpriteMaterial({
        map: candleGlowTexture(), color: 0xffa94d, opacity: .30, transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      halo.position.y = CANDLE_WICK_Y + .085;
      halo.scale.setScalar(.67);
      if (type !== null) {
        const bracket = new THREE.Mesh(bracketGeometry, brass);
        bracket.position.set(Math.sign(x) * (BRACKET_START + BRACKET_END) / 2, -.027, 0);
        const plate = new THREE.Mesh(plateGeometry, brass);
        plate.position.set(candle.mountX - x - Math.sign(x) * .035, -.027, 0);
        group.add(bracket, plate);
      }
      group.add(holder, body, wick, halo, flame);
    }
    // 0..1: something is melting over this flame, so it gutters and jumps.
    let disturbance = 0;
    function update(lit, now) {
      collider.userData.lit = lit;
      if (!flame) return;
      flame.visible = halo.visible = lit;
      if (lit) {
        const flicker = sampleCandleFlicker(now, x, z);
        const jolt = disturbance * (Math.sin(now * .031 + x) * .6 + Math.sin(now * .053 + z) * .4);
        flame.scale.y = 1 + .065 * flicker + disturbance * .16 + jolt * .14;
        flame.scale.x = 1 + jolt * .16;
        flame.rotation.z = .048 * flicker + jolt * .24;
        halo.material.opacity = .25 + .027 * flicker + disturbance * .06;
        if (deskLight) deskLight.intensity = .94 * (1 + .12 * flicker + .22 * jolt);
      }
    }
    update(type === null, 0);
    return { ...candle, collider, update, disturb(amount) { disturbance = Math.max(0, Math.min(1, amount)); } };
  });
  if (drawMeshes) batchStaticHallMeshes(root);
  function update(now, cabinets) {
    flameTime.value = now * .00036;
    for (const candle of candles)
      candle.update(candle.type === null || cabinets[candle.type].completion.isComplete(), now);
  }
  return { candles, colliders, update };
}

let glowTexture;
function candleGlowTexture() {
  if (glowTexture) return glowTexture;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 32;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(.3, 'rgba(255,255,255,.42)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 32, 32);
  glowTexture = new THREE.CanvasTexture(canvas);
  return glowTexture;
}
