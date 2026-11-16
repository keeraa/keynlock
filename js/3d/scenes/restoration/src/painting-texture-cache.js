/** Bounded LRU cache for painting textures, including in-flight loads. */
export function createPaintingTextureCache({ THREE, loader, renderer, limit = 8 }) {
  const entries = new Map();

  function load(art) {
    if (entries.has(art.image)) {
      const pending = entries.get(art.image);
      entries.delete(art.image);
      entries.set(art.image, pending);
      return pending;
    }

    const pending = loader.loadAsync(art.image).then((texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      return texture;
    }).catch((error) => {
      if (entries.get(art.image) === pending) entries.delete(art.image);
      throw error;
    });
    entries.set(art.image, pending);
    return pending;
  }

  function trim(keepImage) {
    while (entries.size > limit) {
      const oldestImage = entries.keys().next().value;
      const pending = entries.get(oldestImage);
      entries.delete(oldestImage);
      if (oldestImage === keepImage) {
        entries.set(oldestImage, pending);
        continue;
      }
      pending.then(texture => texture.dispose()).catch(() => {});
    }
  }

  return { load, trim };
}
