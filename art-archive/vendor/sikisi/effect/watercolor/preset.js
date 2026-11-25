import { WATERCOLOR_PALETTE } from './watercolor-appearance.js';
export const VERSION = '2.13.0';
/** Frozen visual preset: accepted smoke with sustained motion and mesh obstacles. */
export const WATERCOLOR_SMOKE_V1 = Object.freeze({
  gravity: 0,
  edgeSoftness: 1.5,
  impulse: 30,
  swirl: 5,
  density: 0.1,
  vorticity: 2.5,
  emissionDuration: 1.6,
  velocityDecay: 0.06,
  pigmentDecay: 0.26,
  velocityDiffusion: 0.02,
  pigmentDiffusion: 0.025,
  pressureIterations: 12,
  pigments: Object.freeze(
    [
      [0.48, 0.12, 0.06],
      [0.04, 0.28, 0.38],
      [0.1, 0.06, 0.42],
    ].map((c) => Object.freeze(c)),
  ),
});

export const WATERCOLOR_WASH = Object.freeze({
  ...WATERCOLOR_SMOKE_V1,
  appearance: 'wash',
  pigmentDecay: 0.38,
  density: 0.14,
  gravity: 28,
  impulse: 12,
  swirl: 1.8,
  vorticity: 0.8,
  palette: WATERCOLOR_PALETTE,
});
