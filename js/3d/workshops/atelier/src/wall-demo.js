// @ts-check
import { paintingCategory } from './painting-catalog.js';
import { WALL_CAPACITY, WALL_COLUMNS } from './wall-layout.js';

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
  // Show at least one painting from each of the twelve columns while testing.
  const firstByCategory = new Map();
  for (const art of shuffled) {
    const category = paintingCategory(art);
    if (!firstByCategory.has(category)) firstByCategory.set(category, art);
  }
  const required = WALL_COLUMNS.map(({ id }) => firstByCategory.get(id)).filter(Boolean);
  const chosenIds = new Set(required.map((art) => art.id));
  return [...required, ...shuffled.filter((art) => !chosenIds.has(art.id))].slice(0, WALL_CAPACITY);
}
