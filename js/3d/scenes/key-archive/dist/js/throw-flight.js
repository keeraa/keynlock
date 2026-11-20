// A thrown key, simulated as a small ball under gravity.
//
// The key leaves the hand at a fixed speed along the view, so the player aims
// with the reticle: looking higher throws farther, up to about seven metres.
// It bounces off furniture boxes, the walls and the floor, slides to a stop
// with friction, and can come to rest on a tabletop. A vessel that accepts
// the key (a muddy key and the water, a rusty key and the rust tray, a broken
// key and the forge) catches it when it falls through the opening; any other
// vessel is solid and the key bounces out.
//
// The whole flight is computed at once (the scene does not move during it),
// so the landing is known when the key is released and the animation only
// replays the sampled path.

export const THROW_SPEED = 6.5;          // m/s, a firm hand throw: about 7 m at best
export const GRAVITY = 9.81;
const STEP = 1 / 240;
const SAMPLE = 1 / 60;
const RADIUS = .035;                     // the key, seen as a ball
const FLOOR_BOUNCE = .28;
const FURNITURE_BOUNCE = .25;
const KEEP_ALONG = .62;                  // horizontal speed kept on a floor impact
const KEEP_ALONG_WOOD = .42;             // ... on furniture: a flat key dies down fast
const SETTLE_SPEED = .7;                 // slower vertical impacts stop bouncing
const SETTLE_SPEED_WOOD = 1.3;
const SLIDE_DECELERATION = 8;            // m/s² while sliding on a surface
const SHOVE_OFF = 1.1;                   // m/s, off a top the key cannot rest on

const inside = (point, box, grow = RADIUS) =>
  point.x > box.min.x - grow && point.x < box.max.x + grow &&
  point.y > box.min.y - grow && point.y < box.max.y + grow &&
  point.z > box.min.z - grow && point.z < box.max.z + grow;

function overVessel(vessel, x, z) {
  if (vessel.radius) return Math.hypot(x - vessel.x, z - vessel.z) < vessel.radius;
  return Math.abs(x - vessel.x) < vessel.halfX && Math.abs(z - vessel.z) < vessel.halfZ;
}

// start, velocity: {x, y, z}. floorY(x, z): floor height there.
// solids: [{ min, max, surface?, vessel? }] axis-aligned boxes; `surface`
//   tops can hold a key, other tops shove it off; `vessel` names the vessel
//   a box belongs to (so a bounce off it can be reported).
// vessels: [{ id, kind, x, z, y, radius | halfX + halfZ, accepts }]: the
//   opening at height y. Only accepting vessels catch.
// walls: { x, z } half extents of the hall.
export function simulateThrow({ start, velocity, floorY = () => 0, solids = [], vessels = [],
  walls = { x: Infinity, z: Infinity }, maxSeconds = 5 }) {
  const p = { ...start };
  const v = { ...velocity };
  const path = [{ t: 0, x: p.x, y: p.y, z: p.z }];
  const impacts = [];
  let bouncedOff = null;
  let support = null;            // { top, surface } while sliding
  let t = 0;
  let nextSample = SAMPLE;
  const prev = { x: 0, y: 0, z: 0 };

  const record = force => {
    if (!force && t < nextSample) return;
    path.push({ t, x: p.x, y: p.y, z: p.z });
    nextSample = t + SAMPLE;
  };
  const impact = (kind, speed) => impacts.push({ t, kind, speed });

  function supportUnder() {
    // The highest surface (or the floor) under the key's centre.
    let top = floorY(p.x, p.z), surface = 'floor', box = null;
    for (const solid of solids) {
      if (p.x < solid.min.x || p.x > solid.max.x || p.z < solid.min.z || p.z > solid.max.z) continue;
      if (solid.max.y <= p.y - RADIUS + .02 && solid.max.y > top) {
        top = solid.max.y; surface = solid.surface ? 'surface' : 'shove'; box = solid;
      }
    }
    return { top, surface, box };
  }

  function collideWalls() {
    for (const axis of ['x', 'z']) {
      const limit = walls[axis] - RADIUS;
      if (Math.abs(p[axis]) > limit) {
        p[axis] = Math.sign(p[axis]) * limit;
        if (Math.sign(v[axis]) === Math.sign(p[axis])) {
          impact('wall', Math.abs(v[axis]));
          v[axis] = -v[axis] * FURNITURE_BOUNCE;
        }
      }
    }
  }

  function collideSolids() {
    for (const box of solids) {
      if (!inside(p, box)) continue;
      // Over the opening of a vessel that takes the key: let it fall in.
      if (box.opening && overVessel(box.opening, p.x, p.z)) continue;
      // Which face did the key come through? Judge by where it was a step ago.
      if (prev.y >= box.max.y + RADIUS - 1e-6) {
        p.y = box.max.y + RADIUS;
        const speed = -v.y;
        impact(box.vessel ? 'vessel' : 'furniture', speed);
        if (box.vessel) bouncedOff ??= box.vessel;
        if (speed < SETTLE_SPEED_WOOD) {
          v.y = 0;
          if (box.surface) support = { top: box.max.y, surface: 'surface' };
          else shoveOff(box);
        } else {
          v.y = speed * FURNITURE_BOUNCE;
          v.x *= KEEP_ALONG_WOOD; v.z *= KEEP_ALONG_WOOD;
        }
      } else if (prev.y <= box.min.y - RADIUS + 1e-6) {
        p.y = box.min.y - RADIUS;
        v.y = -Math.abs(v.y) * FURNITURE_BOUNCE;
      } else {
        // A side: bounce back along x or z, whichever the key crossed.
        const crossedX = prev.x <= box.min.x - RADIUS || prev.x >= box.max.x + RADIUS;
        const axis = crossedX ? 'x' : 'z';
        const low = box.min[axis] - RADIUS, high = box.max[axis] + RADIUS;
        p[axis] = prev[axis] <= box.min[axis] ? low : prev[axis] >= box.max[axis] ? high
          : (p[axis] - low < high - p[axis] ? low : high);
        impact(box.vessel ? 'vessel' : 'furniture', Math.abs(v[axis]));
        if (box.vessel) bouncedOff ??= box.vessel;
        v[axis] = -v[axis] * FURNITURE_BOUNCE;
        const other = axis === 'x' ? 'z' : 'x';
        v[other] *= KEEP_ALONG;
      }
    }
  }

  // A top that cannot hold the key (a vessel's rim, the forge): it tips off,
  // away from the middle.
  function shoveOff(box) {
    const cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2;
    let dx = p.x - cx, dz = p.z - cz;
    const length = Math.hypot(dx, dz) || 1;
    if (Math.hypot(dx, dz) < 1e-6) { dx = 0; dz = 1; }
    v.x = dx / length * SHOVE_OFF;
    v.z = dz / length * SHOVE_OFF;
    v.y = .6;
  }

  while (t < maxSeconds) {
    t += STEP;
    prev.x = p.x; prev.y = p.y; prev.z = p.z;
    if (support) {
      // Sliding on the floor or a tabletop until friction stops it.
      const speed = Math.hypot(v.x, v.z);
      if (speed < .03) { record(true); break; }
      const slow = Math.max(0, speed - SLIDE_DECELERATION * STEP) / speed;
      v.x *= slow; v.z *= slow;
      p.x += v.x * STEP; p.z += v.z * STEP;
      collideWalls();
      const under = supportUnder();
      if (under.top < support.top - .015) {
        support = null;              // slid off the edge: falls again
        v.y = 0;
      } else {
        p.y = support.top + RADIUS;
        // Side walls of furniture still stop a sliding key.
        for (const box of solids) {
          if (box.max.y <= support.top + .01 || !inside(p, box)) continue;
          const axis = prev.x <= box.min.x - RADIUS || prev.x >= box.max.x + RADIUS ? 'x' : 'z';
          p[axis] = prev[axis];
          v[axis] = -v[axis] * FURNITURE_BOUNCE;
        }
      }
      record(false);
      continue;
    }
    v.y -= GRAVITY * STEP;
    p.x += v.x * STEP; p.y += v.y * STEP; p.z += v.z * STEP;
    for (const vessel of vessels) {
      if (!vessel.accepts || prev.y < vessel.y || p.y >= vessel.y || !overVessel(vessel, p.x, p.z)) continue;
      p.y = vessel.y;
      record(true);
      impact('catch', -v.y);
      return { path, impacts, duration: t, bouncedOff,
        landing: { on: 'vessel', vessel: vessel.id, kind: vessel.kind, x: p.x, y: p.y, z: p.z } };
    }
    collideWalls();
    collideSolids();
    if (support) { record(true); continue; }
    const floor = floorY(p.x, p.z) + RADIUS;
    if (p.y < floor) {
      p.y = floor;
      const speed = -v.y;
      impact('floor', speed);
      if (speed < SETTLE_SPEED) {
        v.y = 0;
        support = { top: floor - RADIUS, surface: 'floor' };
      } else {
        v.y = speed * FLOOR_BOUNCE;
        v.x *= KEEP_ALONG; v.z *= KEEP_ALONG;
      }
    }
    record(false);
  }
  const top = support ? support.top : floorY(p.x, p.z);
  return { path, impacts, duration: t, bouncedOff,
    landing: { on: support?.surface === 'surface' ? 'surface' : 'floor', x: p.x, y: top, z: p.z } };
}

// Initial velocity for a throw along a (not necessarily unit) view direction.
export function throwVelocity(direction, speed = THROW_SPEED) {
  const length = Math.hypot(direction.x, direction.y, direction.z) || 1;
  return { x: direction.x / length * speed, y: direction.y / length * speed, z: direction.z / length * speed };
}

// Pose along a simulated path at `seconds` (linear between samples).
export function samplePath(path, seconds) {
  if (seconds <= 0) return { ...path[0] };
  const last = path.at(-1);
  if (seconds >= last.t) return { ...last };
  let low = 0, high = path.length - 1;
  while (high - low > 1) {
    const mid = (low + high) >> 1;
    if (path[mid].t <= seconds) low = mid; else high = mid;
  }
  const a = path[low], b = path[high];
  const f = (seconds - a.t) / ((b.t - a.t) || 1);
  return { t: seconds, x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, z: a.z + (b.z - a.z) * f };
}
