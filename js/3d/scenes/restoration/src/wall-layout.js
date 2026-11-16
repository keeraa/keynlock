import { collectionCategories, paintingCategory } from './painting-catalog.js';

/** Twelve permanent art-history rows on the shorter restoration wall. */
export const WALL_CAPACITY = 30;
export const WALL_WIDTH = 14.6;
export const WALL_HEIGHT = 8.155; // 30% shorter than the previous 11.65 m exhibition
export const WALL_TOP = 11.85;
export const WALL_ROWS = collectionCategories.filter(([id]) => id !== 'all')
  .map(([id, label]) => ({ id, label }));
export const WALL_ROW_PITCH = WALL_HEIGHT / WALL_ROWS.length;
export const WALL_LABEL_WIDTH = 2.25;

const GAP = .115;
const FRAME_RIM = .032;
const RIGHT_PADDING = .2;
const IMAGE_HEIGHT = WALL_ROW_PITCH - .17 - FRAME_RIM * 2;

function hash(id) {
  let value = 2166136261;
  for (const letter of String(id)) value = Math.imul(value ^ letter.charCodeAt(0), 16777619) >>> 0;
  return value;
}

function dimensions(art) {
  const rawAspect = Number(art.aspect);
  const aspect = Number.isFinite(rawAspect) && rawAspect > 0
    ? Math.max(.08, Math.min(24, rawAspect)) : 1;
  let height = IMAGE_HEIGHT * (.75 + (hash(art.id) % 26) / 100);
  let width = height * aspect;
  // A panoramic painting stays in its row without distortion.
  if (width > 3.5) {
    height *= 3.5 / width;
    width = 3.5;
  }
  return { imageWidth: width, imageHeight: height, outerWidth: width + 2 * FRAME_RIM,
    outerHeight: height + 2 * FRAME_RIM };
}

export function layoutWallPaintings(artworks) {
  const grouped = new Map(WALL_ROWS.map(({ id }) => [id, []]));
  for (const art of artworks.slice(0, WALL_CAPACITY)) {
    const category = paintingCategory(art);
    grouped.get(grouped.has(category) ? category : 'modern').push(art);
  }

  const rows = [];
  const placements = [];
  for (const [index, { id, label }] of WALL_ROWS.entries()) {
    const centerY = WALL_TOP - WALL_ROW_PITCH * (index + .5);
    const works = grouped.get(id);
    rows.push({ id, label, index, centerY, count: works.length });
    if (!works.length) continue;

    const rectangles = works.map((art) => ({ art, ...dimensions(art) }));
    const totalWidth = rectangles.reduce((sum, rect) => sum + rect.outerWidth, 0)
      + GAP * (works.length - 1);
    const availableWidth = WALL_WIDTH - WALL_LABEL_WIDTH - RIGHT_PADDING;
    const scale = Math.min(1, availableWidth / totalWidth);
    const between = GAP * scale;
    let left = -WALL_WIDTH / 2 + WALL_LABEL_WIDTH;

    for (const rect of rectangles) {
      const outerWidth = rect.outerWidth * scale;
      const outerHeight = rect.outerHeight * scale;
      const width = rect.imageWidth * scale;
      const height = rect.imageHeight * scale;
      placements.push({
        id: rect.art.id, image: rect.art.image, title: rect.art.title,
        artist: rect.art.artist, year: rect.art.year,
        category: id, rowIndex: index, rowLabel: label,
        x: left + outerWidth / 2,
        y: centerY,
        width, height, outerWidth, outerHeight,
        frameWidth: FRAME_RIM * scale,
      });
      left += outerWidth + between;
    }
  }

  return {
    placements, rows,
    bounds: { minY: WALL_TOP - WALL_HEIGHT, maxY: WALL_TOP, width: WALL_WIDTH },
  };
}
