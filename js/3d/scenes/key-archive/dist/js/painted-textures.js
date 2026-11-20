import * as THREE from '../vendor/three.js';

// Original painted metal albedos shared with Keynlock's lock and workbench scenes.
export const PAINTED_METALS = Object.freeze({
  brass: './assets/painted-brass.webp',
  steel: './assets/painted-steel.webp',
  copper: './assets/painted-copper.webp',
  graphite: './assets/painted-graphite.webp',
  enamel: './assets/painted-enamel.webp',
  'garden-green': './assets/painted-green.webp',
});

export const METAL_BY_KEY_TYPE = Object.freeze([
  'brass', 'steel', 'brass', 'brass', 'steel',
  'brass', 'steel', 'brass', 'copper', 'brass',
]);

const sharedTextures = {};
const loader = new THREE.TextureLoader();

export function getPaintedMetalTexture(kind) {
  if (!PAINTED_METALS[kind]) return null;
  if (sharedTextures[kind]) return sharedTextures[kind];
  const texture = loader.load(PAINTED_METALS[kind], undefined, undefined,
    () => console.warn(`Не загружена гуашевая текстура ${kind}`));
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.MirroredRepeatWrapping;
  texture.repeat.set(.7, .7);
  texture.anisotropy = 4;
  sharedTextures[kind] = texture;
  return texture;
}

export function getPaintedMetalTextures() {
  // Existing callers may read the shared cache; loading remains demand-driven.
  return sharedTextures;
}

export function getKeyPaint(type) {
  return getPaintedMetalTexture(METAL_BY_KEY_TYPE[type]);
}
