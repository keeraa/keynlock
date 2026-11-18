// Fallback for embedded browsers that do not grant Pointer Lock.
// Near a screen edge, keep the camera turning briefly instead of hitting a hard stop.
export function edgeLookRate(position, size, threshold = 56) {
  if (!Number.isFinite(position) || !Number.isFinite(size) || size <= 0) return 0;
  const zone = Math.min(threshold, size / 4);
  if (position < zone) return Math.max(-1, (position - zone) / zone);
  if (position > size - zone) return Math.min(1, (position - (size - zone)) / zone);
  return 0;
}
