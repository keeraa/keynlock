import { createPaperWatercolor } from './paper.js';
import { createFluidWatercolor } from './fluid.js';
export { createPaperWatercolor, PAPER_RECONSTRUCTION_GLSL } from './paper.js';
export { createSourceDrop } from './source-drop.js';
export { VERSION, WATERCOLOR_SMOKE_V1, WATERCOLOR_WASH } from './preset.js';
export { WATERCOLOR_PALETTE } from './watercolor-appearance.js';

/** Host owns Three, renderer, animation loop, input and obstacle geometry. */
export async function createWatercolorEffect(args = {}) {
  const appearance = args.options?.appearance ?? 'paper';
  if (appearance === 'paper') return createPaperWatercolor(args);
  if (appearance === 'smoke' || appearance === 'wash') return createFluidWatercolor(args);
  throw new RangeError('Unknown appearance: ' + appearance);
}
// Compatibility name retained for existing KEYNLOCK integrations.
export const createWatercolorSmoke = createWatercolorEffect;
