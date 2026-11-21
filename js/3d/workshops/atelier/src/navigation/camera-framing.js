// @ts-check
/** Camera destinations and framing bounds shared by every navigation mode. */
export function createCameraFraming({ THREE, camera, controls, easelX,
  getPaintingCenterY, getWallBounds, easelOffsetZ = 0 }) {
  const EASEL_DISTANCE = { portrait: 10.7, medium: 9.4, wide: 8.25, ultrawide: 7.65 };
  const WALL_DEPTH = -4.3;
  const WALL_MARGIN = 1.08;

  function easelDistance() {
    return camera.aspect < 1.24 ? EASEL_DISTANCE.portrait
      : camera.aspect < 1.6 ? EASEL_DISTANCE.medium
        : camera.aspect < 2.1 ? EASEL_DISTANCE.wide : EASEL_DISTANCE.ultrawide;
  }

  function easelOverview() {
    const y = getPaintingCenterY();
    return { position: new THREE.Vector3(0, y + .4, easelDistance() + easelOffsetZ),
      target: new THREE.Vector3(0, y, easelOffsetZ) };
  }

  function easelFocus(side, preserveZoom = false) {
    const x = side === 'original' ? -easelX : easelX;
    const z = camera.aspect < 1.3 ? 4.75 : 4.43;
    const target = new THREE.Vector3(x, getPaintingCenterY(), .39 + easelOffsetZ);
    if (preserveZoom) {
      return { position: target.clone().add(camera.position.clone().sub(controls.target)), target };
    }
    // Arrive inside the polar limits so OrbitControls will never snap on re-enable.
    const distanceZ = z + easelOffsetZ - target.z;
    const lowestY = target.y + distanceZ / Math.tan(controls.maxPolarAngle - .025);
    const highestY = target.y + distanceZ / Math.tan(controls.minPolarAngle + .025);
    const y = THREE.MathUtils.clamp(2.02, lowestY, highestY);
    return { position: new THREE.Vector3(x, y, z + easelOffsetZ), target };
  }

  function verticalFov() { return THREE.MathUtils.degToRad(camera.fov); }

  function galleryDistance() {
    const bounds = getWallBounds();
    const height = Math.max(3, bounds.maxY - bounds.minY);
    return Math.max(8, height * WALL_MARGIN / (2 * Math.tan(verticalFov() / 2)));
  }

  function galleryVisibleWidth(distance = galleryDistance()) {
    const bounds = getWallBounds();
    return Math.min(bounds.width, 2 * distance * Math.tan(verticalFov() / 2) * camera.aspect);
  }

  function clampGalleryX(x, distance = galleryDistance()) {
    const bounds = getWallBounds();
    const inset = galleryVisibleWidth(distance) / 2;
    const minX = bounds.minX ?? -bounds.width / 2;
    const maxX = bounds.maxX ?? bounds.width / 2;
    // Keep valid bounds if a very narrow or incomplete wall is supplied.
    if (minX + inset > maxX - inset) return (minX + maxX) / 2;
    return THREE.MathUtils.clamp(x, minX + inset, maxX - inset);
  }

  function galleryOverview(centerX = null) {
    const bounds = getWallBounds();
    const distance = galleryDistance();
    const centerY = (bounds.minY + bounds.maxY) / 2;
    const minX = bounds.minX ?? -bounds.width / 2;
    const x = clampGalleryX(centerX ?? minX + galleryVisibleWidth(distance) / 2, distance);
    const target = new THREE.Vector3(x, centerY, WALL_DEPTH);
    return { position: new THREE.Vector3(x, centerY, WALL_DEPTH + distance), target };
  }

  function galleryArtwork(art) {
    if (!art) return galleryOverview();
    const horizontalFov = 2 * Math.atan(Math.tan(verticalFov() / 2) * camera.aspect);
    const distance = Math.max(2.2,
      art.height / (2 * Math.tan(verticalFov() / 2) * .72),
      art.width / (2 * Math.tan(horizontalFov / 2) * .75));
    const target = new THREE.Vector3(art.x, art.y, WALL_DEPTH);
    return { position: new THREE.Vector3(art.x, art.y, WALL_DEPTH + Math.min(14, distance)), target };
  }

  function galleryStep(direction, pose) {
    const bounds = getWallBounds();
    const distance = pose.position.distanceTo(pose.target);
    const x = clampGalleryX(pose.target.x + direction * (bounds.columnWidth || 2.5) * 2.4, distance);
    const offset = x - pose.target.x;
    return { position: pose.position.clone().add(new THREE.Vector3(offset, 0, 0)),
      target: pose.target.clone().add(new THREE.Vector3(offset, 0, 0)) };
  }

  function clampGalleryPose() {
    const bounds = getWallBounds();
    const clampedX = clampGalleryX(controls.target.x, camera.position.distanceTo(controls.target));
    const offsetX = clampedX - controls.target.x;
    const offsetY = Math.min(0, bounds.maxY - .4 - controls.target.y);
    if (Math.abs(offsetX) < .0001 && offsetY > -.0001) return false;
    camera.position.x += offsetX;
    camera.position.y += offsetY;
    controls.target.x += offsetX;
    controls.target.y += offsetY;
    camera.lookAt(controls.target);
    return true;
  }

  return { easelOverview, easelFocus, galleryDistance, galleryVisibleWidth,
    clampGalleryX, galleryOverview, galleryArtwork, galleryStep, clampGalleryPose };
}
