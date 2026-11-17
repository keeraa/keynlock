/** Durable canvas snapshots in IndexedDB. PNG Blobs avoid storing giant RGBA
 * buffers in localStorage and preserve every brush/UV/reagent edit exactly. */
export function createIndexedDBAdapter({ indexedDB } = {}) {
  if (indexedDB === undefined) {
    try { indexedDB = globalThis.indexedDB; }
    catch { indexedDB = null; }
  }
  const database = new Promise((resolve) => {
    if (!indexedDB) { resolve(null); return; }
    let request;
    try { request = indexedDB.open('atelier-restoration', 1); }
    catch { resolve(null); return; }
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('paintings')) request.result.createObjectStore('paintings');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });

  async function transact(mode, operation) {
    const db = await database;
    if (!db) return null;
    return new Promise((resolve) => {
      let transaction;
      try { transaction = db.transaction('paintings', mode); }
      catch { resolve(null); return; }
      let request;
      try { request = operation(transaction.objectStore('paintings')); }
      catch { resolve(null); return; }
      transaction.oncomplete = () => resolve(mode === 'readonly' ? request.result ?? null : true);
      transaction.onerror = () => resolve(null);
      transaction.onabort = () => resolve(null);
    });
  }

  return {
    get: (id) => transact('readonly', (store) => store.get(id)),
    put: (id, value) => transact('readwrite', (store) => store.put(value, id)),
  };
}

/** Serializing writes per painting prevents an older snapshot overwriting a
 * later one when brush strokes and painting switches happen quickly. */
export function createRestorationStore({ adapter = createIndexedDBAdapter(), onError = console.warn } = {}) {
  const pending = new Map();

  function save(id, surface) {
    const previous = pending.get(id) || Promise.resolve();
    const job = previous.catch(() => {}).then(async () => {
      if (!surface.isDirty()) return true;
      const revision = surface.getRevision();
      try {
        const snapshot = await surface.snapshot();
        const saved = await adapter.put(id, snapshot);
        if (saved !== true) throw new Error('IndexedDB is unavailable or full');
        surface.markSaved(revision);
        // Notify the lair's same-origin bridge only after all painted layers
        // have been committed; no partial strokes are ever broadcast.
        try { localStorage.setItem('atelier-restoration:surface-revision',
          JSON.stringify({ id, revision, at: Date.now() })); } catch { /* optional sync */ }
        return true;
      } catch (error) {
        onError('Не удалось сохранить реставрацию:', error);
        return false;
      }
    });
    pending.set(id, job);
    void job.finally(() => { if (pending.get(id) === job) pending.delete(id); });
    return job;
  }

  async function load(id) {
    await pending.get(id);
    try { return await adapter.get(id); }
    catch (error) { onError('Не удалось прочитать реставрацию:', error); return null; }
  }

  return { save, load, flush: async () => { await Promise.allSettled([...pending.values()]); } };
}
