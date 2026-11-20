// Single seam between the archive and its key asset implementation.
// A future key-constructor adapter can be installed before createWorld().
// Geometry convention: head at +Y, teeth at -Y, key face toward +Z,
// and dimensions in the original archive's world units.
import {
  createKeyModel as legacyModel,
  createCombinedKeyGeometry as legacyGeometry,
  createBowGlyph as legacyGlyph,
  keyHeadPoints as legacyHeadPoints,
} from './art.js?v=key-ring';
import * as THREE from '../vendor/three.js';
import { getKeyPaint as legacyPaint, METAL_BY_KEY_TYPE } from './painted-textures.js';

const legacyMaterials = new Map();

const legacyProvider = Object.freeze({
  createModel: (type, options) => legacyModel(type, options),
  getGeometry: (type, { broken = false } = {}) => legacyGeometry(type, broken),
  createGlyph: type => legacyGlyph(type),
  getPaint: type => legacyPaint(type),
  getMetal: type => METAL_BY_KEY_TYPE[type],
  getColliderSize: () => [0.43, 0.21, 0.65],
  getDisplayScale: mode => ({ floor: .455, hand: .52, cabinet: .185, bath: .22 })[mode] ?? 1,
  getFallbackHeadPoints: type => legacyHeadPoints(type),
  createFallbackStamp: () => null,
});

const REQUIRED_METHODS = [
  'createModel', 'getGeometry', 'createGlyph', 'getPaint', 'getMetal',
  'getColliderSize', 'getDisplayScale', 'getFallbackHeadPoints', 'createFallbackStamp',
];
let provider = legacyProvider;
let used = false;

export function installKeyAssetProvider(next) {
  if (used) throw new Error('Key provider must be installed before the archive scene is built');
  if (!next || REQUIRED_METHODS.some(method => typeof next[method] !== 'function'))
    throw new TypeError(`Key provider requires: ${REQUIRED_METHODS.join(', ')}`);
  provider = next;
}

function active() { used = true; return provider; }

export function createKeyModel(type, options = {}) {
  const model = active().createModel(type, options);
  if (!model?.isObject3D) throw new TypeError('Key provider must return a THREE.Object3D model');
  return model;
}
export function disposeKeySceneModel(model) { active().disposeModel?.(model); }
export function createCombinedKeyGeometry(type, broken = false) {
  const geometry = active().getGeometry(type, { broken });
  if (!geometry?.isBufferGeometry) throw new TypeError('Key provider must return THREE.BufferGeometry');
  return geometry;
}
export function createBowGlyph(type) { return active().createGlyph(type); }
export function getKeyPaint(type) { return active().getPaint(type); }
// Optional paint/edge extension. Existing scene providers keep working.
export function getKeyMaterial(type) {
  const instance = active();
  if (instance.getMaterial) return instance.getMaterial(type);
  if (!legacyMaterials.has(type)) legacyMaterials.set(type,
    new THREE.MeshStandardMaterial({ map: instance.getPaint(type), color: 0xf5e5d0,
      metalness: .28, roughness: .78 }));
  return legacyMaterials.get(type);
}
// kind: 'mud' (dried clods) or 'wax' (candle coat).
export function getKeyCrustGeometry(type, broken = false, kind = 'mud') {
  return active().getCrustGeometry?.(type, { broken, kind }) || null;
}
export function getKeyCrustMaterial(kind = 'mud') { return active().getCrustMaterial?.(kind) || null; }
// Cleaning animations (optional provider features; null when unsupported).
export function getKeyCoatLayout(type, broken = false, kind = 'mud') {
  return active().getCoatLayout?.(type, broken, kind) || null;
}
export function buildKeyCoatGeometry(type, broken = false, kind = 'mud', options = {}) {
  return active().buildCoatGeometry?.(type, broken, kind, options) || null;
}
export function getKeyCoatPoint(type, broken, x, y, z = 0) {
  return active().getCoatPoint?.(type, broken, x, y, z) || null;
}
export function getKeyRustStrength(type) { return active().getRustStrength?.(type) ?? 1.35; }
export function getKeyMetal(type) { return active().getMetal(type); }
// Optional per-family pigment for new forge finishes; legacy palette remains
// unchanged in every archive rendering context.
export function getKeyColor(type, context = 'floor') {
  const instance = active();
  if (typeof instance.getColor === 'function') return instance.getColor(type, context);
  if (context === 'cabinet') return 0xf4e7d3;
  if (context === 'bath') return 0xe6d1a8;
  return instance.getMetal(type) === 'steel' ? 0xe4ebf0 : 0xf5e5d0;
}
export function getKeyColliderSize(type) { return active().getColliderSize(type); }
export function getKeyDisplayScale(mode, type) { return active().getDisplayScale(mode, type); }
export function getKeyFallbackHeadPoints(type) { return active().getFallbackHeadPoints(type); }
export function createKeyFallbackStamp(type, broken) { return active().createFallbackStamp(type, broken); }

// Exposed for diagnostics; installation is intentionally one-way per page load.
export function getKeyProviderName() { return provider === legacyProvider ? 'archive-legacy' : 'external'; }
