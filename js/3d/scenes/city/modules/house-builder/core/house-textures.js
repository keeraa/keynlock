import {HOUSE_TEXTURE_DEFINITIONS} from './house-texture-assets.js';

// All reference houses in a scene share one set of painted and loaded maps.
// Materials remain per building so each facade can have its own tint.
const cacheByThree = new WeakMap();

function createBucket(THREE, createFallback) {
  const bucket = {
    refs: 0,
    listeners: new Set(),
    resources: new Set(),
    active: {},
    disposed: false,
    loads: 0,
  };
  for (const kind of ['plaster', 'roof', 'wood']) {
    const texture = createFallback(THREE, kind);
    bucket.active[kind] = texture;
    if (texture) bucket.resources.add(texture);
  }
  bucket.active.shutter = bucket.active.wood;
  bucket.active.door = bucket.active.wood;

  if (typeof document !== 'undefined') {
    const loader = new THREE.TextureLoader();
    for (const [key, filename, repeat] of HOUSE_TEXTURE_DEFINITIONS) {
      const url = new URL(`../../../assets/house-textures/${filename}`, import.meta.url).href;
      const texture = loader.load(url, loaded => {
        if (bucket.disposed) return;
        bucket.active[key] = loaded;
        for (const materials of bucket.listeners) {
          materials[key].map = loaded;
          if (key === 'damage') materials.damage.opacity = .94;
          materials[key].needsUpdate = true;
        }
      }, undefined, error => console.warn(`Не удалось загрузить фактуру ${filename}`, error));
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = texture.wrapT = ['glass', 'damage', 'roof', 'shutter', 'door'].includes(key)
        ? THREE.ClampToEdgeWrapping
        : key === 'stoneBand' ? THREE.RepeatWrapping : THREE.MirroredRepeatWrapping;
      texture.repeat.set(...(Array.isArray(repeat) ? repeat : [repeat, repeat]));
      texture.anisotropy = 4;
      bucket.resources.add(texture);
      bucket.loads++;
    }
  }
  return bucket;
}

export function acquireHouseTextures(THREE, createFallback) {
  let bucket = cacheByThree.get(THREE);
  if (!bucket) {
    bucket = createBucket(THREE, createFallback);
    cacheByThree.set(THREE, bucket);
  }
  bucket.refs++;
  let attached = null;
  let released = false;
  return {
    attach(materials) {
      if (released) return;
      if (attached) bucket.listeners.delete(attached);
      attached = materials;
      bucket.listeners.add(materials);
      for (const kind of ['plaster', 'roof', 'wood', 'damage', 'shutter', 'door', 'glass', 'sill', 'stoneBand']) {
        materials[kind].map = bucket.active[kind] || null;
        if (kind === 'damage' && bucket.active.damage) materials.damage.opacity = .94;
        materials[kind].needsUpdate = true;
      }
    },
    release() {
      if (released) return;
      released = true;
      if (attached) bucket.listeners.delete(attached);
      if (--bucket.refs !== 0) return;
      bucket.disposed = true;
      for (const texture of bucket.resources) texture.dispose();
      bucket.resources.clear();
      bucket.listeners.clear();
      cacheByThree.delete(THREE);
    },
  };
}

export function houseTextureCacheStats(THREE) {
  const bucket = cacheByThree.get(THREE);
  return {houses:bucket?.refs||0,textures:bucket?.resources.size||0,imageLoads:bucket?.loads||0};
}
