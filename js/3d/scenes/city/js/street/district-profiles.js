import { DISTRICTS } from '../world-data.js';

// District-specific town-planning rules. This module is intentionally independent
// of Three.js so the city can later consume these exact building blueprints.
const RULES = {
  port: {
    character: 'Склады, купеческие дома и тесные портовые переулки',
    floors: [1, 3], width: [7, 11.5], depth: [6, 9.5], roofs: ['gable', 'hip', 'flat'],
    walls: ['#b9a394', '#d2bd9e', '#a87b67', '#d6c8ae'], roofsPalette: ['#4e5356', '#9a5747', '#70615a'],
    woods: ['#61503f', '#45565a', '#886643'], details: {shutters: .46, chimney: .74, balcony: .12, timberFrame: .44, damage: .41, arch: .36},
    roadWidth: 8.5, sidewalkWidth: 1.65, lampSpacing: 18, lampStyle: 'industrial', surface: 'cobble', setback: [.2, .8], gap: [.5, 1.25],
  },
  old: {
    character: 'Плотная старинная застройка, красные крыши, фахверк',
    floors: [2, 3], width: [6, 8.5], depth: [5.5, 7.5], roofs: ['gable', 'hip'],
    walls: ['#d9c4a1', '#c5b6a2', '#e8d6b5', '#bda48f'], roofsPalette: ['#a85d49', '#b87c53', '#805b52'],
    woods: ['#70563e', '#524a3e', '#936b4e'], details: {shutters: .85, chimney: .77, balcony: .08, timberFrame: .6, damage: .35, arch: .56},
    roadWidth: 6.3, sidewalkWidth: 1.5, lampSpacing: 15, lampStyle: 'gas', surface: 'cobble', setback: [.1, .52], gap: [.35, .9],
  },
  bohemian: {
    character: 'Разноцветные фасады, балконы и мастерские художников',
    floors: [2, 4], width: [6.5, 10], depth: [6, 8.5], roofs: ['gable', 'hip', 'flat'],
    walls: ['#d4a9a0', '#c9c3a4', '#aebeb2', '#e1c3a3', '#bab6c9'], roofsPalette: ['#aa624e', '#6b8575', '#74899b'],
    woods: ['#6f5445', '#5d6c62', '#8b714b'], details: {shutters: .73, chimney: .5, balcony: .79, timberFrame: .1, damage: .12, arch: .75},
    roadWidth: 7.2, sidewalkWidth: 2.05, lampSpacing: 16, lampStyle: 'ornate', surface: 'paving', setback: [.4, 1.1], gap: [.6, 1.5],
  },
  arts: {
    character: 'Светлый камень, галереи, арки и выразительные карнизы',
    floors: [2, 4], width: [8, 12], depth: [7, 10], roofs: ['hip', 'flat', 'gable'],
    walls: ['#e9dfc9', '#d2c8b0', '#d9d4c5', '#c9baa8'], roofsPalette: ['#647b70', '#7d8796', '#8c7b61'],
    woods: ['#695e4e', '#6b7774', '#8b7158'], details: {shutters: .28, chimney: .27, balcony: .67, timberFrame: 0, damage: .04, arch: .85},
    roadWidth: 8.7, sidewalkWidth: 2.8, lampSpacing: 15, lampStyle: 'ornate', surface: 'paving', setback: [.65, 1.45], gap: [.75, 1.75],
  },
  industrial: {
    character: 'Кирпичные корпуса, рабочие дома и металлические фонари',
    floors: [1, 3], width: [8, 12], depth: [7.5, 10], roofs: ['flat', 'gable'],
    walls: ['#9d7765', '#b48369', '#887b72', '#ba9980'], roofsPalette: ['#51575a', '#5f666a', '#905f51'],
    woods: ['#4b514d', '#6e6055', '#554d49'], details: {shutters: .12, chimney: .84, balcony: .07, timberFrame: .02, damage: .51, arch: .15},
    roadWidth: 9.4, sidewalkWidth: 1.9, lampSpacing: 22, lampStyle: 'industrial', surface: 'cobble', setback: [.3, 1], gap: [1, 2.1],
  },
  upper: {
    character: 'Просторные особняки, спокойные оттенки, высокие ограды',
    floors: [2, 4], width: [8.5, 12], depth: [7.5, 10], roofs: ['hip', 'gable'],
    walls: ['#eee2d0', '#d8d8c8', '#c5d1ca', '#ded4be'], roofsPalette: ['#557080', '#79828b', '#779089'],
    woods: ['#625d52', '#53666a', '#947859'], details: {shutters: .43, chimney: .61, balcony: .64, timberFrame: 0, damage: 0, arch: .85},
    roadWidth: 8.2, sidewalkWidth: 2.7, lampSpacing: 17, lampStyle: 'ornate', surface: 'paving', setback: [1.15, 2.45], gap: [1.6, 3],
  },
  palace: {
    character: 'Парадные резиденции, лазурные кровли и широкая мостовая',
    floors: [2, 4], width: [9, 12], depth: [8, 10], roofs: ['hip', 'gable'],
    walls: ['#e8e1d1', '#d7d6d1', '#cad4d2', '#f1e8d7'], roofsPalette: ['#566e9a', '#627eaa', '#7c879d'],
    woods: ['#6c665e', '#526179', '#8b7965'], details: {shutters: .2, chimney: .38, balcony: .76, timberFrame: 0, damage: 0, arch: .95},
    roadWidth: 10.2, sidewalkWidth: 3.3, lampSpacing: 13, lampStyle: 'ornate', surface: 'paving', setback: [1.4, 3], gap: [1.85, 3.5],
  },
};

export const DISTRICT_PROFILES = Object.freeze(Object.fromEntries(DISTRICTS.map(district => [
  district.id, Object.freeze({
    id: district.id, name: district.name, color: district.color, districtIndex: district.index,
    ...RULES[district.id],
  }),
])));

export const LAMP_STYLES = Object.freeze(['gas', 'ornate', 'industrial']);
export const ROOF_TYPES = Object.freeze(['gable', 'hip', 'flat']);

const clamp = (value, min, max) => Math.min(max, Math.max(min, Number.isFinite(Number(value)) ? Number(value) : min));
const colors = (source, fallback) => Array.isArray(source)
  ? [...new Set(source.filter(s => /^#[\da-f]{6}$/i.test(s)).map(s => s.toLowerCase()))].slice(0, 8)
  : [...fallback];

export function resolveDistrictProfile(id, overrides = {}) {
  const base = DISTRICT_PROFILES[id];
  if (!base) throw new Error(`Неизвестный район: ${id}`);
  const minFloor = Math.round(clamp(overrides.minFloor ?? base.floors[0], 1, 4));
  const maxFloor = Math.round(clamp(overrides.maxFloor ?? base.floors[1], minFloor, 4));
  const minWidth = Math.round(clamp(overrides.minWidth ?? base.width[0], 6, 12) * 2) / 2;
  const maxWidth = Math.round(clamp(overrides.maxWidth ?? base.width[1], minWidth, 12) * 2) / 2;
  const roofs = Array.isArray(overrides.roofs)
    ? [...new Set(overrides.roofs.filter(roof => ROOF_TYPES.includes(roof)))]
    : [...base.roofs];
  const walls = colors(overrides.walls, base.walls);
  const roofsPalette = colors(overrides.roofsPalette, base.roofsPalette);
  return {
    ...base, floors: [minFloor, maxFloor], width: [minWidth, maxWidth],
    roofs: roofs.length ? roofs : [...base.roofs], walls: walls.length ? walls : [...base.walls],
    roofsPalette: roofsPalette.length ? roofsPalette : [...base.roofsPalette],
    roadWidth: Math.round(clamp(overrides.roadWidth ?? base.roadWidth, 5, 13) * 10) / 10,
    sidewalkWidth: Math.round(clamp(overrides.sidewalkWidth ?? base.sidewalkWidth, 1, 4) * 10) / 10,
    lampSpacing: Math.round(clamp(overrides.lampSpacing ?? base.lampSpacing, 10, 28)),
    lampStyle: LAMP_STYLES.includes(overrides.lampStyle) ? overrides.lampStyle : base.lampStyle,
    gapScale: Math.round(clamp(overrides.gapScale ?? 1, .6, 2) * 10) / 10,
  };
}
