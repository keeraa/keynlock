// @ts-check
/** Shared KEYNLOCK canvas-texture preparation; pigment recipes stay scene-specific. */
export const PAINTED_FINISHES = Object.freeze(['steel', 'graphite', 'enamel', 'brass', 'copper']);

export function createPaintedTextureSurface({ THREE, document, image, size = 512 }) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(image, 0, 0, size, size);
  const originalPixels = context.getImageData(0, 0, size, size).data;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.MirroredRepeatWrapping;
  texture.anisotropy = 4;
  return { canvas, context, originalPixels, texture };
}
