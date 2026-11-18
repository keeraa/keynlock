export const VISUAL_STORAGE_KEY = 'keynlock-key-archive-visual-v1';

// The shared KEYNLOCK painted/locks preset: gouache, stepped light, fine ink.
export const DEFAULT_VISUAL_SETTINGS = Object.freeze({
  toonEnabled: true,
  toonLight: 80,
  toonSteps: 4,
  cartoonMaterial: 90,
  outlineEnabled: true,
  outlineStrength: 70,
  outlineWidth: 1,
  brushExpression: 95,
  strokeDetail: 2,
  wetSnowEnabled: true,
  snowIntensity: 65,
  snowWind: 28,
  windowDaylight: 75,
});

const BOUNDS = Object.freeze({
  toonLight: [0, 100],
  toonSteps: [2, 8],
  cartoonMaterial: [0, 100],
  outlineStrength: [0, 100],
  outlineWidth: [1, 4],
  brushExpression: [0, 100],
  strokeDetail: [0, 100],
  snowIntensity: [0, 100],
  snowWind: [-100, 100],
  windowDaylight: [0, 100],
});

export function normalizeVisualSettings(values) {
  const input = values && typeof values === 'object' ? values : {};
  const settings = { ...DEFAULT_VISUAL_SETTINGS };
  for (const [key, [min, max]] of Object.entries(BOUNDS)) {
    const number = Number(input[key]);
    if (input[key] != null && Number.isFinite(number))
      settings[key] = Math.min(max, Math.max(min, Math.round(number)));
  }
  for (const key of ['toonEnabled', 'outlineEnabled', 'wetSnowEnabled']) {
    if (typeof input[key] === 'boolean') settings[key] = input[key];
  }
  return settings;
}

export function visualPassNeeded(settings) {
  return Boolean((settings.toonEnabled && settings.toonLight > 0 && settings.cartoonMaterial > 0) ||
    (settings.outlineEnabled && settings.outlineStrength > 0) || settings.brushExpression > 0);
}
