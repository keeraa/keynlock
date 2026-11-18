export const CABINET_Z = [-17, -8.5, 0, 8.5, 17];

// Four rows of six square compartments; the fifth, lower row is a solid front.
// Four broken keys per family are recycled, so 96 keys actually need pegs.
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
export const CABINET_PEG_VISIBLE_LENGTH = .175;
export const CABINET_PEG_BACK_Z = .34;
export const CABINET_PEG_TIP_Z = .525;
export const CABINET_PEG_LENGTH = CABINET_PEG_TIP_Z - CABINET_PEG_BACK_Z;
export const CABINET_PEG_CENTER_Z = (CABINET_PEG_BACK_Z + CABINET_PEG_TIP_Z) / 2;
export const CABINET_BACK_FRONT_Z = .29 + .12 / 2;
export const CABINET_GROUND_OFFSET = -.035;
export const CABINET_OUTLINE = Object.freeze({
  width: 3.73, bottom: .04, top: 4.85, front: .605, thickness: .065,
});

export function pegForSlot(index) {
  if (!Number.isInteger(index) || index < 0 || index >= CABINET_CAPACITY)
    throw new RangeError(`Шкаф вмещает ${CABINET_CAPACITY} ключей`);
  // Fill a complete horizontal line of 12 pegs before moving down.
  const pegsPerLine = CABINET_COLUMNS * 2;
  const lineFromTop = Math.floor(index / pegsPerLine);
  const pegAcross = index % pegsPerLine;
  const column = Math.floor(pegAcross / 2);
  const rowFromTop = Math.floor(lineFromTop / 2);
  const row = CABINET_ROWS - rowFromTop - 1;
  return {
    x: -1.62 + (column + .5) * CABINET_COLUMN_WIDTH + (pegAcross % 2 ? .125 : -.125),
    y: CABINET_GRID_BOTTOM_Y + row * CABINET_ROW_HEIGHT + (lineFromTop % 2 ? .22 : .43),
    z: .50,
  };
}
