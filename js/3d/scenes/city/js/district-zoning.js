// Geographic zoning plan for the KEYNLOCK city rebuild.
// Pixel coordinates are in the reference plan's original 1548 x 1148 space.
// This is a separate cartographic coordinate system: the legacy 3D scene still
// uses its original coastline and must be migrated deliberately.
export const ZONING_PLAN = Object.freeze({
  version: 1,
  width: 1548,
  height: 1148,
  reference: 'assets/district-zones-reference.png',
});

// The main navigable river remains unassigned. Districts end at its banks.
// Keep this shape independent from district boundaries so future water/terrain
// generation can use one contiguous outline.
export const MAIN_RIVER = Object.freeze([
  [485, 387], [566, 343], [603, 274], [648, 217], [704, 199],
  [785, 194], [831, 219], [858, 258], [900, 239], [1025, 185],
  [1141, 153], [1231, 151], [1354, 171], [1505, 202],
  [1505, 306], [1374, 301], [1229, 298], [1124, 319],
  [991, 370], [903, 411], [802, 464], [716, 515],
  [630, 569], [541, 631], [444, 700], [354, 754],
  [237, 824], [107, 899], [0, 957], [0, 869], [110, 816],
  [236, 743], [342, 670], [419, 604], [474, 471],
]);

export const NORTHWEST_CHANNEL = Object.freeze([
  [0, 140], [25, 129], [73, 176], [126, 218], [190, 267],
  [278, 309], [365, 344], [475, 383], [516, 377],
  [474, 471], [320, 445], [190, 391], [60, 338], [0, 305],
]);
export const WATERWAYS = Object.freeze([MAIN_RIVER, NORTHWEST_CHANNEL]);

// Borough boundaries follow the waterways and broad roads of the supplied
// reference. They form seven editable, data-driven zones, with fixed anchors.
export const DISTRICT_ZONES = Object.freeze([
  {
    id: 'industrial',
    anchor: [270, 120],
    notes: 'Северо-западный берег: фабрики, мастерские и рабочие улицы.',
    polygons: [[
      [23, 22], [537, 22], [541, 148], [515, 245], [505, 375],
      [350, 354], [244, 314], [122, 226], [23, 137],
    ]],
  },
  {
    id: 'palace',
    anchor: [724, 118],
    notes: 'Северный парк, парадные аллеи, дворец и островной подход.',
    polygons: [[
      [537, 22], [981, 22], [1010, 116], [995, 170],
      [861, 225], [833, 213], [785, 194], [704, 199],
      [648, 217], [603, 274], [566, 343], [516, 377],
      [505, 375], [515, 245], [541, 148],
    ]],
  },
  {
    id: 'upper',
    anchor: [1280, 91],
    notes: 'Северо-восточные кварталы, сады и особняки.',
    polygons: [[
      [981, 22], [1506, 22], [1506, 205], [1354, 171],
      [1231, 151], [1141, 153], [1025, 185], [995, 170],
      [1010, 116],
    ]],
  },
  {
    id: 'port',
    anchor: [225, 626],
    notes: 'Западные причалы и торговая застройка вдоль большой реки.',
    polygons: [[
      [0, 305], [320, 445], [475, 471], [630, 569],
      [580, 685], [391, 764], [237, 824], [0, 975],
    ]],
  },
  {
    id: 'arts',
    anchor: [878, 685],
    notes: 'Центральный квартал галерей, музея, театра и каналов.',
    polygons: [[
      [630, 569], [802, 464], [991, 370], [1124, 319],
      [1120, 552], [1181, 945], [993, 855], [803, 807],
      [629, 757], [580, 685],
    ]],
  },
  {
    id: 'bohemian',
    anchor: [703, 1006],
    notes: 'Южные извилистые улицы, мастерские, маленькие площади и дворы.',
    polygons: [[
      [0, 975], [237, 824], [391, 764], [580, 685],
      [629, 757], [803, 807], [993, 855], [1181, 945],
      [1192, 1133], [0, 1133],
    ]],
  },
  {
    id: 'old',
    anchor: [1335, 755],
    notes: 'Восточная плотная застройка, старые переулки и лавки.',
    polygons: [[
      [1124, 319], [1506, 306], [1506, 1133],
      [1192, 1133], [1181, 945], [1120, 552],
    ]],
  },
]);

export function pointInPolygon(x, y, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i], [xj, yj] = polygon[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

export function districtZoneAt(x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y) ||
      x < 0 || y < 0 || x > ZONING_PLAN.width || y > ZONING_PLAN.height ||
      WATERWAYS.some(waterway => pointInPolygon(x, y, waterway))) return null;
  return DISTRICT_ZONES.find(zone => zone.polygons.some(polygon => pointInPolygon(x, y, polygon)))?.id ?? null;
}

export function polygonPath(polygon) {
  return polygon.map(([x, y], index) => `${index ? 'L' : 'M'}${x},${y}`).join(' ') + ' Z';
}
