// @ts-check
import { createVisualSystem } from '../visuals.js';
import { ALCHEMY_LOOK } from './alchemy-look.js';

/** Shared gouache/toon/outline treatment. The consumer supplies its own
 * materials and meshes, so the original alchemy palette can be reused by Lair.
 */
export const ALCHEMY_FILTERS = ALCHEMY_LOOK.filters;

export function createAlchemyFilters({scene,renderer,materials,document,
  textureLoader,contours=[]}) {
  const filters = createVisualSystem(scene,renderer,materials,document,textureLoader,contours);
  return {
    ...filters,
    profile:ALCHEMY_FILTERS,
    applyProfile(profile=ALCHEMY_FILTERS) {
      for(const [key,value] of Object.entries(profile)) filters.set(key,value);
    },
  };
}
