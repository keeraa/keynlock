// Deterministic arc and a damped bounce, shared by WebGL and Canvas renderers.
export const THROW_FLIGHT_SECONDS = .72;
export const THROW_BOUNCE_SECONDS = .34;
export const THROW_SLIDE_SECONDS = .75;
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
    const horizontal = f * .79;
    return {
      x: start.x + (end.x - start.x) * horizontal,
      y: start.y + verticalSpeed * t - g * t * t / 2,
      z: start.z + (end.z - start.z) * horizontal,
      spin: f * Math.PI * 2,
      landed: false,
    };
  }
  if (t <= THROW_FLIGHT_SECONDS + THROW_BOUNCE_SECONDS) {
    const bounce = (t - THROW_FLIGHT_SECONDS) / THROW_BOUNCE_SECONDS;
    const horizontal = .79 + .13 * bounce;
    return {
      x: start.x + (end.x - start.x) * horizontal,
      y: end.y + Math.sin(Math.PI * bounce) * .16 * (1 - bounce),
      z: start.z + (end.z - start.z) * horizontal,
      spin: Math.PI * 2 + Math.sin(bounce * Math.PI * 2) * .17 * (1 - bounce),
      landed: false,
    };
  }
  const slide = (t - THROW_FLIGHT_SECONDS - THROW_BOUNCE_SECONDS) / THROW_SLIDE_SECONDS;
  const easing = 1 - (1 - slide) ** 3;
  const horizontal = .92 + .08 * easing;
  const wobble = (1 - slide) ** 2;
  return {
    x: start.x + (end.x - start.x) * horizontal,
    y: end.y + Math.abs(Math.sin(slide * Math.PI * 4)) * .018 * wobble,
    z: start.z + (end.z - start.z) * horizontal,
    spin: Math.PI * 2 + Math.sin(slide * Math.PI * 4) * .13 * wobble,
    landed: false,
  };
}
