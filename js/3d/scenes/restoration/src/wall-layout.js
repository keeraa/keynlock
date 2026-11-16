/** Deterministic, aspect-aware packing for the restoration wall. */
export const WALL_CAPACITY = 30;
export const WALL_WIDTH = 14.6;
export const WALL_HEIGHT = 11.65;
export const WALL_TOP = 17.25;

const GAP = .16;
const RIM = .085;

function hash(id) {
  let value = 2166136261;
  for (const letter of String(id)) value = Math.imul(value ^ letter.charCodeAt(0), 16777619) >>> 0;
  return value;
}

function dimensions(art, scale) {
  // Preserve the real geometry even for panoramic works and narrow scrolls.
  const ratio = Number(art.aspect);
  const aspect = Number.isFinite(ratio) && ratio > 0 ? Math.max(.08, Math.min(24, ratio)) : 1;
  let height = (1.26 + (hash(art.id) % 60) / 100) * scale;
  let width = height * aspect;
  if (width > 3.7 * scale) {
    height *= (3.7 * scale) / width;
    width = 3.7 * scale;
  }
  if (width < .55 * scale) {
    height *= (.55 * scale) / width;
    width = .55 * scale;
  }
  return { width: width + RIM * 2, height: height + RIM * 2 };
}

function pack(items, scale) {
  const placed = [];
  for (const art of items) {
    const { width, height } = dimensions(art, scale);
    const xs = [...new Set([0, ...placed.map((rect) => rect.x + rect.width + GAP)])].sort((a, b) => a - b);
    const ys = [...new Set([0, ...placed.map((rect) => rect.y + rect.height + GAP)])].sort((a, b) => a - b);
    let candidate;
    for (const y of ys) {
      if (candidate || y + height > WALL_HEIGHT + 1e-6) break;
      for (const x of xs) {
        if (x + width > WALL_WIDTH + 1e-6) continue;
        const overlap = placed.some((other) =>
          x < other.x + other.width + GAP - 1e-6 &&
          x + width + GAP > other.x + 1e-6 &&
          y < other.y + other.height + GAP - 1e-6 &&
          y + height + GAP > other.y + 1e-6);
        if (!overlap) { candidate = { ...art, x, y, width, height }; break; }
      }
    }
    if (!candidate) return null;
    placed.push(candidate);
  }
  return placed;
}

export function layoutWallPaintings(artworks) {
  const items = artworks.slice(0, WALL_CAPACITY);
  if (!items.length) return { placements: [], bounds: { minY: 7, maxY: WALL_TOP, width: WALL_WIDTH } };
  let rectangles = null;
  for (let scale = 1; scale >= .45 && !rectangles; scale -= .045) rectangles = pack(items, scale);
  if (!rectangles) throw new Error('The wall cannot accommodate the selected works');

  const usedWidth = Math.max(...rectangles.map((rect) => rect.x + rect.width));
  const usedHeight = Math.max(...rectangles.map((rect) => rect.y + rect.height));
  const placements = rectangles.map((rect) => ({
    id: rect.id, image: rect.image, title: rect.title, artist: rect.artist, year: rect.year,
    x: rect.x + rect.width / 2 - usedWidth / 2,
    y: WALL_TOP - rect.y - rect.height / 2,
    width: rect.width - 2 * RIM,
    height: rect.height - 2 * RIM,
    outerWidth: rect.width,
    outerHeight: rect.height,
    frameWidth: RIM,
  }));
  return {
    placements,
    bounds: { minY: WALL_TOP - usedHeight, maxY: WALL_TOP, width: Math.max(4, usedWidth) },
  };
}
