// A small spatial hash makes it inexpensive to keep 1,000 floor keys separated.
import { inStationFootprint } from './station-layout.js';
export const KEY_CLEARANCE = .62;
const LIMITS = { x: 8.85, z: 18.5 };

const hash = (x, z) => `${Math.floor(x / KEY_CLEARANCE)},${Math.floor(z / KEY_CLEARANCE)}`;

function add(grid, point) {
  const id = hash(point.x, point.z);
  if (!grid.has(id)) grid.set(id, []);
  grid.get(id).push(point);
}

function fits(grid, x, z, clearance = KEY_CLEARANCE) {
  if (inStationFootprint(x, z, .20)) return false;
  const cellX = Math.floor(x / KEY_CLEARANCE);
  const cellZ = Math.floor(z / KEY_CLEARANCE);
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
    for (const point of grid.get(`${cellX + dx},${cellZ + dz}`) || []) {
      if ((point.x - x) ** 2 + (point.z - z) ** 2 < clearance ** 2) return false;
    }
  }
  return true;
}

const clamp = (value, halfExtent) => Math.max(-halfExtent, Math.min(halfExtent, value));

// Preserve non-overlapping positions, relocating only the colliding items.
export function separateFloorKeys(keys) {
  const grid = new Map();
  let moved = 0;
  for (const key of keys) {
    if (key.status !== 'floor') continue;
    let x = key.x;
    let z = key.z;
    if (!fits(grid, x, z)) {
      let placed = false;
      for (let ring = 1; ring < 50 && !placed; ring++) {
        const count = 12 + ring * 5;
        const radius = ring * .14;
        for (let step = 0; step < count; step++) {
          const angle = step / count * Math.PI * 2 + ring * .389;
          const xx = clamp(key.x + Math.cos(angle) * radius, LIMITS.x);
          const zz = clamp(key.z + Math.sin(angle) * radius, LIMITS.z);
          if (!fits(grid, xx, zz)) continue;
          x = xx;
          z = zz;
          placed = true;
          break;
        }
      }
      if (!placed) {
        // Deterministic fallback for unusually dense legacy save files.
        for (let i = 0; i < 10000 && !placed; i++) {
          const xx = -LIMITS.x + ((i * .61803398875 + moved * .41421356237) % 1) * LIMITS.x * 2;
          const zz = -LIMITS.z + ((i * .75487766625 + moved * .27182818284) % 1) * LIMITS.z * 2;
          if (!fits(grid, xx, zz)) continue;
          x = xx;
          z = zz;
          placed = true;
        }
      }
      if (placed) {
        key.x = x;
        key.z = z;
        moved++;
      }
    }
    add(grid, { x: key.x, z: key.z });
  }
  return moved;
}
