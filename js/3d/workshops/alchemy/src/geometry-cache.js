// @ts-check
// Reuse immutable GPU buffers for repeated furniture, stands and glass.
// Animated liquids and meshes that deform their geometry stay uncached.
export function createGeometryCache(THREE) {
  const cache = new Map();
  // Keep painted wood at a constant real-world scale on every board. A short
  // shelf samples a shorter part of the wash instead of squeezing all of it.
  const paintedWoodBox = (width, height, depth) => {
    const geometry = new THREE.BoxGeometry(width, height, depth);
    const positions = geometry.getAttribute('position');
    const normals = geometry.getAttribute('normal');
    const uv = geometry.getAttribute('uv');
    const paintUnit = 4.0;
    for (let i = 0; i < uv.count; i++) {
      const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
      const nx = Math.abs(normals.getX(i)), ny = Math.abs(normals.getY(i));
      if (ny > .5) uv.setXY(i, x / paintUnit, z / paintUnit);
      else if (nx > .5) uv.setXY(i, z / paintUnit, y / paintUnit);
      else uv.setXY(i, x / paintUnit, y / paintUnit);
    }
    uv.needsUpdate = true;
    return geometry;
  };
  const get = (key, create) => {
    if (!cache.has(key)) cache.set(key, create());
    return cache.get(key);
  };

  return {
    box: (width, height, depth) => get(`box:${width}:${height}:${depth}`,
      () => new THREE.BoxGeometry(width, height, depth)),
    woodBox: (width, height, depth) => get(`wood-box:${width}:${height}:${depth}`,
      () => paintedWoodBox(width, height, depth)),
    // CylinderGeometry's native angular seam points straight at the player
    // (+Z). Move it behind every post, valve, cage and burner component (-Z).
    cylinder: (top, bottom, height, segments = 32) => get(`cylinder:${top}:${bottom}:${height}:${segments}`,
      () => new THREE.CylinderGeometry(top, bottom, height, segments, 1, false, Math.PI)),
    torus: (radius, tube, segments = 64) => get(`torus:${radius}:${tube}:${segments}`,
      // Rings are rotated upright by the caller; their UV joins stay at -Z.
      () => new THREE.TorusGeometry(radius, tube, 8, segments).rotateZ(-Math.PI / 2)),
    glass: (radius, height, shape, profile) => get(`glass:${radius}:${height}:${shape}`,
      () => new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 64, Math.PI)),
    glassStreak: (shape, radius, height) => get(`streak:${shape}:${radius}:${height}`,
      () => new THREE.CylinderGeometry(
        shape === 'bottle' ? .412 : radius * 1.008,
        shape === 'bottle' ? .412 : radius * 1.008,
        shape === 'bottle' ? .49 : height - .57,
        64, 1, true, -Math.PI / 2 - .14, .105)),
    bottleLabel: () => get('bottle-label', () => new THREE.CylinderGeometry(.428, .428, .22, 36, 1, true, -.76, 1.52)),
    size: () => cache.size
  };
}
