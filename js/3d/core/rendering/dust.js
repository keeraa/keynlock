// @ts-check
import * as THREE from 'three';

// The game's one floating dust: soft specks that drift on a gentle wind and
// rise slowly through a box, drawn as a single Three.js Points call. The Lair
// fills the whole room with it; the Atelier and the alchemy lab use it on
// their own pages. A scene may light the specks (the Lair's window beam) by
// passing GLSL that defines `float dustLightAt(vec3 worldPosition)`.

/** A slow, gusty breeze (from the Village Engine's wind field). */
export function sampleGardenWind(time, power = .55) {
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const gust = .74 + .20 * Math.sin(time * .39 + .8) + .09 * Math.sin(time * 1.17 - .3) + .045 * Math.sin(time * 2.17);
  const strength = .8 * clamp(power, 0, 1.0) * clamp(gust, .35, 1.2);
  const direction = .67 + .24 * Math.sin(time * .13) + .12 * Math.sin(time * .29 + .4);
  return { strength, x: Math.cos(direction) * strength, z: Math.sin(direction) * strength };
}

const NO_LIGHT_GLSL = 'float dustLightAt(vec3 worldPosition) { return 0.0; }';

/**
 * @param {THREE.Object3D} parent
 * @param {{
 *   min: [number, number, number], max: [number, number, number],
 *   count?: number, density?: number, seed?: number, scale?: number, opacity?: number,
 *   light?: { glsl: string, uniforms?: Record<string, any>, tint?: THREE.ColorRepresentation, strength?: number } | null,
 * }} options  min/max: the box the dust fills, in parent space.
 */
export function createDust(parent, { min, max, count = 420, density = .64, seed = 42, scale = .95, opacity = .48, light = null }) {
  let state = seed >>> 0;
  const random = () => ((state = (1664525 * state + 1013904223) >>> 0) / 4294967296);
  const [x0, y0, z0] = min, [x1, y1, z1] = max;
  const rise = y1 - y0;
  const base = new Float32Array(count * 3);
  const positions = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  const sizes = new Float32Array(count);
  const speeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const j = i * 3;
    base[j] = x0 + random() * (x1 - x0);
    base[j + 1] = y0 + random() * rise;
    base[j + 2] = z0 + random() * (z1 - z0);
    positions.set(base.subarray(j, j + 3), j);
    phases[i] = random() * Math.PI * 2;
    sizes[i] = .55 + random() * .95;
    speeds[i] = .055 + random() * .105;
  }
  const geometry = new THREE.BufferGeometry();
  const position = new THREE.BufferAttribute(positions, 3);
  position.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', position);
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  const uniforms = {
    uTime: { value: 0 }, uScale: { value: scale }, uOpacity: { value: opacity },
    uLight: { value: light?.strength ?? 0 }, uLightTint: { value: new THREE.Color(light?.tint ?? '#fff1d0') },
    ...light?.uniforms,
  };
  const material = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthTest: true, depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute float aPhase;
      attribute float aSize;
      uniform float uTime;
      uniform float uScale;
      uniform float uLight;
      varying float vFade;
      varying float vBeam;
      ${light?.glsl ?? NO_LIGHT_GLSL}
      void main() {
        vBeam = uLight > 0.0 ? uLight * dustLightAt((modelMatrix * vec4(position, 1.0)).xyz) : 0.0;
        vec4 eye = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * eye;
        gl_PointSize = clamp(uScale * (70.0 / max(1.0, -eye.z)) * aSize, 1.0, 7.5);
        vFade = .58 + .24 * sin(uTime * (.8 + aSize * .36) + aPhase);
      }
    `,
    fragmentShader: `
      uniform float uOpacity;
      uniform vec3 uLightTint;
      varying float vFade;
      varying float vBeam;
      void main() {
        float r = length(gl_PointCoord - .5) * 2.0;
        float halo = 1.0 - smoothstep(.08, 1.0, r);
        vec3 color = mix(vec3(.95, .81, .60), uLightTint, min(1.0, vBeam));
        gl_FragColor = vec4(color, halo * halo * uOpacity * vFade * (1.0 + 1.8 * vBeam));
      }
    `,
  });
  const points = new THREE.Points(geometry, material);
  points.name = 'ambient-dust-engine';
  points.userData.atmosphere = true;
  points.frustumCulled = false;
  points.renderOrder = 3;
  parent.add(points);

  function setDensity(value) {
    const proportion = THREE.MathUtils.clamp(Number(value) || 0, 0, 1);
    geometry.setDrawRange(0, Math.round(proportion * count));
  }
  /** Move the specks to `time` (seconds). */
  function update(time) {
    const wind = sampleGardenWind(time, .38);
    uniforms.uTime.value = time;
    for (let i = 0; i < count; i++) {
      const j = i * 3, phase = phases[i];
      positions[j] = base[j] + .18 * Math.sin(time * .29 + phase) + wind.x * .53 * Math.sin(time * .18 + phase);
      positions[j + 1] = y0 + ((base[j + 1] - y0 + time * speeds[i]) % rise);
      positions[j + 2] = base[j + 2] + .16 * Math.cos(time * .22 + phase) + wind.z * .44 * Math.cos(time * .20 + phase);
    }
    position.needsUpdate = true;
  }
  function dispose() {
    parent.remove(points);
    geometry.dispose();
    material.dispose();
  }
  setDensity(density);
  return {
    points, update, setDensity, dispose,
    setEnabled: value => { points.visible = Boolean(value); },
    /** Window light on the specks: 0 none, 1 full. */
    setLight: value => { uniforms.uLight.value = Number(value) || 0; },
  };
}
