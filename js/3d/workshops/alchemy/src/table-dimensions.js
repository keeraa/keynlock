const topY = .04;
const standaloneFootY = -9.525;

export const ALCHEMY_LAIR_SCALE = .28;
const lairWorkingHeight = .95;

export const ALCHEMY_TABLE = Object.freeze({
  width: 14.4,
  topY,
  standaloneFootY,
  // Shorten the embedded legs while keeping the whole work surface and its
  // equipment in the laboratory's local coordinates.
  lairFootY: topY - lairWorkingHeight / ALCHEMY_LAIR_SCALE,
  footHeight: .13,
});
