// @ts-check
import * as THREE from 'three';
import { CEILING_BEAM_Z, ROOM_END } from '../room-layout.js';

// The Lair's lamps: three candle chandeliers in the middle of the room and
// eight wall sconces. Only the chandeliers are real lights; each sconce paints
// a warm patch on the wall around itself (like the window's patch on the
// floor), which reads as lamplight and costs nothing per pixel. By day the
// lamps are dim, at night they are the room's main light (setNight).
//
// Glows and wall patches are light, not surfaces: userData.atmosphere keeps
// them out of the Atelier's ink outlines.

/** Chandeliers along the middle of the room, hanging low enough to light the floor. */
export const CHANDELIERS = Object.freeze([1, 3, 5].map(index =>
  Object.freeze({ x: 0, y: 7.7, z: CEILING_BEAM_Z[index] })));
/** Wall sconces on both long walls, with space around the tool board. */
export const SCONCES = Object.freeze([-1, 1].flatMap(side =>
  [-1.10, 4.70, 11.0, ROOM_END - 1.77].map(z => Object.freeze({ side, y: 3.1, z }))));
const WALL_X = 8.39;
const CEILING_Y = 13.26;
/** Day and night values; setNight blends between them. */
const LEVELS = Object.freeze({
  chandelier: { day: 14, night: 75 },
  glow: { day: .32, night: 1.1 },
  wall: { day: .14, night: .95 },
});
const WARM = 0xffc98f;

const mix = (/** @type {{ day: number, night: number }} */ level, night) => level.day + (level.night - level.day) * night;

/** A soft round glow that always faces the camera. */
function createGlow(size, color) {
  const uniforms = { uStrength: { value: 0 }, uColor: { value: new THREE.Color(color) } };
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, toneMapped: false, fog: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform float uStrength;
      uniform vec3 uColor;
      varying vec2 vUv;
      void main() {
        float r = length(vUv - .5) * 2.0;
        float glow = pow(max(0.0, 1.0 - r), 2.4);
        gl_FragColor = vec4(uColor * glow * uStrength, 1.0);
      }`,
  }));
  glow.userData.atmosphere = true;
  glow.renderOrder = 4;
  glow.onBeforeRender = (renderer, scene, camera) => glow.quaternion.copy(camera.quaternion);
  return { glow, uniforms };
}

/** The warm patch a sconce paints on the wall: brightest at the shade, spreading up and down. */
function createWallPatch(side, y, z) {
  const uniforms = { uStrength: { value: 0 }, uColor: { value: new THREE.Color(WARM) } };
  const patch = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 4.4), new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, toneMapped: false, fog: false,
    blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    vertexShader: `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform float uStrength;
      uniform vec3 uColor;
      varying vec2 vUv;
      void main() {
        vec2 p = (vUv - vec2(.5, .44)) * vec2(3.4, 4.4);
        float spread = exp(-(p.x * p.x / .8 + p.y * p.y / 2.2));
        float core = exp(-(p.x * p.x / .07 + (p.y - .1) * (p.y - .1) / .12));
        gl_FragColor = vec4(uColor * (spread * .75 + core * .6) * uStrength, 1.0);
      }`,
  }));
  patch.position.set(side * (WALL_X - .015), y + .25, z);
  patch.rotation.y = -side * Math.PI / 2;
  patch.userData.atmosphere = true;
  patch.renderOrder = 1;
  return { patch, uniforms };
}

function buildChandelier(kit, { x, y, z }, flames) {
  const { m, staticGroup, cylinder, rod } = kit;
  const group = new THREE.Group();
  group.name = 'lair-chandelier';
  group.position.set(x, y, z);
  staticGroup.add(group);
  // Chain from the ceiling beam, a forged ring and four hangers.
  rod(group, [0, CEILING_Y - y, 0], [0, 1.25, 0], .022, m.iron, 6);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.62, .035, 8, 40), m.iron);
  ring.rotation.x = Math.PI / 2;
  group.add(ring);
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + Math.PI / 4;
    rod(group, [Math.cos(a) * .6, 0, Math.sin(a) * .6], [0, 1.25, 0], .014, m.iron, 5);
  }
  // Eight candles on dishes around the ring.
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    const cx = Math.cos(a) * .62, cz = Math.sin(a) * .62;
    cylinder(group, .075, .06, .025, m.oldBrass, cx, .046, cz, 12);
    cylinder(group, .038, .042, .22, m.paper, cx, .168, cz, 10);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(.032, .11, 8), new THREE.MeshBasicMaterial({
      color: '#ffd391', transparent: true, opacity: .92, blending: THREE.AdditiveBlending, depthWrite: false }));
    flame.position.set(cx, .324, cz);
    group.add(flame);
    flames.push(flame);
  }
  const { glow, uniforms } = createGlow(2.8, WARM);
  glow.position.y = .32;
  group.add(glow);
  // The one real light: low enough to reach the floor and the furniture.
  const light = new THREE.PointLight(WARM, LEVELS.chandelier.day, 19, 2);
  light.name = 'lair-chandelier-light';
  light.position.y = .1;
  group.add(light);
  return { light, glow: uniforms };
}

function buildSconce(kit, { side, y, z }) {
  const { m, staticGroup, box, rod } = kit;
  const group = new THREE.Group();
  group.name = 'lair-wall-sconce';
  group.position.set(side * (WALL_X - .015), y, z);
  staticGroup.add(group);
  box(group, .04, .34, .16, m.oldBrass, 0, 0, 0).name = 'lair-sconce-backplate';
  rod(group, [0, -.05, 0], [-side * .3, .05, 0], .016, m.oldBrass, 6);
  // A frosted glass tulip, open at the top, lit from inside.
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(.14, .07, .24, 16, 1, true), new THREE.MeshStandardMaterial({
    color: '#f3d9ad', emissive: '#ffbb73', emissiveIntensity: .35, roughness: .55,
    transparent: true, opacity: .9, side: THREE.DoubleSide }));
  shade.position.set(-side * .34, .14, 0);
  group.add(shade);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(.045, 10, 8), new THREE.MeshBasicMaterial({ color: '#fff0d0' }));
  bulb.position.set(-side * .34, .1, 0);
  group.add(bulb);
  const { glow, uniforms } = createGlow(1.1, WARM);
  glow.position.set(-side * .34, .14, 0);
  group.add(glow);
  const wall = createWallPatch(side, y, z);
  staticGroup.add(wall.patch);
  return { shade, glow: uniforms, wall: wall.uniforms };
}

/** Builds every lamp; returns setNight(0..1) and the flicker update. */
export function buildLamps(kit) {
  const flames = [];
  const chandeliers = CHANDELIERS.map(place => buildChandelier(kit, place, flames));
  const sconces = SCONCES.map(place => buildSconce(kit, place));
  kit.animated.push(time => {
    flames.forEach((flame, i) => {
      flame.scale.set(.92 + Math.sin(time * 6 + i) * .09, 1 + Math.sin(time * 9 + i * 1.7) * .15, .92);
    });
  });
  /** 0 = day (lamps dim), 1 = night (lamps are the main light); in between while it changes. */
  function setNight(night) {
    const amount = Math.max(0, Math.min(1, Number(night)));
    for (const chandelier of chandeliers) {
      chandelier.light.intensity = mix(LEVELS.chandelier, amount);
      chandelier.glow.uStrength.value = mix(LEVELS.glow, amount);
    }
    for (const sconce of sconces) {
      sconce.glow.uStrength.value = mix(LEVELS.glow, amount) * .8;
      sconce.wall.uStrength.value = mix(LEVELS.wall, amount);
      /** @type {THREE.MeshStandardMaterial} */ (sconce.shade.material).emissiveIntensity = .35 + .9 * amount;
    }
  }
  setNight(0);
  return { setNight, chandeliers: chandeliers.length, sconces: sconces.length };
}
