// This is the serializable building blueprint. The city generator can consume
// this same format once the first reference house is approved.
export const HOUSE_SCHEMA_VERSION = 1;

export const HOUSE_DEFAULTS = Object.freeze({
  floors: 2,
  width: 8,
  depth: 6.5,
  floorHeight: 2.85,
  roofType: 'gable',
  roofHeight: 2.4,
  roofColor: '#a8604b',
  plasterColor: '#dec8a4',
  plasterDamage: false,
  damageAmount: 35,
  damageScale: 1,
  woodColor: '#675340',
  frontWindows: 3,
  sideWindows: 2,
  windowStyle: 'arched',
  doorStyle: 'arched',
  shutters: true,
  chimney: true,
  balcony: false,
  timberFrame: false,
});

export const HOUSE_PALETTES = Object.freeze({
  roof: ['#a8604b', '#657d80', '#775b6e', '#a8895e', '#596654', '#485565'],
  plaster: ['#dec8a4', '#ede1c9', '#afc2bd', '#b9a49a', '#c5c9aa', '#d5b1a0'],
  wood: ['#675340', '#3e5055', '#a17a4c', '#5d444b', '#8a8580', '#304c42'],
});

const LIMITS = Object.freeze({
  floors: [1, 4, 1], width: [6, 12, .5], depth: [5, 10, .5],
  floorHeight: [2.85, 2.85, .01], roofHeight: [.7, 4, .1],
  damageAmount: [0, 100, 5], damageScale: [.6, 5, .1],
  frontWindows: [1, 5, 1], sideWindows: [0, 4, 1],
});
const OPTIONS = Object.freeze({
  roofType: ['gable', 'hip', 'flat'],
  windowStyle: ['arched', 'straight'],
  doorStyle: ['arched', 'straight'],
});
const TOGGLES = ['shutters', 'chimney', 'balcony', 'timberFrame', 'plasterDamage'];

// Odd-numbered bay grids keep a central bay for the entrance or balcony.
// When the footprint shrinks, fewer full-size windows look better than a row
// of squeezed-together miniature windows (especially with open shutters).
export function maxFrontWindows(width, shutters = true) {
  const usableWidth = width - 1;
  for (let count = 5; count >= 1; count--) {
    const bays = count % 2 ? count : count + 1;
    const minSpacing = bays >= 5 ? (shutters ? 1.77 : 1.51) : (shutters ? 1.60 : 1.46);
    if (usableWidth / bays >= minSpacing) return count;
  }
  return 1;
}

export function maxSideWindows(depth, shutters = true) {
  const minSpacing = shutters ? 1.46 : 1.12;
  return Math.max(0, Math.min(4, Math.floor(depth / minSpacing - 1)));
}

function numeric(value, fallback, [min, max, step]) {
  if (value === '' || value === null || value === undefined) return fallback;
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Number((min + Math.round((Math.min(max, Math.max(min, number)) - min) / step) * step).toFixed(2));
}

export function normalizeHouseConfig(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const output = {...HOUSE_DEFAULTS};
  for (const [key, limits] of Object.entries(LIMITS)) {
    output[key] = numeric(source[key], HOUSE_DEFAULTS[key], limits);
  }
  for (const [key, values] of Object.entries(OPTIONS)) {
    output[key] = values.includes(source[key]) ? source[key] : HOUSE_DEFAULTS[key];
  }
  for (const key of ['roofColor', 'plasterColor', 'woodColor']) {
    output[key] = /^#[\da-f]{6}$/i.test(source[key]) ? source[key].toLowerCase() : HOUSE_DEFAULTS[key];
  }
  for (const key of TOGGLES) {
    output[key] = typeof source[key] === 'boolean' ? source[key] : HOUSE_DEFAULTS[key];
  }
  output.frontWindows = Math.min(output.frontWindows, maxFrontWindows(output.width, output.shutters));
  output.sideWindows = Math.min(output.sideWindows, maxSideWindows(output.depth, output.shutters));
  // A balcony needs an upper storey; keep the preference in saved blueprints,
  // but the model only draws it when the house is at least two storeys high.
  return output;
}

export function createHouseBlueprint(config, name = 'Городской дом 01') {
  return {
    schema: 'keynlock.house',
    version: HOUSE_SCHEMA_VERSION,
    name,
    params: normalizeHouseConfig(config),
  };
}

export function getHouseDimensions(config) {
  const c = normalizeHouseConfig(config);
  const walls = c.floors * c.floorHeight;
  return {width: c.width, depth: c.depth, walls, roof: c.roofType === 'flat' ? .3 : c.roofHeight,
    totalHeight: walls + (c.roofType === 'flat' ? .3 : c.roofHeight) + .32};
}
