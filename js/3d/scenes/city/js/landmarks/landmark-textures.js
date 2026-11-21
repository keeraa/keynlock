// The six landmarks reuse the house-builder paintings. Keep one GPU copy of
// each painting while any landmark is alive, including during LOD switches.
import {LANDMARK_TEXTURE_ASSETS,gouacheAssetUrlByFile} from '../../modules/keynlock-materials/index.js';
export {LANDMARK_TEXTURE_ASSETS} from '../../modules/keynlock-materials/index.js';
const cacheByThree = new WeakMap();

function makeBucket(THREE) {
  const bucket = {refs: 0, maps: {}, loads: 0};
  if (typeof document === 'undefined') return bucket;
  const loader = new THREE.TextureLoader();
  for (const [kind, filename] of Object.entries(LANDMARK_TEXTURE_ASSETS)) {
    const map = loader.load(gouacheAssetUrlByFile('house',filename));
    map.colorSpace = THREE.SRGBColorSpace;
    // Roof UVs are expressed in real-world metres, so big theatre/palace
    // pitches repeat the painting instead of enlarging its individual tiles.
    map.wrapS = map.wrapT = kind === 'roof'
      ? THREE.RepeatWrapping
      : ['door', 'glass', 'sill'].includes(kind) ? THREE.ClampToEdgeWrapping : THREE.MirroredRepeatWrapping;
    // The bottom-edge decal tiles horizontally and fades to clear upward.
    if (kind === 'moss') map.wrapT = THREE.ClampToEdgeWrapping;
    if (kind === 'plaster') map.repeat.set(1.8, 1.8);
    // Masonry receives metre-scaled UVs in landmark-model; do not enlarge
    // the stone courses independently for each mesh.
    if (kind === 'stone') map.repeat.set(1, 1);
    map.anisotropy = 4;
    bucket.maps[kind] = map;
    bucket.loads++;
  }
  return bucket;
}

export function acquireLandmarkTextures(THREE) {
  let bucket = cacheByThree.get(THREE);
  if (!bucket) {
    bucket = makeBucket(THREE);
    cacheByThree.set(THREE, bucket);
  }
  bucket.refs++;
  let released = false;
  return {
    maps: bucket.maps,
    release() {
      if (released) return;
      released = true;
      if (--bucket.refs !== 0) return;
      for (const map of Object.values(bucket.maps)) map.dispose();
      cacheByThree.delete(THREE);
    },
  };
}

export function landmarkTextureCacheStats(THREE) {
  const bucket = cacheByThree.get(THREE);
  return {landmarks: bucket?.refs ?? 0, textures: Object.keys(bucket?.maps ?? {}).length, imageLoads: bucket?.loads ?? 0};
}
