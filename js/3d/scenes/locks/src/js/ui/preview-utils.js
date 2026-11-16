/** Shared GPU viewport and teardown for isolated tool previews. */

export function renderScissorPreview({ renderer, scene, camera, viewport, renderWidth, renderHeight }) {
  if (!viewport.visible) return null;
  const oldAutoClear = renderer.autoClear;
  renderer.setScissor(viewport.x, viewport.y, viewport.width, viewport.height);
  renderer.setViewport(viewport.x, viewport.y, viewport.width, viewport.height);
  renderer.setScissorTest(true);
  try {
    renderer.autoClear = false;
    // Retain the main scene's colors underneath the tool silhouettes.
    renderer.clearDepth();
    renderer.render(scene, camera);
    return renderer.info?.render ? { ...renderer.info.render } : null;
  } finally {
    renderer.autoClear = oldAutoClear;
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, renderWidth, renderHeight);
  }
}

/** Dispose only isolated preview scenes; shared wrench geometries belong to the lock. */
export function disposeOwnedPreviewScene(scene) {
  const geometries = new Set(), materials = new Set(), textures = new Set();
  scene.traverse(object => {
    if (!object.isMesh) return;
    if (object.geometry) geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (!material) continue;
      materials.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    }
  });
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
  for (const texture of textures) texture.dispose();
  for (const child of [...scene.children]) scene.remove(child);
}
