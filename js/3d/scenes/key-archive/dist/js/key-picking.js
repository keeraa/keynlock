// Tight ground-level interaction zone, independent of the visible key mesh.
export function findFloorKeyAtReticle(eye, forward, keys, isThrowing = () => false, options = {}) {
  const { radius = .34 * .7, reach = 4.7, ground = .10 } = options;
  if (forward.y >= -.04) return null;
  const distance = (ground - eye.y) / forward.y;
  if (!Number.isFinite(distance) || distance <= .35 || distance > reach) return null;
  const x = eye.x + forward.x * distance;
  const z = eye.z + forward.z * distance;
  let bestDistance = radius * radius;
  let closest = null;
  for (const key of options.index ? options.index.nearby(x, z, radius) : keys) {
    if (key.status !== 'floor' || isThrowing(key.id)) continue;
    const squared = (key.x - x) ** 2 + (key.z - z) ** 2;
    if (squared < bestDistance) {
      bestDistance = squared;
      closest = key;
    }
  }
  return closest;
}
