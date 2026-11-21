// @ts-check
import * as THREE from 'three';
import { WINDOW_OPENING } from './window.js';
import { BIRD_SIZE, BIRD_Z, createWindowBird } from './window-bird.js';

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
/** The Key Archive's palettes: warm late-afternoon sun, cool moonlight. */
export const WINDOW_LIGHT_PALETTES = Object.freeze({
  day: Object.freeze({ air: 0xeacfa5, floor: 0xeecf9e, dust: 0xffedce, strength: 1 }),
  night: Object.freeze({ air: 0xaac6e8, floor: 0xa7c5f1, dust: 0xe2eeff, strength: .72 }),
});
export const WINDOW_LIGHT_TINT = WINDOW_LIGHT_PALETTES.day;

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
/**
 * The same function for shaders: float lairWindowLightAt(vec3 point). It also
 * darkens the light where the passing bird's shadow falls, so a material that
 * uses it needs the bird's uniforms (createWindowLight().shaderUniforms).
 */
export const WINDOW_LIGHT_GLSL = `
  uniform sampler2D uWindowBirdMap;
  uniform vec4 uWindowBirdPose;
  float lairBirdShade(vec3 point) {
    if (uWindowBirdPose.z == 0.0) return 1.0;
    // Follow the ray from the point back to the bird's plane outside the glass.
    float distance = point.z - (${f(BIRD_Z)});
    vec2 crossing = vec2(point.x + distance * ${f(WINDOW_LIGHT_SLOPE.x)},
      point.y + distance * ${f(WINDOW_LIGHT_SLOPE.y)});
    vec2 uv = (crossing - uWindowBirdPose.xy) * vec2(uWindowBirdPose.w, 1.0) /
      vec2(${f(BIRD_SIZE.width)}, ${f(BIRD_SIZE.height)}) + .5;
    if (min(uv.x, uv.y) < .05 || max(uv.x, uv.y) > .95) return 1.0;
    float shadow = texture2D(uWindowBirdMap, uv).a * .36;
    shadow += texture2D(uWindowBirdMap, uv + vec2(.048, .035)).a * .16;
    shadow += texture2D(uWindowBirdMap, uv + vec2(-.048, .035)).a * .16;
    shadow += texture2D(uWindowBirdMap, uv + vec2(.048, -.035)).a * .16;
    shadow += texture2D(uWindowBirdMap, uv + vec2(-.048, -.035)).a * .16;
    return 1.0 - shadow * .86;
  }
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
      lairWindowFrameShade(offset, height, distance) * lairBirdShade(point);
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
function createAirBeams(birdUniforms) {
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
    ...birdUniforms,
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
        float frame = lairWindowFrameShade(offset * ${f(halfWidth)}, height, distanceFromWindow) *
          lairBirdShade(vBeamPosition);
        gl_FragColor = vec4(uAirTint, uAirStrength * air * apertureEdge * frame * layerWeight);
        #include <colorspace_fragment>
      }`,
  });
  const beams = new THREE.Mesh(geometry, material);
  beams.name = 'window-light-air';
  beams.userData.atmosphere = true;       // light, not a surface: never outlined
  beams.renderOrder = 3;
  beams.frustumCulled = false;
  return { beams, uniforms };
}

// The arched patch of sunlight on the floor (and across the rug).
function createFloorPatch(birdUniforms) {
  const near = floorAt(top), far = floorAt(bottom);
  const zFrom = wallZ + floorAt(bottom) - 0.5, zTo = wallZ + floorAt(top) + .5;
  const drift = [near, far].map(d => -d * WINDOW_LIGHT_SLOPE.x);
  const xFrom = centerX - halfWidth * 1.15 + Math.min(...drift);
  const xTo = centerX + halfWidth * 1.15 + Math.max(...drift);
  const geometry = new THREE.PlaneGeometry(xTo - xFrom, zTo - zFrom).rotateX(-Math.PI / 2);
  const uniforms = {
    uStrength: { value: 0 },
    uTint: { value: new THREE.Color(WINDOW_LIGHT_TINT.floor) },
    ...birdUniforms,
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
  patch.userData.atmosphere = true;
  // Just above the rug in the middle of the room, so the patch crosses it.
  patch.position.set((xFrom + xTo) / 2, .062, (zFrom + zTo) / 2);
  patch.renderOrder = 1;
  return { patch, uniforms };
}

/**
 * Adds the window light and the passing bird to `parent`. `shaderUniforms`
 * (dust strength, dust tint and the bird's shadow) are shared with the
 * floating dust (room/ambient-particles.js), which lights up in the beam.
 */
export function createWindowLight(parent) {
  const bird = createWindowBird(parent);
  const air = createAirBeams(bird.uniforms);
  const floor = createFloorPatch(bird.uniforms);
  parent.add(air.beams, floor.patch);
  const shaderUniforms = {
    uWindowLight: { value: 0 },
    uWindowTint: { value: new THREE.Color(WINDOW_LIGHT_TINT.dust) },
    ...bird.uniforms,
  };
  let strength = 1;
  /** @type {{ air: number, floor: number, dust: number, strength: number }} */
  let palette = WINDOW_LIGHT_PALETTES.day;
  function apply() {
    const value = strength * palette.strength;
    air.beams.visible = floor.patch.visible = value > 0;
    air.uniforms.uAirStrength.value = value * .12;
    floor.uniforms.uStrength.value = value * .42;
    shaderUniforms.uWindowLight.value = value;
    air.uniforms.uAirTint.value.setHex(palette.air);
    floor.uniforms.uTint.value.setHex(palette.floor);
    shaderUniforms.uWindowTint.value.setHex(palette.dust);
  }
  apply();
  return {
    shaderUniforms, beams: air.beams, floor: floor.patch, bird: bird.bird,
    /** 0 = off, 1 = the default light, up to 1.5. */
    setStrength(/** @type {number} */ value) { strength = Math.max(0, value); apply(); },
    /** Warm sunlight or cool moonlight. */
    setNight(/** @type {boolean} */ night) { palette = night ? WINDOW_LIGHT_PALETTES.night : WINDOW_LIGHT_PALETTES.day; apply(); },
    /** Once per frame, time in seconds: moves the bird. */
    update: bird.update,
  };
}
