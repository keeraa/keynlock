import { ALCHEMY_LAIR_SCALE, ALCHEMY_TABLE } from '@keynlock/alchemy/src/table-dimensions.js';

// Depth increases from the window wall toward the entrance.
export const WORKSHOP_SHIFT = 1.5 * ALCHEMY_TABLE.width * ALCHEMY_LAIR_SCALE;
export const ROOM_START = -5.72;
export const ROOM_END = 26.42 - WORKSHOP_SHIFT;
export const ROOM_LENGTH = ROOM_END - ROOM_START;
export const ROOM_CENTER_Z = (ROOM_START + ROOM_END) / 2;

export const ATELIER_Z = 10.35 - WORKSHOP_SHIFT;
export const ALCHEMY_Z = 10.10 - WORKSHOP_SHIFT;
export const WORKBENCH_Z = 20.07 - WORKSHOP_SHIFT;

const firstBeamZ = -3.8;
const beamSpacing = (ROOM_END - 1.9 - firstBeamZ) / 5;
export const CEILING_BEAM_Z = Object.freeze(Array.from({ length: 6 }, (_, i) => firstBeamZ + i * beamSpacing));
