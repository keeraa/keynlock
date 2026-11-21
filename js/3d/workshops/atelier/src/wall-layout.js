// @ts-check
import { collectionCategories, paintingCategory } from './painting-catalog.js';

/** Twelve art movements run from left to right as tall columns of restored paintings. */
export const WALL_CAPACITY = 30;
export const WALL_WIDTH = 30;
export const WALL_HEIGHT = 8.155; // Keep the exhibition 30% shorter than the original.
export const WALL_TOP = 11.85;
export const WALL_COLUMNS = collectionCategories.filter(([id]) => id !== 'all')
  .map(([id, label]) => ({ id, label }));
export const WALL_COLUMN_WIDTH = WALL_WIDTH / WALL_COLUMNS.length;
export const WALL_HEADER_HEIGHT = .95;

const VERTICAL_GAP = .19;
const FRAME_RIM = .052;
const MAX_IMAGE_WIDTH = WALL_COLUMN_WIDTH - .36;
const MAX_IMAGE_HEIGHT = 2.23;

function hash(id) {
  let value = 2166136261;
  for (const letter of String(id)) value = Math.imul(value ^ letter.charCodeAt(0), 16777619) >>> 0;
  return value;
}

function dimensions(art) {
  const rawAspect = Number(art.aspect);
  const aspect = Number.isFinite(rawAspect) && rawAspect > 0
    ? Math.max(.08, Math.min(24, rawAspect)) : 1;
  const longestSide = 1.93 + (hash(art.id) % 31) / 100;
  // Each artwork has a substantial long edge. Its actual proportions determine
  // whether it occupies a wide or tall portion of its vertical column.
  const width = aspect >= 1 ? Math.min(longestSide, MAX_IMAGE_WIDTH)
    : Math.min(MAX_IMAGE_WIDTH, Math.min(longestSide, MAX_IMAGE_HEIGHT) * aspect);
  const height = width / aspect;
  return { imageWidth: width, imageHeight: height,
    outerWidth: width + 2 * FRAME_RIM, outerHeight: height + 2 * FRAME_RIM };
}

export function layoutWallPaintings(artworks) {
  const grouped = new Map(WALL_COLUMNS.map(({ id }) => [id, []]));
  for (const art of artworks.slice(0, WALL_CAPACITY)) {
    const category = paintingCategory(art);
    grouped.get(grouped.has(category) ? category : 'modern').push(art);
  }

  const columns = [];
  const placements = [];
  for (const [index, { id, label }] of WALL_COLUMNS.entries()) {
    const centerX = -WALL_WIDTH / 2 + WALL_COLUMN_WIDTH * (index + .5);
    const works = grouped.get(id);
    columns.push({ id, label, index, centerX, count: works.length });
    if (!works.length) continue;

    const rectangles = works.map((art) => ({ art, ...dimensions(art) }));
    const totalHeight = rectangles.reduce((sum, rect) => sum + rect.outerHeight, 0)
      + VERTICAL_GAP * (works.length - 1);
    const availableHeight = WALL_HEIGHT - WALL_HEADER_HEIGHT - .18;
    const scale = Math.min(1, availableHeight / totalHeight);
    const between = VERTICAL_GAP * scale;
    let top = WALL_TOP - WALL_HEADER_HEIGHT;

    for (const rect of rectangles) {
      const width = rect.imageWidth * scale;
      const height = rect.imageHeight * scale;
      const outerWidth = rect.outerWidth * scale;
      const outerHeight = rect.outerHeight * scale;
      placements.push({
        id: rect.art.id, image: rect.art.image, title: rect.art.title,
        artist: rect.art.artist, year: rect.art.year,
        category: id, columnIndex: index, columnLabel: label,
        x: centerX,
        y: top - outerHeight / 2,
        width, height, outerWidth, outerHeight,
        frameWidth: FRAME_RIM * scale,
      });
      top -= outerHeight + between;
    }
  }

  return {
    placements, columns,
    bounds: { minX: -WALL_WIDTH / 2, maxX: WALL_WIDTH / 2,
      minY: WALL_TOP - WALL_HEIGHT, maxY: WALL_TOP,
      width: WALL_WIDTH, columnWidth: WALL_COLUMN_WIDTH },
  };
}
