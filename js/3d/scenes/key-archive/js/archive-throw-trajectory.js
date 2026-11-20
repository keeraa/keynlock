// A ballistic flight followed by two shorter rebounds and a frictional slide.
// Both renderers sample the same trajectory without accumulating frame deltas.
const GRAVITY = 9.81;
export const THROW_FIRST_BOUNCE_SECONDS = .24;
export const THROW_SECOND_BOUNCE_SECONDS = .12;
export const THROW_BOUNCE_SECONDS = THROW_FIRST_BOUNCE_SECONDS + THROW_SECOND_BOUNCE_SECONDS;
export const THROW_SLIDE_SECONDS = .28;
const FIRST_IMPACT_SPEED = .55;
const SECOND_IMPACT_SPEED = FIRST_IMPACT_SPEED * .70;
const SLIDE_SPEED = SECOND_IMPACT_SPEED * .68;

export function throwFlightTime(start, end) {
  const lift = start.lift ?? 1.15;
  const drop = Math.max(.02, start.y - end.y);
  return (lift + Math.sqrt(lift ** 2 + 2 * GRAVITY * drop)) / GRAVITY;
}

export function sampleThrow(start, end, seconds) {
  const flight = throwFlightTime(start, end);
  const afterImpact = Math.max(0, seconds - flight);
  const first = Math.min(afterImpact, THROW_FIRST_BOUNCE_SECONDS);
  const second = Math.min(Math.max(0, afterImpact - THROW_FIRST_BOUNCE_SECONDS), THROW_SECOND_BOUNCE_SECONDS);
  const slide = Math.min(Math.max(0, afterImpact - THROW_BOUNCE_SECONDS) / THROW_SLIDE_SECONDS, 1);
  const totalTravel = flight + FIRST_IMPACT_SPEED * THROW_FIRST_BOUNCE_SECONDS +
    SECOND_IMPACT_SPEED * THROW_SECOND_BOUNCE_SECONDS + SLIDE_SPEED * THROW_SLIDE_SECONDS / 2;
  const elapsedFlight = Math.min(Math.max(0, seconds), flight);
  const progress = (elapsedFlight + first * FIRST_IMPACT_SPEED + second * SECOND_IMPACT_SPEED +
    SLIDE_SPEED * THROW_SLIDE_SECONDS * (slide - slide ** 2 / 2)) / totalTravel;

  const settled = Math.min(1, elapsedFlight / flight);
  const settle = settled * settled * (3 - 2 * settled);
  const lift = start.lift ?? 1.15;
  const flightY = start.y + lift * elapsedFlight - GRAVITY * elapsedFlight ** 2 / 2;
  const firstArc = first * (THROW_FIRST_BOUNCE_SECONDS - first);
  const secondArc = second * (THROW_SECOND_BOUNCE_SECONDS - second);
  const y = seconds < flight ? flightY : end.y + GRAVITY / 2 * (firstArc + secondArc);
  const wobble = .11 * Math.sin(first / THROW_FIRST_BOUNCE_SECONDS * Math.PI) -
    .045 * Math.sin(second / THROW_SECOND_BOUNCE_SECONDS * Math.PI);
  const landed = slide >= 1;
  return {
    x: landed ? end.x : start.x + (end.x - start.x) * progress,
    y,
    z: landed ? end.z : start.z + (end.z - start.z) * progress,
    settle, contact: seconds >= flight, wobble: landed ? 0 : wobble, spin: landed ? 0 : (1 - settle) * -.55 + wobble, landed,
  };
}
