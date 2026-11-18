import * as THREE from '../vendor/three.js';
import { bathVisualState, meltVisualIntensity } from './station-visual-state.js';

// Small reusable brush dabs; all effects are local to one workstation, without
// point lights, shadow maps, per-frame allocations or additional render passes.
export function createEffectSpotTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  gradient.addColorStop(0, 'rgba(255,249,218,.92)');
  gradient.addColorStop(.38, 'rgba(255,216,151,.62)');
  gradient.addColorStop(1, 'rgba(255,202,125,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

function paintPatchGeometry(seed) {
  const shape = new THREE.Shape();
  for (let index = 0; index <= 15; index++) {
    const theta = index / 15 * Math.PI * 2;
    const radius = .78 + .15 * Math.sin(index * 2.4 + seed) + .08 * Math.sin(index * 4.3 + seed);
    const px = Math.cos(theta) * radius;
    const py = Math.sin(theta) * radius;
    if (index === 0) shape.moveTo(px, py);
    else shape.lineTo(px, py);
  }
  return new THREE.ShapeGeometry(shape);
}

export function createBathEffects(group, x, kind, spotTexture) {
  const pigment = kind === 'mud' ? 0x998061 : 0xb47254;
  const surfaceY = 1.256;
  const patches = Array.from({ length: 4 }, (_, index) => {
    const material = new THREE.MeshBasicMaterial({ color: pigment, transparent: true,
      opacity: 0, depthWrite: false, side: THREE.DoubleSide });
    const patch = new THREE.Mesh(paintPatchGeometry(index * 1.7), material);
    patch.rotation.x = -Math.PI / 2;
    patch.position.set(x + Math.sin(index * 2.9) * .21, surfaceY + index * .0006,
      .10 + Math.cos(index * 2.9) * .19);
    patch.scale.set(.14 + (index % 2) * .055, .085 + (index % 3) * .025, 1);
    group.add(patch);
    return patch;
  });
  const ripples = Array.from({ length: 3 }, (_, index) => {
    const material = new THREE.MeshBasicMaterial({ color: kind === 'mud' ? 0xc7d4b7 : 0xe5bc92,
      transparent: true, opacity: 0, depthWrite: false });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.16, .009, 4, 28), material);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, surfaceY + .004 + index * .001, .10);
    group.add(ring);
    return ring;
  });
  const bubbles = Array.from({ length: 7 }, (_, index) => {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: spotTexture,
      color: kind === 'mud' ? 0xd0e0ce : 0xf2c499, transparent: true,
      opacity: 0, depthWrite: false }));
    sprite.position.set(x, surfaceY, .10);
    group.add(sprite);
    return sprite;
  });

  function update(now, keys, wallTime) {
    const state = bathVisualState(keys, kind, wallTime);
    const active = state.active > 0;
    patches.forEach((patch, index) => {
      patch.visible = active;
      if (!active) return;
      patch.material.opacity = (.11 + .15 * state.pigment) * (1 - index * .11);
      patch.rotation.z = Math.sin(now * .00035 + index * 2) * .10;
      const swell = 1 + Math.sin(now * .0013 + index) * .12;
      patch.scale.x = (.14 + (index % 2) * .055) * swell;
    });
    ripples.forEach((ring, index) => {
      ring.visible = active;
      if (!active) return;
      const phase = (now * .00032 + index / ripples.length) % 1;
      ring.scale.setScalar(.65 + phase * 1.55);
      ring.material.opacity = .33 * (1 - phase) * Math.min(1, state.active * .65);
    });
    bubbles.forEach((bubble, index) => {
      bubble.visible = active;
      if (!active) return;
      const phase = (now * (.00038 + (index % 3) * .00009) + index * .257) % 1;
      bubble.position.set(x + Math.sin(index * 5.6 + now * .0005) * .25,
        surfaceY + phase * .18, .10 + Math.cos(index * 3.6) * .22);
      const size = .035 + (index % 3) * .013;
      bubble.scale.set(size, size * (1 - phase * .35), 1);
      bubble.material.opacity = Math.sin(phase * Math.PI) * .58;
    });
  }
  return { update };
}

export function createForgeEffects(group, x, spotTexture, hotMetal) {
  const glows = Array.from({ length: 5 }, (_, index) => {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: spotTexture,
      color: index % 2 ? 0xf2ad59 : 0xe1aa77, transparent: true,
      opacity: 0, depthWrite: false }));
    group.add(sprite);
    return sprite;
  });
  const splash = new THREE.Mesh(new THREE.CircleGeometry(.34, 22),
    new THREE.MeshBasicMaterial({ color: 0xffc67a, transparent: true,
      opacity: 0, depthWrite: false }));
  splash.rotation.x = -Math.PI / 2;
  splash.position.set(x, 1.539, .08);
  group.add(splash);
  let impactAt = -Infinity;
  function ignite(now) { impactAt = now + 440; }
  function update(now) {
    const intensity = meltVisualIntensity(now, impactAt);
    splash.visible = intensity > .001;
    splash.material.opacity = intensity * .58;
    splash.scale.setScalar(1 + intensity * .42);
    hotMetal.opacity = .80 + .18 * intensity;
    glows.forEach((glow, index) => {
      glow.visible = intensity > .001;
      if (!glow.visible) return;
      const phase = Math.max(0, (now - impactAt) / 1500);
      const travel = (phase * (1.1 + index * .18) + index * .2) % 1;
      glow.position.set(x + Math.sin(index * 2.4 + now * .002) * (.08 + travel * .21),
        1.54 + travel * .52, .08 + Math.cos(index * 4.1) * (.08 + travel * .14));
      const size = .13 + (index % 3) * .045;
      glow.scale.set(size, size * 1.4, 1);
      glow.material.opacity = intensity * (1 - travel) * .82;
    });
  }
  return { ignite, update };
}
