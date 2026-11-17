// Sources used by the 3D house, its Canvas fallback and the shared atmosphere.
// Historical paintings may remain in assets/, but only these ship with a build.
export const HOUSE_TEXTURE_DEFINITIONS=Object.freeze([
  ['plaster','gouache-plaster.webp',1.8],
  ['roof','gouache-roof-tiles-dense-v3.webp',1],
  ['damage','gouache-plaster-chipped-v3.webp',1],
  ['shutter','gouache-shutters-oak-louver-v5.webp',1],
  ['door','gouache-entry-door-carved-v1.webp',1],
  ['glass','gouache-window-glass-v2.webp',1],
  ['sill','gouache-window-sill-v2.webp',1],
  ['stoneBand','gouache-stone-band.webp',[3,1]],
]);

export const HOUSE_FALLBACK_TEXTURES=Object.freeze([
  ['plaster','gouache-plaster.webp'],
  ['roof','gouache-roof-tiles-dense-v3.webp'],
  ['damage','gouache-plaster-chipped.webp'],
  ['door','gouache-entry-door-carved-v1.webp'],
]);

export const HOUSE_MOSS_TEXTURE='gouache-landmark-moss-v1.webp';
