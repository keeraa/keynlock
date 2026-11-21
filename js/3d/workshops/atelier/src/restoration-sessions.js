// @ts-check
import { createRestorationSurface } from './restoration-surface.js';

export function paintingSeed(id) {
  let seed = 2166136261;
  for (const letter of id) seed = Math.imul(seed ^ letter.charCodeAt(0), 16777619) >>> 0;
  return seed;
}

/** Keeps just a few editable canvases in RAM. Every other painting can be
 * reconstructed from its seeded damage and persisted restoration snapshot. */
export function createRestorationSessions({ THREE, store, limit = 3, onError = console.warn,
  makeSurface = createRestorationSurface }) {
  const surfaces = new Map();
  const inflight = new Map();
  let activeId = null;
  const evictions = new Set();

  async function get(art, width, height) {
    if (surfaces.has(art.id)) {
      const surface = surfaces.get(art.id);
      surfaces.delete(art.id);
      surfaces.set(art.id, surface);
      return surface;
    }
    if (inflight.has(art.id)) return inflight.get(art.id);
    const task = (async () => {
      const surface = makeSurface({ THREE, width, height, seed: paintingSeed(art.id) });
      const saved = await store.load(art.id);
      if (saved) {
        try { await surface.restore(saved); }
        catch (error) { onError(`Повреждённое сохранение «${art.id}»:`, error); }
      }
      surfaces.set(art.id, surface);
      return surface;
    })();
    inflight.set(art.id, task);
    try { return await task; }
    finally { inflight.delete(art.id); }
  }

  function save(id) {
    const surface = surfaces.get(id);
    return surface ? store.save(id, surface) : Promise.resolve(true);
  }

  function trim(keepId) {
    activeId = keepId;
    while (surfaces.size > limit) {
      const oldest = [...surfaces.keys()].find(id => id !== activeId && !evictions.has(id));
      if (!oldest) break;
      const expired = surfaces.get(oldest);
      if (expired.isDirty?.()) {
        // If storage fails (private browsing/quota), retain unsaved work in
        // memory instead of silently discarding the older painting.
        evictions.add(oldest);
        void store.save(oldest, expired).then((saved) => {
          evictions.delete(oldest);
          if (saved && !expired.isDirty() && surfaces.get(oldest) === expired && oldest !== activeId) {
            expired.unmount();
            surfaces.delete(oldest);
            trim(activeId);
          }
        });
        break;
      }
      surfaces.delete(oldest);
      expired.unmount();
    }
  }

  return { get, save, trim, cachedCount: () => surfaces.size };
}
