import { KEY_REACH, KEY_PICK_HALF_LENGTH, KEY_PICK_RADIUS } from './interaction-range.js';

// A rotated capsule follows the visible key from bow to teeth, rather than
// requiring the reticle to pass through an invisible point at its centre.
export function findFloorKeyAtReticle(eye, forward, keys, isThrowing = () => false, options = {}) {
  const { radius = KEY_PICK_RADIUS, halfLength = KEY_PICK_HALF_LENGTH,
    reach = KEY_REACH, ground = 0 } = options;
  const magnitude = Math.hypot(forward.x, forward.y, forward.z);
  if (magnitude === 0 || forward.y / magnitude >= -.04) return null;
  const distance = (ground - eye.y) * magnitude / forward.y;
  if (!Number.isFinite(distance) || distance <= .35 || distance > reach) return null;
  const x = eye.x + forward.x / magnitude * distance;
  const z = eye.z + forward.z / magnitude * distance;
  let bestDistance = radius * radius;
  let closest = null;
  const searchRadius = radius + halfLength;
  for (const key of options.index ? options.index.nearby(x, z, searchRadius) : keys) {
    if (key.status !== 'floor' || isThrowing(key.id)) continue;
    const rotation = key.rotation || 0;
    const axisX = Math.sin(rotation);
    const axisZ = Math.cos(rotation);
    const along = Math.max(-halfLength, Math.min(halfLength,
      (x - key.x) * axisX + (z - key.z) * axisZ));
    const squared = (key.x + axisX * along - x) ** 2 +
      (key.z + axisZ * along - z) ** 2;
    if (squared < bestDistance) {
      bestDistance = squared;
      closest = key;
    }
  }
  return closest;
}
