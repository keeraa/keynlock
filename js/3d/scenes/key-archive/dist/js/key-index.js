const CELL_SIZE = 1.5;
const cellKey = (x, z) => `${Math.floor(x / CELL_SIZE)},${Math.floor(z / CELL_SIZE)}`;

// Stable identities, plus a rebuildable grid for the floor. Key objects are
// mutated in place by the game rules, so rebuild only after state changes.
export function createKeyIndex(keys) {
  const byId = new Map();
  let floor = new Map();
  function rebuild() {
    byId.clear();
    floor = new Map();
    for (const key of keys) {
      byId.set(key.id, key);
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
  return { get: id => byId.get(id), nearby, rebuild };
}
