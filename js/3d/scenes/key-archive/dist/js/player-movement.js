import { ARCHIVE_SIDE_TABLES } from './archive-ledger.js';
import { PLAYER_EYE_HEIGHT } from './player-config.js';
import { inStationFootprint } from './station-layout.js';
import { CABINET_Z, CABINET_BODY_WIDTH } from './cabinet-layout.js';

// Wall candles beside the cabinets (archive-candles.js: CABINET_CANDLE_X and
// z = cabinet z ± (CABINET_BODY_WIDTH / 2 - .03)); the player keeps this far away.
export const SCONCE_X = 10.6;
export const SCONCE_CLEARANCE = .62;

export function createPlayerMovement(camera, bounds) {
  let stepPhase = 0;

  function positionBlocked(x, z) {
    if (Math.abs(x) > bounds.x || Math.abs(z) > bounds.z) return true;
    // Cabinet fronts project into the hall farther than the side walls.
    if (Math.abs(x) > 10.74 && CABINET_Z.some(cz => Math.abs(z - cz) < CABINET_BODY_WIDTH / 2 + .22)) return true;
    // The candle sconces at both edges of every cabinet stick out to x ≈ 10.4:
    // without this the player (and the key in hand) walked into them.
    if (Math.abs(x) > SCONCE_X - SCONCE_CLEARANCE && CABINET_Z.some(cz => [-1, 1].some(side =>
      Math.hypot(Math.abs(x) - SCONCE_X, z - (cz + side * (CABINET_BODY_WIDTH / 2 - .03))) < SCONCE_CLEARANCE))) return true;
    // Keep the player capsule clear of the sealed doors at either end.
    if (Math.abs(z) > 21.75) return true;
    for (const { x: tx, z: tz } of ARCHIVE_SIDE_TABLES) {
      if (Math.abs(x - tx) < 1.15 && Math.abs(z - tz) < 1.34) return true;
    }
    for (const { min, max } of bounds.stoolObstacles ?? []) {
      if (x > min.x - .22 && x < max.x + .22 &&
          z > min.z - .22 && z < max.z + .22) return true;
    }
    return inStationFootprint(x, z, .22);
  }

  function move(held, yaw, delta) {
    const forward = Number(held.has('w') || held.has('arrowup')) - Number(held.has('s') || held.has('arrowdown'));
    const right = Number(held.has('d') || held.has('arrowright')) - Number(held.has('a') || held.has('arrowleft'));
    const length = Math.hypot(forward, right);
    if (!length) {
      camera.position.y += (PLAYER_EYE_HEIGHT - camera.position.y) * Math.min(1, delta * 8);
      return false;
    }
    const speed = (held.has('shift') ? 7.4 : 4.4) * delta / length;
    const dx = (-Math.sin(yaw) * forward + Math.cos(yaw) * right) * speed;
    const dz = (-Math.cos(yaw) * forward - Math.sin(yaw) * right) * speed;
    if (!positionBlocked(camera.position.x + dx, camera.position.z)) camera.position.x += dx;
    if (!positionBlocked(camera.position.x, camera.position.z + dz)) camera.position.z += dz;
    stepPhase += delta * (held.has('shift') ? 15 : 10);
    camera.position.y = PLAYER_EYE_HEIGHT + Math.sin(stepPhase) * .025;
    return true;
  }

  return { move, positionBlocked };
}
