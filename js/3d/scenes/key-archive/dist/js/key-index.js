import { describeBathContents } from './rules.js?v=key-ring';

const EMPTY = Object.freeze([]);
const EMPTY_BATH = Object.freeze(describeBathContents(EMPTY, 0));
const CELL_SIZE = 1.5;
const cellKey = (x, z) => `${Math.floor(x / CELL_SIZE)},${Math.floor(z / CELL_SIZE)}`;

// Stable identities, a proximity grid for the floor, and bath membership. Key objects are
// mutated in place by the game rules, so rebuild only after state changes.
export function createKeyIndex(keys) {
  const byId = new Map();
  let floor = new Map();
  let baths = new Map();
  function rebuild() {
    byId.clear();
    floor = new Map();
    baths = new Map();
    for (const key of keys) {
      byId.set(key.id, key);
      if (key.status === 'bath') {
        if (!baths.has(key.bathId)) baths.set(key.bathId, []);
        baths.get(key.bathId).push(key);
      }
      if (key.status !== 'floor') continue;
      const cell = cellKey(key.x, key.z);
      if (!floor.has(cell)) floor.set(cell, []);
      floor.get(cell).push(key);
    }
  }
  function nearby(x, z, radius) {
    const hits = [];
    const minX = Math.floor((x - radius) / CELL_SIZE);
    const maxX = Math.floor((x + radius) / CELL_SIZE);
    const minZ = Math.floor((z - radius) / CELL_SIZE);
    const maxZ = Math.floor((z + radius) / CELL_SIZE);
    for (let cx = minX; cx <= maxX; cx++) for (let cz = minZ; cz <= maxZ; cz++)
      hits.push(...(floor.get(`${cx},${cz}`) || []));
    return hits;
  }
  rebuild();
  return {
    get: id => byId.get(id),
    nearby,
    rebuild,
    bathKeys: id => baths.get(id) ?? EMPTY,
    bathContents(id, now = Date.now()) {
      const keys = baths.get(id);
      return keys ? describeBathContents(keys, now) : EMPTY_BATH;
    },
  };
}
