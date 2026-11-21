// @ts-check
import * as THREE from '../vendor/three.js';

// Each mesh gets only a tiny per-instance paint attribute. The indexed metal
// vertices, normals and UV buffers remain shared across every key condition.
export function createPaintedInstanceGeometry(source, count) {
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.userData.keyPaintInstanceWrapper = true;
  geometry.setIndex(source.index);
  for (const [name, attribute] of Object.entries(source.attributes))
    geometry.setAttribute(name, attribute);
  geometry.boundingBox = source.boundingBox?.clone() || null;
  geometry.boundingSphere = source.boundingSphere?.clone() || null;
  const paint = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
  paint.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('instanceKeyPaint', paint);
  return geometry;
}

export function keyPaintSeed(key) {
  let hash = 2166136261;
  const source = String(key.id ?? `${key.type}:${key.variation ?? 0}`);
  for (let i = 0; i < source.length; i++) {
    hash = Math.imul(hash ^ source.charCodeAt(i), 16777619);
  }
  return ((hash >>> 0) % 1000) / 20;
}

export function setKeyInstanceFinish(mesh, index, key, rustStrength = 1.35) {
  const paint = mesh.geometry.getAttribute('instanceKeyPaint');
  if (!paint || index < 0 || index >= paint.count)
    throw new RangeError('Missing instance paint slot');
  // Mud and wax are separate coat meshes (key-mud.js / key-wax.js); the
  // metal itself only carries rust and the pigment seed.
  paint.setXYZ(index, key.rust ? rustStrength : 0, 0, keyPaintSeed(key));
  paint.needsUpdate = true;
}

// Instance paint X for rust that is flaking off in patches: progress 0 keeps
// all of it, 1 has removed every patch (see the flake threshold in
// key-materials.js). Values from this base up are never a rust strength.
export const RUST_FLAKING_BASE = 10;
export function rustFlakingPaint(progress) {
  return RUST_FLAKING_BASE - .1 + Math.max(0, Math.min(1, progress)) * 1.25;
}
