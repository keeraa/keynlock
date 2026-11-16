/** Pointer hits and camera-driven artwork selection share the same framed meshes. */
export function createWallArtworkPicker({ THREE, camera, renderer, artworks, imageMeshes }) {
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const corner = new THREE.Vector3();
  const viewCenter = new THREE.Vector3();

  function hitTest(event) {
    if (!imageMeshes.length) return null;
    const bounds = renderer.domElement.getBoundingClientRect();
    pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1,
      -(event.clientY - bounds.top) / bounds.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(imageMeshes, false)[0];
    return hit ? artworks.get(hit.object.userData.galleryId)?.placement || null : null;
  }

  function getProminentPainting(previousId = null, { minFrameFraction = 0 } = {}) {
    if (!artworks.size) return null;
    camera.updateMatrixWorld();
    let winner = null;
    let bestScore = 0;
    let previousScore = 0;
    const candidates = new Map();

    for (const { image, placement } of artworks.values()) {
      image.updateWorldMatrix(true, false);
      viewCenter.set(0, 0, 0).applyMatrix4(image.matrixWorld)
        .applyMatrix4(camera.matrixWorldInverse);
      if (viewCenter.z >= -camera.near) continue;

      const halfWidth = placement.width / 2;
      const halfHeight = placement.height / 2;
      let left = Infinity, right = -Infinity, bottom = Infinity, top = -Infinity;
      for (const x of [-halfWidth, halfWidth]) {
        for (const y of [-halfHeight, halfHeight]) {
          corner.set(x, y, 0).applyMatrix4(image.matrixWorld).project(camera);
          left = Math.min(left, corner.x);
          right = Math.max(right, corner.x);
          bottom = Math.min(bottom, corner.y);
          top = Math.max(top, corner.y);
        }
      }
      left = Math.max(-1, left);
      right = Math.min(1, right);
      bottom = Math.max(-1, bottom);
      top = Math.min(1, top);
      if (left >= right || bottom >= top) continue;

      const frameFraction = Math.max((right - left) / 2, (top - bottom) / 2);
      const visibleArea = (right - left) * (top - bottom);
      const dx = left > 0 ? left : right < 0 ? right : 0;
      const dy = bottom > 0 ? bottom : top < 0 ? top : 0;
      const centerGapSquared = dx * dx + dy * dy;
      // A painting near the screen center can be smaller than one at the edge.
      // Large peripheral paintings should never steal its description.
      if (centerGapSquared > .12) continue;
      const requiredFraction = minFrameFraction * (centerGapSquared < .025 ? .6 : 1)
        * (placement.id === previousId ? .9 : 1);
      if (frameFraction < requiredFraction) continue;

      const score = 1 / (1 + 60 * centerGapSquared) + visibleArea * .015;
      candidates.set(placement.id, { placement, score });
      if (placement.id === previousId) previousScore = score;
      if (score > bestScore) { winner = placement; bestScore = score; }
    }

    // Exact center-ray hit takes priority, even if another painting occupies
    // more total pixels. Its mesh was already updated in the projection loop.
    raycaster.setFromCamera(pointer.set(0, 0), camera);
    const centerHit = raycaster.intersectObjects(imageMeshes, false)[0];
    if (centerHit) return candidates.get(centerHit.object.userData.galleryId)?.placement || null;
    if (!winner) return null;
    // A small hysteresis prevents the information plaque flickering between frames.
    if (previousId && previousId !== winner?.id && previousScore * 1.12 >= bestScore) {
      return artworks.get(previousId)?.placement || winner;
    }
    return winner;
  }

  return { hitTest, getProminentPainting };
}
