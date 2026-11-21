// @ts-check
export const CABINET_Z = [-17, -8.5, 0, 8.5, 17];

// Four main rows of six compartments; each contains four standing slots.
export const CABINET_COLUMNS = 6;
export const CABINET_ROWS = 4;
export const KEYS_PER_COMPARTMENT = 4;
export const CABINET_CAPACITY = CABINET_COLUMNS * CABINET_ROWS * KEYS_PER_COMPARTMENT;
export const CABINET_COLUMN_WIDTH = .432;
export const CABINET_GRID_WIDTH = CABINET_COLUMNS * CABINET_COLUMN_WIDTH;
export const CABINET_GRID_HALF_WIDTH = CABINET_GRID_WIDTH / 2;
export const CABINET_BODY_WIDTH = CABINET_GRID_WIDTH + .76;
export const CABINET_ROW_HEIGHT = .621;
export const CABINET_GRID_BOTTOM_Y = .66;
export const CABINET_GRID_TOP_Y = CABINET_GRID_BOTTOM_Y + CABINET_ROWS * CABINET_ROW_HEIGHT;
export const CABINET_HEADER_HEIGHT = .57;
export const CABINET_HEADER_Y = CABINET_GRID_TOP_Y + .045 + CABINET_HEADER_HEIGHT / 2;
export const CABINET_CORNICE_TOP = CABINET_HEADER_Y + CABINET_HEADER_HEIGHT / 2 + .30;
export const CABINET_CREST_RISE = .35;
export const CABINET_BLANK_ROW_BOTTOM_Y = CABINET_GRID_BOTTOM_Y - CABINET_ROW_HEIGHT;
const originalShelfDepth = .57 / 2;
const shelfFrontZ = .385 + originalShelfDepth / 2;
const originalBackingZ = .35;
export const CABINET_DEPTH_FACTOR = .85;
export const CABINET_SHELF_DEPTH = originalShelfDepth * CABINET_DEPTH_FACTOR;
export const CABINET_SHELF_CENTER_Z = shelfFrontZ - CABINET_SHELF_DEPTH / 2;
export const CABINET_BACK_FRONT_Z = shelfFrontZ - (shelfFrontZ - originalBackingZ) * CABINET_DEPTH_FACTOR;
export const CABINET_CROWN_SCALE_FACTOR = .85;
// The aim frame hugs the black recess, inset from the wooden cell borders.
export const CABINET_CELL_INNER_HALF_WIDTH = CABINET_COLUMN_WIDTH / 4 - .029;
export const CABINET_CELL_INNER_HALF_HEIGHT = CABINET_ROW_HEIGHT / 4 - .031;
export const CABINET_CELL_BACK_Z = CABINET_BACK_FRONT_Z;
export const CABINET_GROUND_OFFSET = -.035;
export const CABINET_OUTLINE = Object.freeze({
  width: CABINET_GRID_WIDTH + .49, bottom: .04, top: CABINET_CORNICE_TOP - .04, front: .605, thickness: .065,
});

export function cabinetSlotAtLocalPoint(x, y) {
  const cellWidth = CABINET_COLUMN_WIDTH / 2;
  const cellHeight = CABINET_ROW_HEIGHT / 2;
  if (x < -CABINET_GRID_HALF_WIDTH || x >= CABINET_GRID_HALF_WIDTH || y < CABINET_GRID_BOTTOM_Y || y >= CABINET_GRID_TOP_Y)
    return null;
  const column = Math.floor((x + CABINET_GRID_HALF_WIDTH) / cellWidth);
  const rowFromBottom = Math.floor((y - CABINET_GRID_BOTTOM_Y) / cellHeight);
  return (CABINET_ROWS * 2 - rowFromBottom - 1) * CABINET_COLUMNS * 2 + column;
}

export function pegForSlot(index) {
  if (!Number.isInteger(index) || index < 0 || index >= CABINET_CAPACITY)
    throw new RangeError(`Шкаф вмещает ${CABINET_CAPACITY} ключей`);
  // Twelve narrow cells per row, eight rows in total; saved slot IDs stay stable.
  const cellsPerLine = CABINET_COLUMNS * 2;
  const lineFromTop = Math.floor(index / cellsPerLine);
  const column = index % cellsPerLine;
  const row = CABINET_ROWS * 2 - lineFromTop - 1;
  return {
    x: -CABINET_GRID_HALF_WIDTH + (column + .5) * CABINET_COLUMN_WIDTH / 2,
    y: CABINET_GRID_BOTTOM_Y + (row + .5) * CABINET_ROW_HEIGHT / 2,
    z: .48,
  };
}

// The flying key must finish at precisely the same pose as its stored instance.
export const CABINET_KEY_SCALE_FACTOR = 1.15 * 1.10;
export const CABINET_KEY_OFFSET_Y = .005;
export const CABINET_PLACE_SECONDS = 1.10;
export function cabinetKeyPose(index, displayScale) {
  const peg = pegForSlot(index);
  return {
    x: peg.x, y: peg.y + CABINET_KEY_OFFSET_Y, z: CABINET_CELL_BACK_Z + .055,
    scale: Math.min(.145, displayScale) * CABINET_KEY_SCALE_FACTOR,
  };
}
