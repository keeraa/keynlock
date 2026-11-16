/** Pure pigment math. The same gouache recipe drives 3D textures and finish swatches. */
export const PIN_PAINT_BRIGHTNESS = .63;
export const PIN_PAINT_CONTRAST = .52;
export const PIN_FINISH_TINTS = Object.freeze([
  [1.15, .85, .74], [.61, .67, .74], [1.02, 1.01, .97],
  [1.10, .94, .74], [1.18, 1.05, .78],
]);

export function pinPaintBrightness(strength) {
  return 1 - (1 - PIN_PAINT_BRIGHTNESS) * Math.max(0, Math.min(1, strength));
}

// Pixel luminosity and brush contrast are immutable for each source image.
// Cache the pigment basis once and reuse it when the strength slider moves.
export function createPigmentBasis(pixels, contrast) {
  const count = Math.floor(pixels.length / 4);
  const basis = new Float32Array(count * 3);
  if (!count) return basis;
  const mean = [0, 0, 0];
  for (let i = 0; i < pixels.length; i += 4) {
    mean[0] += pixels[i]; mean[1] += pixels[i + 1]; mean[2] += pixels[i + 2];
  }
  for (let j = 0; j < 3; j++) mean[j] /= count;
  const averageLight = mean[0] * .2126 + mean[1] * .7152 + mean[2] * .0722;
  const pigmentContrast = Math.max(0, Math.min(1, contrast));
  for (let i = 0, j = 0; i < pixels.length; i += 4, j += 3) {
    const light = pixels[i] * .2126 + pixels[i + 1] * .7152 + pixels[i + 2] * .0722;
    const brush = (light - averageLight) / 255;
    for (let channel = 0; channel < 3; channel++) {
      const pigment = (pixels[i + channel] - mean[channel]) / 255;
      basis[j + channel] = (brush * 1.38 + pigment * .17) * pigmentContrast;
    }
  }
  return basis;
}

/** Preserve broad gouache strokes; pin finishes also need darker pigment density. */
export function paintTexturePixels(pixels, strength, tint = [1, 1, 1],
  brightness = 1, contrast = 1, basis = createPigmentBasis(pixels, contrast)) {
  const result = new Uint8ClampedArray(pixels.length);
  const amount = Math.max(0, Math.min(1, strength));
  const offsets = tint.map(value => (value - 1) * .76 - .075);
  for (let i = 0, j = 0; i < pixels.length; i += 4, j += 3) {
    for (let channel = 0; channel < 3; channel++) {
      result[i + channel] = Math.round(255 * brightness *
        (1 + amount * (basis[j + channel] + offsets[channel])));
    }
    result[i + 3] = 255;
  }
  return result;
}
