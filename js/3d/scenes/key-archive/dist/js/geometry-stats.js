// Scene geometry counts, independent of extra outline and fullscreen passes.
export function getSceneGeometryStats(scene) {
  let triangles = 0;
  scene.traverse(object => {
    if (!object.isMesh || !object.visible || object.userData?.inkOutlineShell) return;
    if (object.material?.opacity === 0 || object.material?.visible === false) return;
    let parent = object.parent;
    while (parent) {
      if (!parent.visible) return;
      parent = parent.parent;
    }
    const geometry = object.geometry;
    const vertices = geometry?.index?.count ?? geometry?.attributes?.position?.count ?? 0;
    triangles += Math.floor(vertices / 3) * (object.isInstancedMesh ? object.count : 1);
  });
  // Three.js renders triangulated BufferGeometry, so all its polygons are triangles.
  return { polygons: triangles, triangles };
}

// Scene geometry rarely changes; HUD polling should not traverse it repeatedly.
export function createSceneGeometryStatsCache(scene) {
  let dirty = true;
  let snapshot = null;
  return {
    invalidate() { dirty = true; },
    get() {
      if (dirty) {
        snapshot = getSceneGeometryStats(scene);
        dirty = false;
      }
      return snapshot;
    },
  };
}
