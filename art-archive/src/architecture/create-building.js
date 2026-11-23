import { createBuildingContext } from './context.js';
import { buildCentralFloor } from './floors.js';
import { buildRotunda } from './rotunda.js';
import { buildGalleries } from './galleries.js';
import { buildDome } from './dome.js';
import { buildStairs } from './stairs.js';
import { buildLowerManor } from './manor.js';
import {buildStorageTables} from './storage-tables.js';

// Assembly only. Builders add geometry; the shared context owns its resources.
export function createArchiveBuilding(options) {
  const context = createBuildingContext(options);
  buildCentralFloor(context);
  buildRotunda(context);
  buildGalleries(context);
  buildDome(context);
  buildStairs(context);
  buildStorageTables(context);
  buildLowerManor(context);
  const { root, roofs, upper, labels, dispose, refreshLanguage } = context;
  return {
    root, roofs, upper, labels, dispose, refreshLanguage,
    setCutaway(value) {
      roofs.visible = !value;
      upper.visible = !value;
    },
    stats: { wings: options.layout.halls.length, storey: 3, stairs: 1 },
  };
}
