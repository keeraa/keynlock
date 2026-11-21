// @ts-check
import * as THREE from 'three';
import { WINDOW_OPENING } from './window.js';

// Daylight through the arched window, made the same way as in the Key Archive
// (js/3d/scenes/key-archive/dist/js/archive-window-rays.js): parallel rays
// enter through the opening and slope down into the room. Every effect asks
// one question, "how much window light reaches this point?", by projecting the
// point back along the rays onto the arched opening. That keeps the air beams,
// the patch on the floor and the lit dust in exactly the same place.
//
// No shadow-casting sun: the Lair keeps short overhead contact shadows only.

const { centerX, wallZ, sill, spring, crown, halfWidth, mullionOffsets, transomHeights } = WINDOW_OPENING;
/** Top of the floor planks (and the rug lies a little above it). */
export const FLOOR_Y = .04;
/** Ray direction per metre into the room: drop in height and sideways drift. */
export const WINDOW_LIGHT_SLOPE = Object.freeze({
  y: ((sill + crown) / 2 - FLOOR_Y) / 14,   // the middle of the window lands ~14 m in
  x: .10,
});
/** Warm late-afternoon light, the Archive's daytime palette. */
export const WINDOW_LIGHT_TINT = Object.freeze({ air: 0xeacfa5, floor: 0xeecf9e, dust: 0xffedce });

const bottom = sill - .16;
const top = crown + .12;
const rise = crown - spring;
const smooth = (a, b, value) => {
  const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Shadows of the window frame inside the beam: soft bands whose penumbra
// widens with the distance from the window, as with real sunlight.
function frameShade(offset, height, distance) {
  const blur = .05 + distance * .012;
  let shade = 1;
  for (const bar of mullionOffsets) shade *= .45 + .55 * smooth(.04, .04 + blur, Math.abs(offset - bar));
  for (const bar of transomHeights) shade *= .45 + .55 * smooth(.04, .04 + blur, Math.abs(height - bar));
  return shade;
}

/** 0..1: how much window light reaches the point (x, y, z). */
export function windowLightAt(x, y, z) {
  const distance = z - wallZ;
  const height = y + distance * WINDOW_LIGHT_SLOPE.y;
  if (distance < 0 || height < bottom || height > top) return 0;
  const offset = x + distance * WINDOW_LIGHT_SLOPE.x - centerX;
  const arch = Math.max(0, (height - spring) / rise);
  return smooth(bottom, sill + .22, height) *
    (1 - smooth(.72, 1.08, Math.hypot(offset / halfWidth, arch))) *
    frameShade(offset, height, distance);
}

const f = (/** @type {number} */ x) => x.toFixed(6);
/** The same function for shaders: float lairWindowLightAt(vec3 point). */
export const WINDOW_LIGHT_GLSL = `
  float lairWindowFrameShade(float offset, float height, float distance) {
    float blur = .05 + distance * .012;
    float shade = 1.0;
${mullionOffsets.map(bar => `    shade *= .45 + .55 * smoothstep(.04, .04 + blur, abs(offset - (${f(bar)})));`).join('\n')}
${transomHeights.map(bar => `    shade *= .45 + .55 * smoothstep(.04, .04 + blur, abs(height - (${f(bar)})));`).join('\n')}
    return shade;
  }
  float lairWindowLightAt(vec3 point) {
    float distance = point.z - (${f(wallZ)});
    float height = point.y + distance * ${f(WINDOW_LIGHT_SLOPE.y)};
    if (distance < 0.0 || height < ${f(bottom)} || height > ${f(top)}) return 0.0;
    float offset = point.x + distance * ${f(WINDOW_LIGHT_SLOPE.x)} - (${f(centerX)});
    float arch = max(0.0, (height - ${f(spring)}) / ${f(rise)});
    return smoothstep(${f(bottom)}, ${f(sill + .22)}, height) *
      (1.0 - smoothstep(.72, 1.08, length(vec2(offset / ${f(halfWidth)}, arch)))) *
      lairWindowFrameShade(offset, height, distance);
  }`;

/** Distance from the window at which a ray leaving at this height meets the floor. */
const floorAt = (/** @type {number} */ height) => (height - FLOOR_Y) / WINDOW_LIGHT_SLOPE.y;
/** World point on a ray that left the opening at (offset, height), `distance` metres in. */
const rayPoint = (offset, height, distance) => [
  centerX + offset - distance * WINDOW_LIGHT_SLOPE.x,
  height - distance * WINDOW_LIGHT_SLOPE.y,
  wallZ + distance,
];

// Two families of translucent slices give the beam depth as the camera turns:
// upright ones (fixed sideways offset) and flat ones (fixed height). Each ends
// where it meets the floor.
function createAirBeams() {
  const positions = [], aperture = [], families = [], indices = [];
  const near = .18, width = halfWidth * 1.08, slices = 7;
  function addSlice(a, b, family) {
    const first = positions.length / 3;
    const corners = [[near, a], [floorAt(a[0]), a], [floorAt(b[0]), b], [near, b]];
    for (const [distance, [height, offset]] of corners) {
      positions.push(...rayPoint(offset, height, distance));
      aperture.push(height, offset / halfWidth);
      families.push(family);
    }
    indices.push(first, first + 1, first + 2, first, first + 2, first + 3);
  }
  for (let layer = 0; layer < slices; layer++) {
    const fraction = (layer + .5) / slices;
    const offset = (fraction * 2 - 1) * width;
    const height = bottom + (top - bottom) * fraction;
    addSlice([bottom, offset], [top, offset], 0);
    addSlice([height, -width], [height, width], 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('aperture', new THREE.Float32BufferAttribute(aperture, 2));
  geometry.setAttribute('family', new THREE.Float32BufferAttribute(families, 1));
  geometry.setIndex(indices);
  const uniforms = {
    uAirStrength: { value: 0 },
    uAirTint: { value: new THREE.Color(WINDOW_LIGHT_TINT.air) },
  };
  // Normals of the two slice families, used to fade slices seen edge-on.
  const upright = new THREE.Vector3(1, 0, WINDOW_LIGHT_SLOPE.x).normalize();
  const flat = new THREE.Vector3(0, 1, WINDOW_LIGHT_SLOPE.y).normalize();
  const vec3 = (/** @type {THREE.Vector3} */ v) => `vec3(${f(v.x)}, ${f(v.y)}, ${f(v.z)})`;
  const material = new THREE.ShaderMaterial({
    uniforms, side: THREE.DoubleSide, forceSinglePass: true, transparent: true,
    depthWrite: false, toneMapped: false, fog: false,
    vertexShader: `
      attribute vec2 aperture;
      attribute float family;
      varying vec3 vBeamPosition;
      varying vec2 vAperture;
      varying float vFamily;
      void main() {
        vBeamPosition = (modelMatrix * vec4(position, 1.0)).xyz;
        vAperture = aperture;
        vFamily = family;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform float uAirStrength;
      uniform vec3 uAirTint;
      ${WINDOW_LIGHT_GLSL}
      varying vec3 vBeamPosition;
      varying vec2 vAperture;
      varying float vFamily;
      void main() {
        float distanceFromWindow = vBeamPosition.z - (${f(wallZ)});
        float height = vAperture.x;
        float offset = vAperture.y;
        float arch = max(0.0, (height - ${f(spring)}) / ${f(rise)});
        float apertureEdge = 1.0 - smoothstep(.50, 1.04, length(vec2(offset, arch)));
        apertureEdge *= smoothstep(${f(bottom)}, ${f(sill + .38)}, height);
        float aboveFloor = vBeamPosition.y - (${f(FLOOR_Y)});
        float air = smoothstep(.20, 1.65, distanceFromWindow) *
          mix(1.0, .55, smoothstep(3.0, 18.0, distanceFromWindow)) *
          smoothstep(.0, .36, aboveFloor);
        vec3 sight = normalize(cameraPosition - vBeamPosition);
        vec2 facing = vec2(dot(sight, ${vec3(upright)}), dot(sight, ${vec3(flat)}));
        facing *= facing;
        float layerWeight = mix(facing.x, facing.y, vFamily) / max(.14, facing.x + facing.y);
        float frame = lairWindowFrameShade(offset * ${f(halfWidth)}, height, distanceFromWindow);
        gl_FragColor = vec4(uAirTint, uAirStrength * air * apertureEdge * frame * layerWeight);
        #include <colorspace_fragment>
      }`,
  });
  const beams = new THREE.Mesh(geometry, material);
  beams.name = 'window-light-air';
  beams.renderOrder = 3;
  beams.frustumCulled = false;
  return { beams, uniforms };
}

// The arched patch of sunlight on the floor (and across the rug).
function createFloorPatch() {
  const near = floorAt(top), far = floorAt(bottom);
  const zFrom = wallZ + floorAt(bottom) - 0.5, zTo = wallZ + floorAt(top) + .5;
  const drift = [near, far].map(d => -d * WINDOW_LIGHT_SLOPE.x);
  const xFrom = centerX - halfWidth * 1.15 + Math.min(...drift);
  const xTo = centerX + halfWidth * 1.15 + Math.max(...drift);
  const geometry = new THREE.PlaneGeometry(xTo - xFrom, zTo - zFrom).rotateX(-Math.PI / 2);
  const uniforms = {
    uStrength: { value: 0 },
    uTint: { value: new THREE.Color(WINDOW_LIGHT_TINT.floor) },
  };
  const material = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, toneMapped: false, fog: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    vertexShader: `
      varying vec3 vWorld;
      void main() {
        vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform float uStrength;
      uniform vec3 uTint;
      varying vec3 vWorld;
      ${WINDOW_LIGHT_GLSL}
      void main() {
        float light = lairWindowLightAt(vec3(vWorld.x, ${f(FLOOR_Y)}, vWorld.z));
        gl_FragColor = vec4(uTint, uStrength * light);
        #include <colorspace_fragment>
      }`,
  });
  const patch = new THREE.Mesh(geometry, material);
  patch.name = 'window-light-floor';
  // Just above the rug in the middle of the room, so the patch crosses it.
  patch.position.set((xFrom + xTo) / 2, .062, (zFrom + zTo) / 2);
  patch.renderOrder = 1;
  return { patch, uniforms };
}

/**
 * Adds the window light to `parent`. `dustStrength` is a shared uniform for
 * the floating dust (room/ambient-particles.js), which lights up in the beam.
 */
export function createWindowLight(parent) {
  const air = createAirBeams();
  const floor = createFloorPatch();
  parent.add(air.beams, floor.patch);
  const dustStrength = { value: 0 };
  /** 0 = off, 1 = the default daylight, up to 1.5. */
  function setStrength(/** @type {number} */ strength) {
    const value = Math.max(0, strength);
    air.beams.visible = floor.patch.visible = value > 0;
    air.uniforms.uAirStrength.value = value * .12;
    floor.uniforms.uStrength.value = value * .42;
    dustStrength.value = value;
  }
  setStrength(1);
  return { setStrength, dustStrength, beams: air.beams, floor: floor.patch };
}
