// @ts-check
// Keep the point initially grabbed under the pointer. Each vessel uses its
// own depth plane, so the bottle can be lowered back into its original rack.
export function beginSourceDrag(THREE, source, ray) {
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -source.original.z);
  const grabPoint = new THREE.Vector3();
  if (!ray.intersectPlane(plane, grabPoint)) return null;
  return { plane, offset: source.root.position.clone().sub(grabPoint) };
}

export function positionSourceDrag(THREE, source, drag, ray, target) {
  if (!drag || !ray.intersectPlane(drag.plane, target)) return false;
  target.add(drag.offset);
  target.set(
    THREE.MathUtils.clamp(target.x, -5.6, 5.6),
    THREE.MathUtils.clamp(target.y, source.original.y, 4.7),
    source.original.z
  );
  return true;
}
