import { WALL_CAPACITY } from './wall-layout.js';

/** A temporary, reshufflable exhibition that never changes a player's saved progress. */
export function chooseDemoWallPaintings(paintings, random = Math.random) {
  const unique = new Map();
  for (const art of paintings) {
    if (art?.id && art.image && !unique.has(art.id)) unique.set(art.id, art);
  }
  const shuffled = [...unique.values()];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const choice = Math.min(index, Math.floor(Math.max(0, Math.min(.999999, random())) * (index + 1)));
    [shuffled[index], shuffled[choice]] = [shuffled[choice], shuffled[index]];
  }
  return shuffled.slice(0, WALL_CAPACITY);
}
