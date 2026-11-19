export const CABINET_Z = [-17, -8.5, 0, 8.5, 17];

// 24 original compartments subdivided into four individual standing slots.
export const CABINET_COLUMNS = 6;
export const CABINET_ROWS = 4;
export const KEYS_PER_COMPARTMENT = 4;
export const CABINET_CAPACITY = CABINET_COLUMNS * CABINET_ROWS * KEYS_PER_COMPARTMENT;
export const CABINET_COLUMN_WIDTH = 3.24 / CABINET_COLUMNS;
export const CABINET_ROW_HEIGHT = CABINET_COLUMN_WIDTH;
export const CABINET_GRID_BOTTOM_Y = 1.20;
export const CABINET_GRID_TOP_Y = CABINET_GRID_BOTTOM_Y + CABINET_ROWS * CABINET_ROW_HEIGHT;
export const CABINET_BLANK_ROW_BOTTOM_Y = CABINET_GRID_BOTTOM_Y - CABINET_ROW_HEIGHT;
export const CABINET_SHELF_DEPTH = .57 / 2;
export const CABINET_SHELF_CENTER_Z = .385;
// The visible section ends inside the cabinet's front trim.
export const CABINET_BACK_FRONT_Z = .29 + .12 / 2;
// The aim frame hugs the black recess, inset from the wooden cell borders.
export const CABINET_CELL_INNER_HALF_WIDTH = .106;
export const CABINET_CELL_INNER_HALF_HEIGHT = .104;
export const CABINET_CELL_BACK_Z = CABINET_BACK_FRONT_Z;
export const CABINET_GROUND_OFFSET = -.035;
export const CABINET_OUTLINE = Object.freeze({
  width: 3.73, bottom: .04, top: 4.85, front: .605, thickness: .065,
});

export function cabinetSlotAtLocalPoint(x, y) {
  const cellWidth = CABINET_COLUMN_WIDTH / 2;
  const cellHeight = CABINET_ROW_HEIGHT / 2;
  if (x < -1.62 || x >= 1.62 || y < CABINET_GRID_BOTTOM_Y || y >= CABINET_GRID_TOP_Y)
    return null;
  const column = Math.floor((x + 1.62) / cellWidth);
  const rowFromBottom = Math.floor((y - CABINET_GRID_BOTTOM_Y) / cellHeight);
  return (CABINET_ROWS * 2 - rowFromBottom - 1) * CABINET_COLUMNS * 2 + column;
}

export function pegForSlot(index) {
  if (!Number.isInteger(index) || index < 0 || index >= CABINET_CAPACITY)
    throw new RangeError(`Шкаф вмещает ${CABINET_CAPACITY} ключей`);
  // Twelve narrow cells per row, eight rows in total, numbered top to bottom.
  const cellsPerLine = CABINET_COLUMNS * 2;
  const lineFromTop = Math.floor(index / cellsPerLine);
  const column = index % cellsPerLine;
  const row = CABINET_ROWS * 2 - lineFromTop - 1;
  return {
    x: -1.62 + (column + .5) * CABINET_COLUMN_WIDTH / 2,
    y: CABINET_GRID_BOTTOM_Y + (row + .5) * CABINET_ROW_HEIGHT / 2,
    z: .48,
  };
}

// The flying key must finish at precisely the same pose as its stored instance.
export const CABINET_PLACE_SECONDS = 1.10;
export function cabinetKeyPose(index, displayScale) {
  const peg = pegForSlot(index);
  return {
    x: peg.x, y: peg.y - .015, z: peg.z,
    scale: Math.min(.145, displayScale),
  };
}
