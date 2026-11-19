// Hand sway should respond to walking over several frames, never jump on the
// first step. This also smooths the return to idle after releasing movement.
export function nextHandMotionWeight(current, moving, seconds) {
  const elapsed = Math.max(0, Math.min(.1, seconds));
  const target = moving ? 1 : 0;
  return current + (target - current) * (1 - Math.exp(-elapsed / .19));
}

export const THROW_WINDUP_SECONDS = .23;
export const THROW_FOLLOWTHROUGH_SECONDS = .13;
export const THROW_RELEASE_SECONDS = THROW_WINDUP_SECONDS + THROW_FOLLOWTHROUGH_SECONDS;

// Camera-local pose of the key held in the player's right hand. Pull the hand
// back first, then drive it sharply forward; the flight begins at this point.
export function sampleThrowHand(seconds) {
  const t=Math.max(0,seconds);
  const wind=Math.min(1,t/THROW_WINDUP_SECONDS);
  const windEase=wind*wind*(3-2*wind);
  const thrust=Math.min(1,Math.max(0,(t-THROW_WINDUP_SECONDS)/THROW_FOLLOWTHROUGH_SECONDS));
  const thrustEase=1-(1-thrust)**3;
  return {
    x:.43+.21*windEase-.18*thrustEase,
    y:-.45-.17*windEase+.25*thrustEase,
    z:-.82+.23*windEase-.38*thrustEase,
    rotationX:-.12+.34*windEase-.49*thrustEase,
    rotationY:-.34,
    rotationZ:-.53-.53*windEase+.88*thrustEase,
    released:t>=THROW_RELEASE_SECONDS,
  };
}
