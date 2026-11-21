// @ts-check
import { WINDOW_CENTERS, WINDOW_SILL_Y, WINDOW_SPRING_Y, WINDOW_CROWN_Y,
  WINDOW_OPENING_RADIUS, WINDOW_SCALE, windowY } from './hall-architecture.js';
import { RUG_TOP } from './floor-contact.js';

export const WINDOW_WALL_X = -11.86;
export const WINDOW_BEAM_SILL = windowY(WINDOW_SILL_Y);
export const WINDOW_BEAM_SPRING = windowY(WINDOW_SPRING_Y);
export const WINDOW_BEAM_CROWN = windowY(WINDOW_CROWN_Y);
export const WINDOW_BEAM_HALF_WIDTH = WINDOW_OPENING_RADIUS * WINDOW_SCALE;
export const WINDOW_BEAM_SLOPE = Object.freeze({
  y: ((WINDOW_BEAM_SILL + WINDOW_BEAM_CROWN) / 2 - RUG_TOP) / (.20 - WINDOW_WALL_X),
  z: 2 / (.20 - WINDOW_WALL_X),
});

const spacing = WINDOW_CENTERS[1] - WINDOW_CENTERS[0];
const bottom = WINDOW_BEAM_SILL - .16;
const rise = WINDOW_BEAM_CROWN - WINDOW_BEAM_SPRING;
const projectedWidth = (WINDOW_BEAM_CROWN - WINDOW_BEAM_SILL + .38) / WINDOW_BEAM_SLOPE.y;
export const WINDOW_WASHES = WINDOW_CENTERS.map(z => ({
  x: .20,
  z: z - 2,
  width: projectedWidth,
  depth: WINDOW_BEAM_HALF_WIDTH * 2.2 + projectedWidth * WINDOW_BEAM_SLOPE.z + .08,
}));

function smooth(a, b, value) {
  const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// Back-project the sample along the rays to the same arched window opening.
export function windowBeamLightAt(x, y, z) {
  const distance = x - WINDOW_WALL_X;
  const height = y + distance * WINDOW_BEAM_SLOPE.y;
  if (distance < 0 || height < bottom || height > WINDOW_BEAM_CROWN + .12) return 0;
  const entranceZ = z + distance * WINDOW_BEAM_SLOPE.z;
  const first = WINDOW_CENTERS[0];
  const window = Math.max(0, Math.min(WINDOW_CENTERS.length - 1, Math.round((entranceZ - first) / spacing)));
  const offset = Math.abs(entranceZ - WINDOW_CENTERS[window]);
  const arch = Math.max(0, (height - WINDOW_BEAM_SPRING) / rise);
  return smooth(bottom, WINDOW_BEAM_SILL + .22, height) *
    (1 - smooth(.72, 1.08, Math.hypot(offset / WINDOW_BEAM_HALF_WIDTH, arch))) *
    (.86 + .14 * smooth(.036, .15, offset));
}

const literal = x => x.toFixed(6);
export const WINDOW_BEAM_GLSL = `
  float archiveWindowLightAt(vec3 point) {
    float distance = point.x - (${literal(WINDOW_WALL_X)});
    float height = point.y + distance * ${literal(WINDOW_BEAM_SLOPE.y)};
    if (distance < 0.0 || height < ${literal(bottom)} ||
        height > ${literal(WINDOW_BEAM_CROWN + .12)}) return 0.0;
    float entranceZ = point.z + distance * ${literal(WINDOW_BEAM_SLOPE.z)};
    float windowIndex = clamp(floor((entranceZ - (${literal(WINDOW_CENTERS[0])})) /
      ${literal(spacing)} + .5), 0.0, ${literal(WINDOW_CENTERS.length - 1)});
    float offset = abs(entranceZ - ((${literal(WINDOW_CENTERS[0])}) + windowIndex * ${literal(spacing)}));
    float arch = max(0.0, (height - ${literal(WINDOW_BEAM_SPRING)}) / ${literal(rise)});
    return smoothstep(${literal(bottom)}, ${literal(WINDOW_BEAM_SILL + .22)}, height) *
      (1.0 - smoothstep(.72, 1.08, length(vec2(offset / ${literal(WINDOW_BEAM_HALF_WIDTH)}, arch)))) *
      (.86 + .14 * smoothstep(.036, .15, offset));
  }`;
