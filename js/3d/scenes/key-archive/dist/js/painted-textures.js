import * as THREE from '../vendor/three.js';

// Original painted metal albedos shared with Keynlock's lock and workbench scenes.
export const PAINTED_METALS = Object.freeze({
  brass: './assets/painted-brass.webp',
  steel: './assets/painted-steel.webp',
  copper: './assets/painted-copper.webp',
  graphite: './assets/painted-graphite.webp',
  enamel: './assets/painted-enamel.webp',
});

export const METAL_BY_KEY_TYPE = Object.freeze([
  'brass', 'steel', 'brass', 'brass', 'steel',
  'brass', 'steel', 'brass', 'copper', 'brass',
]);

let sharedTextures;

export function getPaintedMetalTextures() {
  if (sharedTextures) return sharedTextures;
  const loader = new THREE.TextureLoader();
  sharedTextures = {};
  for (const [kind, url] of Object.entries(PAINTED_METALS)) {
    const texture = loader.load(url, undefined, undefined,
      () => console.warn(`Не загружена гуашевая текстура ${kind}`));
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.MirroredRepeatWrapping;
    texture.repeat.set(.7, .7);
    texture.anisotropy = 4;
    sharedTextures[kind] = texture;
  }
  return sharedTextures;
}

export function getKeyPaint(type) {
  return getPaintedMetalTextures()[METAL_BY_KEY_TYPE[type]];
}
