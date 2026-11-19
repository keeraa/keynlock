// Hand sway should respond to walking over several frames, never jump on the
// first step. This also smooths the return to idle after releasing movement.
export function nextHandMotionWeight(current, moving, seconds) {
  const elapsed = Math.max(0, Math.min(.1, seconds));
  const target = moving ? 1 : 0;
  return current + (target - current) * (1 - Math.exp(-elapsed / .19));
}

// The throw starts immediately from this camera-local right-hand position.
export const RIGHT_HAND_RELEASE = Object.freeze({
  x: .43, y: -.45, z: -.82,
  rotationX: -.12, rotationY: -.34, rotationZ: -.53,
});
