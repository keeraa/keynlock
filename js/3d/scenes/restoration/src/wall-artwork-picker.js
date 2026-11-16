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

  function getProminentPainting(previousId = null) {
    if (!artworks.size) return null;
    camera.updateMatrixWorld();
    let winner = null;
    let bestScore = 0;
    let previousScore = 0;

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

      const visibleArea = (right - left) * (top - bottom);
      const dx = left > 0 ? left : right < 0 ? right : 0;
      const dy = bottom > 0 ? bottom : top < 0 ? top : 0;
      const score = visibleArea / (1 + 8 * (dx * dx + dy * dy));
      if (placement.id === previousId) previousScore = score;
      if (score > bestScore) { winner = placement; bestScore = score; }
    }

    if (bestScore <= .002) return null;
    // A small hysteresis prevents the information plaque flickering between frames.
    if (previousId && previousId !== winner?.id && previousScore * 1.12 >= bestScore) {
      return artworks.get(previousId)?.placement || winner;
    }
    return winner;
  }

  return { hitTest, getProminentPainting };
}
