// Public API for the key forge and future scenes that reuse its key assets.
export { KEY_TEMPLATES, METALS, BROTHERHOOD_KEYS, brotherhoodBinding,
  RUST_TEXTURE, keyAssetUrl, defaultDesign, fixedMetal, normalizeKeyDesign } from './key-data.js';
export { bowPoints, bladeProfile, bladeSections, keyBreakX, keyBreakAngle, keyBounds, shaftStartX } from './key-shapes.js';
export { createKeyModel, updateKeyPaint, disposeKeyModel } from './key-geometry.js';
export { getKeyAnchors, createKeyPlacementMatrix } from './key-placement.js';
export { preloadKeyTextures } from './key-materials.js';
export { createInstancedKeyCollection, getKeyInstance, keyInstanceFromIntersection,
  selectKeyInstance, moveKeyInstance, setKeyInstanceRust, removeKeyInstance,
  disposeInstancedKeyCollection } from './key-instances.js';
export { keyIconSvg, keyPreviewSvg } from './key-svg.js';

