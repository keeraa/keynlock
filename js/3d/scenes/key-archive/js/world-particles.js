import * as THREE from '../vendor/three.js';

export function addDust(scene) {
  const positions = new Float32Array(270 * 3);
  const origins = new Float32Array(270 * 3);
  const drift = new Float32Array(270 * 3);
  let seed = 32;
  const next = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < positions.length; i += 3) {
    positions[i] = (next() - .5) * 22;
    positions[i + 1] = .5 + next() * 9;
    positions[i + 2] = (next() - .5) * 44;
    origins.set(positions.subarray(i, i + 3), i);
    drift[i] = next() * Math.PI * 2;
    drift[i + 1] = next() * Math.PI * 2;
    drift[i + 2] = next() * Math.PI * 2;
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
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const dust = new THREE.Points(geometry,
    new THREE.PointsMaterial({ color: 0xe4d6b3, map: sprite, alphaTest: .025,
      size: .064, transparent: true, opacity: .53, sizeAttenuation: true, depthWrite: false }));
  scene.add(dust);
  dust.update = now => {
    const t = now * .001;
    for (let i = 0; i < positions.length; i += 3) {
      positions[i] = origins[i] + Math.sin(t * .49 + drift[i]) * .33 + Math.sin(t * .23 + drift[i + 1]) * .17;
      positions[i + 1] = origins[i + 1] + Math.sin(t * .38 + drift[i + 1]) * .26;
      positions[i + 2] = origins[i + 2] + Math.cos(t * .43 + drift[i + 2]) * .38;
    }
    geometry.attributes.position.needsUpdate = true;
  };
  return dust;
}
