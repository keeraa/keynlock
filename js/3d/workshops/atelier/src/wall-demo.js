// @ts-check
import { WALL_CAPACITY, WALL_COLUMNS, wallPaintingCategory } from './wall-layout.js';

/** A temporary, reshufflable exhibition that never changes a player's saved progress. */
export function chooseDemoWallPaintings(paintings, random = Math.random, columns = WALL_COLUMNS) {
  const categories = new Set(columns.map(({ id }) => id));
  const unique = new Map();
  for (const art of paintings) {
    if (art?.id && art.image && !unique.has(art.id) && categories.has(wallPaintingCategory(art))) unique.set(art.id, art);
  }
  const shuffled = [...unique.values()];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const choice = Math.min(index, Math.floor(Math.max(0, Math.min(.999999, random())) * (index + 1)));
    [shuffled[index], shuffled[choice]] = [shuffled[choice], shuffled[index]];
  }
  // Show at least one painting from each of the available columns.
  const firstByCategory = new Map();
  for (const art of shuffled) {
    const category = wallPaintingCategory(art);
    if (!firstByCategory.has(category)) firstByCategory.set(category, art);
  }
  const required = columns.map(({ id }) => firstByCategory.get(id)).filter(Boolean);
  const chosenIds = new Set(required.map((art) => art.id));
  return [...required, ...shuffled.filter((art) => !chosenIds.has(art.id))].slice(0, WALL_CAPACITY);
}
