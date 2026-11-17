const SAVE_KEY = 'atelier-restoration:player:v1';
const COLOR_LIMITS = { hue: [-60, 60], saturation: [50, 165], brightness: [50, 165] };
const FLAGS = ['completed', 'dustMilestone', 'varnishMilestone', 'retouchMilestone', 'surfaceComplete'];
const WALL_CAPACITY = 30;

function defaults() {
  return { hue: 0, saturation: 100, brightness: 100, completed: false };
}

export function createPlayerProgress({ paintings, storage, key = SAVE_KEY } = {}) {
  if (storage === undefined) {
    try { storage = globalThis.localStorage; }
    catch { storage = null; }
  }
  let saved;
  try { saved = JSON.parse(storage?.getItem(key) || 'null'); }
  catch { saved = null; }
  const state = paintings.map((art) => {
    const entry = saved?.version === 1 ? saved.settings?.[art.id] : null;
    const result = defaults();
    if (!entry || typeof entry !== 'object') return result;
    for (const [field, [min, max]] of Object.entries(COLOR_LIMITS)) {
      if (Number.isFinite(entry[field])) result[field] = Math.max(min, Math.min(max, entry[field]));
    }
    for (const flag of FLAGS) if (entry[flag] === true) result[flag] = true;
    return result;
  });
  let selectedId = saved?.version === 1 && paintings.some((art) => art.id === saved.selectedId)
    ? saved.selectedId : paintings[0]?.id;
  const indexById = new Map(paintings.map((art, index) => [art.id, index]));
  const isRestored = (id) => {
    const entry = state[indexById.get(id)];
    return Boolean(entry?.completed && entry.surfaceComplete);
  };
  // Older saves had no gallery field. Preserve already finished paintings on migration.
  let wallIds = saved?.version === 1 && Array.isArray(saved.wallIds)
    ? saved.wallIds.filter((id) => typeof id === 'string' && isRestored(id))
    : paintings.filter((art) => isRestored(art.id)).map((art) => art.id);
  wallIds = [...new Set(wallIds)].slice(0, WALL_CAPACITY);

  function save() {
    const settings = {};
    paintings.forEach((art, index) => {
      const value = state[index];
      if (value.hue !== 0 || value.saturation !== 100 || value.brightness !== 100 || FLAGS.some(flag => value[flag])) {
        settings[art.id] = value;
      }
    });
    try { storage?.setItem(key, JSON.stringify({ version: 1, selectedId, settings, wallIds })); return true; }
    catch { return false; }
  }

  function setSelected(id) {
    if (paintings.some(art => art.id === id)) selectedId = id;
    save();
  }

  function autoPin(id) {
    if (!isRestored(id) || wallIds.includes(id) || wallIds.length >= WALL_CAPACITY) return false;
    wallIds.push(id);
    save();
    return true;
  }

  function toggleWall(id) {
    if (!isRestored(id)) return { changed: false, reason: 'unfinished' };
    if (wallIds.includes(id)) {
      wallIds = wallIds.filter((value) => value !== id);
      save();
      return { changed: true, onWall: false };
    }
    if (wallIds.length >= WALL_CAPACITY) return { changed: false, reason: 'full' };
    wallIds.push(id);
    save();
    return { changed: true, onWall: true };
  }

  function removeFromWall(id) {
    if (!wallIds.includes(id)) return false;
    wallIds = wallIds.filter((value) => value !== id);
    save();
    return true;
  }

  return {
    state, save, setSelected, autoPin, toggleWall, removeFromWall, isRestored,
    getWallIds: () => wallIds.slice(),
    getRestoredIds: () => paintings.filter((art) => isRestored(art.id)).map((art) => art.id),
    getSelectedIndex: () => Math.max(0, paintings.findIndex(art => art.id === selectedId)),
  };
}
