/** Browser-side catalogue access. No images are fetched until the scene asks for one. */
const SCHEMA = 'keynlock.paintings.scene.v1';

export function sceneCatalog(manifest, manifestUrl) {
  if (!manifest || manifest.schema !== SCHEMA || !Array.isArray(manifest.paintings)
    || manifest.count !== manifest.paintings.length) {
    throw new Error('Unsupported or corrupted Keynlock painting scene manifest');
  }
  const byId = new Map();
  const byHall = new Map();
  const byWall = new Map();
  for (const p of manifest.paintings) {
    if (byId.has(p.id)) throw new Error('Duplicate painting ID: ' + p.id);
    byId.set(p.id, p);
    const hall = p.placement.hall;
    const wall = hall + '/' + p.placement.wall;
    if (!byHall.has(hall)) byHall.set(hall, []);
    if (!byWall.has(wall)) byWall.set(wall, []);
    byHall.get(hall).push(p);
    byWall.get(wall).push(p);
  }
  const base = new URL(manifestUrl, import.meta.url).href;
  return Object.freeze({
    count: manifest.count,
    overviewAtlas: manifest.overviewAtlas && {...manifest.overviewAtlas, url:new URL(manifest.overviewAtlas.path,base).href},
    halls: manifest.halls,
    paintings: manifest.paintings,
    get: id => byId.get(id) ?? null,
    inHall: id => byHall.get(id) ?? [],
    onWall: (hall, wall) => byWall.get(hall + '/' + wall) ?? [],
    detailUrl: id => {
      const path = byId.get(id)?.image.detail?.path;
      return path ? new URL(path,base).href : null;
    },
    imageUrl: id => {
      const p = byId.get(id);
      if (!p) throw new Error('Unknown painting: ' + id);
      return new URL(p.image.path, base).href;
    },
  });
}

export async function loadSceneCatalog(manifestUrl, { signal, fetchImpl = fetch } = {}) {
  const response = await fetchImpl(manifestUrl, { signal });
  if (!response.ok) throw new Error(`Painting manifest unavailable: HTTP ${response.status}`);
  return sceneCatalog(await response.json(), manifestUrl);
}
