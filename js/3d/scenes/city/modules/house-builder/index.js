// Stable public API for the portable KEYNLOCK house builder.
// Consumers should import from this file, never from internal implementation files.
export {
  HOUSE_SCHEMA_VERSION, HOUSE_DEFAULTS, HOUSE_PALETTES,
  normalizeHouseConfig, createHouseBlueprint, getHouseDimensions,
  maxFrontWindows, maxSideWindows,
} from './core/house-config.js';
export { windowLayout } from './core/house-layout.js';
export { createHouseModel, housePolygonCount, gableRoofProfile, roofSurfaceUV } from './core/house-model.js';
export { batchHouseGeometry } from './core/house-batch.js';
export { houseTextureCacheStats } from './core/house-textures.js';
export { houseMaterialCacheStats } from './core/house-materials.js';
