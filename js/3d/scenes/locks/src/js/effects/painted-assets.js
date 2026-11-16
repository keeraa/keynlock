import { createPigmentBasis, PIN_PAINT_CONTRAST } from './painted-pigment.js';
import { createPaintedTextureSurface } from '../../../../../core/rendering/painted-texture.js';

export const PAINTED_SURFACES = Object.freeze({
  case: 'steel', edge: 'steel', dark: 'steel', inner: 'steel',
  steel: 'steel', chromed: 'steel', spring: 'steel',
  brass: 'brass', copper: 'brass', key: 'brass',
});

const PAINTED_ASSETS = Object.freeze({
  steel: './assets/painted-steel.webp',
  graphite: './assets/painted-graphite.webp',
  enamel: './assets/painted-enamel.webp',
  brass: './assets/painted-brass.webp',
  copper: './assets/painted-copper.webp',
  gear: './assets/painted-gear.webp',
  pin: './assets/painted-pin.webp',
  manifold: './assets/painted-manifold.webp',
});

export const PAINTED_VARIANTS = Object.freeze({
  steel: ['steel', 'graphite', 'enamel'],
  brass: ['brass', 'copper'],
});

export const PALETTE_TINT = Object.freeze({
  steel: [1, 1, 1], graphite: [.82, .90, .96], enamel: [.78, 1.09, 1.11],
  brass: [1, 1, 1], copper: [1.10, .87, .83],
  gear: [1.04, .98, .93], manifold: [.79, .91, 1.01],
});

/** Lazy decode and GPU canvas cache; material application lives in painted-materials.js. */
export function createPaintedAssetCache({ THREE, document, textureLoader, onReady }) {
  const loader = textureLoader || new THREE.TextureLoader();
  const records = Object.fromEntries(Object.keys(PAINTED_ASSETS).map(key => [key, null]));
  const requested = new Set();
  let disposed = false;

  function loadSelected(variants) {
    if (disposed) return;
    for (const variant of variants) {
      if (requested.has(variant) || records[variant]) continue;
      requested.add(variant);
      const url = PAINTED_ASSETS[variant];
      loader.load(url, loaded => {
        if (disposed) { loaded.dispose(); return; }
        let record = null;
        try {
          const surface = createPaintedTextureSurface({ THREE, document, image: loaded.image });
          if (!surface) {
            requested.delete(variant);
            return;
          }
          const { canvas, context, originalPixels, texture } = surface;
          const contrast = variant === 'pin' ? PIN_PAINT_CONTRAST :
            variant === 'copper' ? .84 : 1;
          record = { canvas, context, originalPixels, texture, variant, contrast,
            pigmentBasis: createPigmentBasis(originalPixels, contrast) };
          records[variant] = record;
          onReady(record);
        } catch (error) {
          if (record) {
            record.texture.dispose();
            records[variant] = null;
          }
          requested.delete(variant);
          console.warn('Не удалось подготовить рисованный материал:', variant, error);
        } finally {
          loaded.dispose();
        }
      }, undefined, () => {
        requested.delete(variant);
        console.warn('Не загружена рисованная текстура:', url);
      });
    }
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    for (const record of Object.values(records)) record?.texture.dispose();
  }
  return { records, loadSelected, dispose };
}
