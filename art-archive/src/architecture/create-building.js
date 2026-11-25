import { createBuildingContext } from './context.js';
import { buildCentralFloor } from './floors.js';
import { buildRotunda } from './rotunda.js';
import { buildGalleries } from './galleries.js';
import { buildDome } from './dome.js';
import { buildStairs } from './stairs.js';
import { buildLowerManor } from './manor.js';
import {buildWainscot} from './wainscot.js';
import {buildStorageTables} from './storage-tables.js';
import {buildRotundaFurniture} from './rotunda-furniture.js';

// Assembly only. Builders add geometry; the shared context owns its resources.
export function createArchiveBuilding(options) {
  const context = createBuildingContext(options);
  context.hallGlows=new Map();
  buildCentralFloor(context);
  buildRotunda(context);
  buildGalleries(context);
  buildWainscot(context);
  buildDome(context);
  buildStairs(context);
  buildStorageTables(context);
  buildRotundaFurniture(context);
  buildLowerManor(context);
  const { root, roofs, upper, labels, dispose, refreshLanguage } = context;
  return {
    root, roofs, upper, labels, dispose, refreshLanguage,
    setHallGlow(hall,strength){
      const glow=context.hallGlows.get(hall);
      if(glow)glow.value=strength;
    },
    setCutaway(value) {
      roofs.visible = !value;
      upper.visible = !value;
    },
    stats: { wings: options.layout.halls.length, storey: 3, stairs: 1 },
  };
}
