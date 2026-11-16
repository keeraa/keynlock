const SAVE_KEY = 'atelier-restoration:player:v1';
const COLOR_LIMITS = { hue: [-60, 60], saturation: [50, 165], brightness: [50, 165] };
const FLAGS = ['completed', 'dustMilestone', 'varnishMilestone', 'retouchMilestone', 'surfaceComplete'];

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

  function save() {
    const settings = {};
    paintings.forEach((art, index) => {
      const value = state[index];
      if (value.hue !== 0 || value.saturation !== 100 || value.brightness !== 100 || FLAGS.some(flag => value[flag])) {
        settings[art.id] = value;
      }
    });
    try { storage?.setItem(key, JSON.stringify({ version: 1, selectedId, settings })); return true; }
    catch { return false; }
  }

  function setSelected(id) {
    if (paintings.some(art => art.id === id)) selectedId = id;
    save();
  }

  return { state, save, setSelected, getSelectedIndex: () => Math.max(0, paintings.findIndex(art => art.id === selectedId)) };
}
