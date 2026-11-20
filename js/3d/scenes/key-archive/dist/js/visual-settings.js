export const VISUAL_STORAGE_KEY = 'keynlock-key-archive-visual-v1';

// The shared KEYNLOCK painted/locks preset: gouache, stepped light, fine ink.
export const DEFAULT_VISUAL_SETTINGS = Object.freeze({
  toonEnabled: true,
  toonLight: 80,
  toonSteps: 4,
  cartoonMaterial: 90,
  outlineEnabled: true,
  outlineStrength: 100,
  outlineSensitivity: 100,
  nightLighting: false,
  windowDaylight: 75,
  // Trial look: deep shadows drawn as pen hatching instead of solid black.
  hatchShadows: false,
  // Lower the rendering resolution while the hall runs below ~40 FPS.
  autoQuality: true,
});

const BOUNDS = Object.freeze({
  toonLight: [0, 100],
  toonSteps: [2, 8],
  cartoonMaterial: [0, 100],
  outlineStrength: [0, 100],
  outlineSensitivity: [0, 100],
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
  for (const key of ['toonEnabled', 'outlineEnabled', 'nightLighting', 'hatchShadows', 'autoQuality']) {
    if (typeof input[key] === 'boolean') settings[key] = input[key];
  }
  return settings;
}

export function visualPassNeeded(settings) {
  return Boolean((settings.toonEnabled && settings.toonLight > 0 && settings.cartoonMaterial > 0) ||
    (settings.outlineEnabled && settings.outlineStrength > 0) || settings.hatchShadows);
}
