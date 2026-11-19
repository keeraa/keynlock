// One continuous inertial trajectory, with two diminishing floor rebounds.
// The same positions and timing drive Three.js and the Canvas fallback.
export const THROW_FLIGHT_SECONDS = .82;
export const THROW_BOUNCE_SECONDS = .62;
export const THROW_SLIDE_SECONDS = .65;
export const THROW_SPIN_DELAY_SECONDS = .18;
export const THROW_DURATION = THROW_FLIGHT_SECONDS + THROW_BOUNCE_SECONDS + THROW_SLIDE_SECONDS;

export function sampleThrow(start, end, seconds) {
  const t = Math.max(0, seconds);
  if (t >= THROW_DURATION) {
    return { x: end.x, y: end.y, z: end.z, spin: Math.PI * 2, landed: true };
  }
  if (t <= THROW_FLIGHT_SECONDS) {
    const g = 9.8;
    const verticalSpeed = (end.y - start.y + g * THROW_FLIGHT_SECONDS ** 2 / 2) / THROW_FLIGHT_SECONDS;
    const f = t / THROW_FLIGHT_SECONDS;
    const horizontal = f * .74;
    return {
      x: start.x + (end.x - start.x) * horizontal,
      y: start.y + verticalSpeed * t - g * t * t / 2,
      z: start.z + (end.z - start.z) * horizontal,
      // The key travels forward first; the tumbling begins after release.
      spin: Math.PI * 2 * Math.pow(Math.max(0,
        (t - THROW_SPIN_DELAY_SECONDS) / (THROW_FLIGHT_SECONDS - THROW_SPIN_DELAY_SECONDS)), 1.15),
      landed: false,
    };
  }
  if (t <= THROW_FLIGHT_SECONDS + THROW_BOUNCE_SECONDS) {
    const bounce = (t - THROW_FLIGHT_SECONDS) / THROW_BOUNCE_SECONDS;
    const horizontal = .74 + .19 * bounce;
    const firstBounce = bounce < .60
      ? Math.sin(Math.PI * bounce / .60) * .22 * (1 - bounce * .25) : 0;
    const secondBounce = bounce >= .60
      ? Math.sin(Math.PI * (bounce - .60) / .40) * .085 : 0;
    return {
      x: start.x + (end.x - start.x) * horizontal,
      y: end.y + firstBounce + secondBounce,
      z: start.z + (end.z - start.z) * horizontal,
      spin: Math.PI * 2 + Math.sin(bounce * Math.PI * 3.3) * .18 * (1 - bounce),
      landed: false,
    };
  }
  const slide = (t - THROW_FLIGHT_SECONDS - THROW_BOUNCE_SECONDS) / THROW_SLIDE_SECONDS;
  const easing = 1 - (1 - slide) ** 3;
  const horizontal = .93 + .07 * easing;
  const wobble = (1 - slide) ** 2;
  return {
    x: start.x + (end.x - start.x) * horizontal,
    y: end.y + Math.abs(Math.sin(slide * Math.PI * 3)) * .012 * wobble,
    z: start.z + (end.z - start.z) * horizontal,
    spin: Math.PI * 2 + Math.sin(slide * Math.PI * 4) * .13 * wobble,
    landed: false,
  };
}
