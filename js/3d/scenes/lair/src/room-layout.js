import { ALCHEMY_LAIR_SCALE, ALCHEMY_TABLE } from '@keynlock/alchemy/room-assets';

// Shared room dimensions and placement along the axis from window to entrance.
export const WORKSHOP_SHIFT = 1.5 * ALCHEMY_TABLE.width * ALCHEMY_LAIR_SCALE;
export const ROOM_START = -5.72;
export const ROOM_END = 12.90;
export const ROOM_LENGTH = ROOM_END - ROOM_START;
export const ROOM_CENTER_Z = (ROOM_START + ROOM_END) / 2;
export const ROOM_WALL_X = 8.415;
export const ROOM_WINDOW_WALL_Z = -5.485;
export const ROOM_FLOOR_Y = .0385;
export const ROOM_CEILING_Y = 10.5;
export const ROOM_WALL_BASE_Y = -.14;
export const ROOM_WALL_TOP_Y = ROOM_CEILING_Y + .14;

export const ATELIER_Z = 10.35 - WORKSHOP_SHIFT;
// Leave room for the bookcase beyond the end of the long alchemy shelf.
export const ALCHEMY_Z = 11.20 - WORKSHOP_SHIFT;
export const WORKBENCH_Z = ALCHEMY_Z + 4.90;

const firstBeamZ = -3.8;
const beamSpacing = (ROOM_END - 1.9 - firstBeamZ) / 5;
export const CEILING_BEAM_Z = Object.freeze(Array.from({ length: 6 }, (_, i) => firstBeamZ + i * beamSpacing));
