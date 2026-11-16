import * as THREE from 'three';

// Wind sampling comes from the shared Village Engine wind-field module.
export function sampleGardenWind(time, power = .55) {
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const gust = .74 + .20 * Math.sin(time * .39 + .8) + .09 * Math.sin(time * 1.17 - .3) + .045 * Math.sin(time * 2.17);
  const strength = .8 * clamp(power, 0, 1.0) * clamp(gust, .35, 1.2);
  const direction = .67 + .24 * Math.sin(time * .13) + .12 * Math.sin(time * .29 + .4);
  return { strength, x: Math.cos(direction) * strength, z: Math.sin(direction) * strength };
}

/** Soft drifting dust, rendered as a single Three.js Points draw call. */
export function createAmbientParticles(parent, { count = 420, density = .64 } = {}) {
  let seed = 42;
  const random = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296);
  const base = new Float32Array(count * 3);
  const positions = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  const sizes = new Float32Array(count);
  const speeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const j = i * 3;
    base[j] = (random() - .5) * 15.6;
    base[j + 1] = .3 + random() * 12.6;
    base[j + 2] = -5.0 + random() * 11.9;
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
  const uniforms = { uTime: { value: 0 }, uScale: { value: .95 }, uOpacity: { value: .48 } };
  const material = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthTest: true, depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute float aPhase;
      attribute float aSize;
      uniform float uTime;
      uniform float uScale;
      varying float vFade;
      void main() {
        vec4 eye = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * eye;
        gl_PointSize = clamp(uScale * (70.0 / max(1.0, -eye.z)) * aSize, 1.0, 7.5);
        vFade = .58 + .24 * sin(uTime * (.8 + aSize * .36) + aPhase);
      }
    `,
    fragmentShader: `
      uniform float uOpacity;
      varying float vFade;
      void main() {
        float r = length(gl_PointCoord - .5) * 2.0;
        float halo = 1.0 - smoothstep(.08, 1.0, r);
        gl_FragColor = vec4(.95, .81, .60, halo * halo * uOpacity * vFade);
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
  function update(time) {
    const wind = sampleGardenWind(time, .38);
    uniforms.uTime.value = time;
    for (let i = 0; i < count; i++) {
      const j = i * 3, phase = phases[i];
      positions[j] = base[j] + .18 * Math.sin(time * .29 + phase) + wind.x * .53 * Math.sin(time * .18 + phase);
      positions[j + 1] = .25 + ((base[j + 1] - .25 + time * speeds[i]) % 12.7);
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
  return { points, update, setDensity, setEnabled: value => { points.visible = Boolean(value); }, dispose };
}
