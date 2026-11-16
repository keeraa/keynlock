/** Reusable painted-wood grading and material assignment. */
export function gradeWoodTexture({ THREE, texture, grade }) {
  if (!grade) return texture;
  const image = texture.image;
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = pixels.data;
  const mean = [0, 0, 0];
  const count = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    mean[0] += data[i];
    mean[1] += data[i + 1];
    mean[2] += data[i + 2];
  }
  for (let channel = 0; channel < 3; channel++) mean[channel] /= count;
  for (let i = 0; i < data.length; i += 4) {
    const r = mean[0] + (data[i] - mean[0]) * grade.contrast;
    const g = mean[1] + (data[i + 1] - mean[1]) * grade.contrast;
    const b = mean[2] + (data[i + 2] - mean[2]) * grade.contrast;
    const luminance = r * .2126 + g * .7152 + b * .0722;
    data[i] = luminance + (r - luminance) * grade.saturation + grade.tint[0];
    data[i + 1] = luminance + (g - luminance) * grade.saturation + grade.tint[1];
    data[i + 2] = luminance + (b - luminance) * grade.saturation + grade.tint[2];
  }
  ctx.putImageData(pixels, 0, 0);
  const corrected = new THREE.CanvasTexture(canvas);
  texture.dispose();
  return corrected;
}

export function applyWoodTexture(materials, texture) {
  for (const [material, tint] of materials) {
    material.map = texture;
    material.color.set(tint);
    material.roughness = 1;
    material.metalness = 0;
    material.needsUpdate = true;
  }
}
