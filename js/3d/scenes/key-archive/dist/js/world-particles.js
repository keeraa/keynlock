import * as THREE from '../vendor/three.js';
import { dustOriginInWindowBeam, windowBeamLightAt } from './archive-window-rays.js';

export function addDust(scene) {
  const count = 840;
  const positions = new Float32Array(count * 3);
  const origins = new Float32Array(count * 3);
  const drift = new Float32Array(count * 3);
  const colors = new Float32Array(count * 4);
  const periods = new Float32Array(count);
  const phases = new Float32Array(count);
  const ambient = new THREE.Color(0xe4d6b3);
  const illuminated = new THREE.Color(0xe2eeff).multiplyScalar(1.4);
  const tint = new THREE.Color();
  let daylight = 0;
  let seed = 32;
  const next = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < positions.length; i += 3) {
    positions[i] = (next() - .5) * 22;
    positions[i + 1] = .5 + next() * 9;
    positions[i + 2] = (next() - .5) * 44;
    if (i < 228 * 3) positions.set(dustOriginInWindowBeam(i / 3, next), i);
    origins.set(positions.subarray(i, i + 3), i);
    drift[i] = next() * Math.PI * 2;
    drift[i + 1] = next() * Math.PI * 2;
    drift[i + 2] = next() * Math.PI * 2;
  }
  for (let particle = 0; particle < count; particle++) {
    periods[particle] = 8 + next() * 10;
    phases[particle] = next() * periods[particle];
  }
  // A feathered circular sprite prevents the default square point artifacts.
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 32;
  const context = canvas.getContext('2d');
  const radial = context.createRadialGradient(16, 16, 1, 16, 16, 16);
  radial.addColorStop(0, 'rgba(255,255,255,1)');
  radial.addColorStop(.65, 'rgba(255,255,255,.85)');
  radial.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = radial;
  context.fillRect(0, 0, 32, 32);
  const sprite = new THREE.CanvasTexture(canvas);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  const color = new THREE.BufferAttribute(colors, 4).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('color', color);
  const dust = new THREE.Points(geometry,
    new THREE.PointsMaterial({ vertexColors: true, map: sprite, alphaTest: .025,
      size: .0305, transparent: true, opacity: .61, sizeAttenuation: true, depthWrite: false,
      // Preserve normal color blending and record dust transmittance in scene alpha.
      blending: THREE.CustomBlending,
      blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    }));
  dust.renderOrder = 40;
  scene.add(dust);
  dust.setWindowDaylight = (value, color) => {
    daylight = value;
    illuminated.setHex(color).multiplyScalar(1.4);
  };
  dust.update = now => {
    const t = now * .001;
    for (let particle = 0; particle < count; particle++) {
      const period = periods[particle];
      const cycle = ((t + phases[particle]) % period) / period;
      const fade = Math.max(0, Math.min(1, (cycle - .08) / .12, (.97 - cycle) / .12));
      if (fade === 0) {
        colors[particle * 4 + 3] = 0;
        continue;
      }
      const visibility = fade * fade * (3 - 2 * fade);
      const i = particle * 3;
      positions[i] = origins[i] + Math.sin(t * .49 + drift[i]) * .33 + Math.sin(t * .23 + drift[i + 1]) * .17;
      positions[i + 1] = origins[i + 1] + Math.sin(t * .38 + drift[i + 1]) * .26;
      positions[i + 2] = origins[i + 2] + Math.cos(t * .43 + drift[i + 2]) * .38;
      const light = daylight && daylight * windowBeamLightAt(positions[i], positions[i + 1], positions[i + 2]);
      tint.copy(ambient).lerp(illuminated, light);
      color.setXYZW(particle, tint.r, tint.g, tint.b, (.63 + .37 * light) * visibility);
    }
    geometry.attributes.position.needsUpdate = true;
    color.needsUpdate = true;
  };
  return dust;
}
