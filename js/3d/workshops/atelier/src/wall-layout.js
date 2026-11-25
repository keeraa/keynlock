// @ts-check
import { collectionCategories, paintingCategory } from './painting-catalog.js';

/** Art movements run from left to right as tall columns of restored paintings. */
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
const MAX_IMAGE_HEIGHT = 2.23;
const wallCategories = new Set(WALL_COLUMNS.map(({ id }) => id));

export function wallPaintingCategory(art) {
  const category = paintingCategory(art);
  return wallCategories.has(category) ? category : 'modern';
}

function hash(id) {
  let value = 2166136261;
  for (const letter of String(id)) value = Math.imul(value ^ letter.charCodeAt(0), 16777619) >>> 0;
  return value;
}

function dimensions(art, maxImageWidth) {
  const rawAspect = Number(art.aspect);
  const aspect = Number.isFinite(rawAspect) && rawAspect > 0
    ? Math.max(.08, Math.min(24, rawAspect)) : 1;
  const longestSide = 1.93 + (hash(art.id) % 31) / 100;
  // Each artwork has a substantial long edge. Its actual proportions determine
  // whether it occupies a wide or tall portion of its vertical column.
  const width = aspect >= 1 ? Math.min(longestSide, maxImageWidth)
    : Math.min(maxImageWidth, Math.min(longestSide, MAX_IMAGE_HEIGHT) * aspect);
  const height = width / aspect;
  return { imageWidth: width, imageHeight: height,
    outerWidth: width + 2 * FRAME_RIM, outerHeight: height + 2 * FRAME_RIM };
}

export function layoutWallPaintings(artworks, { width = WALL_WIDTH, centerX = 0, topY = WALL_TOP, columns: allowedColumns = WALL_COLUMNS } = {}) {
  const columnWidth = width / allowedColumns.length;
  const minX = centerX - width / 2;
  const maxImageWidth = columnWidth - .36;
  const bottomY = WALL_TOP - WALL_HEIGHT;
  const availableHeight = topY - bottomY - WALL_HEADER_HEIGHT - .18;
  const grouped = new Map(allowedColumns.map(({ id }) => [id, []]));
  let shown = 0;
  for (const art of artworks) {
    const group = grouped.get(wallPaintingCategory(art));
    if (!group) continue;
    group.push(art);
    if (++shown === WALL_CAPACITY) break;
  }

  const columns = [];
  const placements = [];
  for (const [index, { id, label }] of allowedColumns.entries()) {
    const columnX = minX + columnWidth * (index + .5);
    const works = grouped.get(id);
    columns.push({ id, label, index, centerX: columnX, count: works.length });
    if (!works.length) continue;

    const rectangles = works.map((art) => ({ art, ...dimensions(art, maxImageWidth) }));
    const totalHeight = rectangles.reduce((sum, rect) => sum + rect.outerHeight, 0)
      + VERTICAL_GAP * (works.length - 1);
    const scale = Math.min(1, availableHeight / totalHeight);
    const between = VERTICAL_GAP * scale;
    let top = topY - WALL_HEADER_HEIGHT;

    for (const rect of rectangles) {
      const width = rect.imageWidth * scale;
      const height = rect.imageHeight * scale;
      const outerWidth = rect.outerWidth * scale;
      const outerHeight = rect.outerHeight * scale;
      placements.push({
        id: rect.art.id, image: rect.art.image, title: rect.art.title,
        artist: rect.art.artist, year: rect.art.year,
        category: id, columnIndex: index, columnLabel: label,
        x: columnX,
        y: top - outerHeight / 2,
        width, height, outerWidth, outerHeight,
        frameWidth: FRAME_RIM * scale,
      });
      top -= outerHeight + between;
    }
  }

  return {
    placements, columns,
    bounds: { minX, maxX: minX + width,
      minY: bottomY, maxY: topY,
      width, columnWidth },
  };
}
