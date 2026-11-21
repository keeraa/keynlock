// @ts-check
// Heights agree with the actual hall mesh, so keys and furniture rest on it.
export const HALL_FLOOR_TOP = -.19 + .28 / 2;
export const RUG_TOP = -.038 + .024 / 2;
export const KEY_REST_CLEARANCE = .016;

export function floorSurfaceY(x, z) {
  const overRug = Math.abs(x) <= 8 && z >= -18.65 && z <= 18.35;
  return overRug ? RUG_TOP : HALL_FLOOR_TOP;
}

export function restingKeyY(x, z) {
  return floorSurfaceY(x, z) + KEY_REST_CLEARANCE;
}
