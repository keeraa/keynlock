/** Hand-painted albedo stays on the mechanism when the camera moves. */
import { PAINTED_SURFACES, PAINTED_VARIANTS, PALETTE_TINT,
  createPaintedAssetCache } from './painted-assets.js';
import { paintTexturePixels, PIN_FINISH_TINTS, pinPaintBrightness } from './painted-pigment.js';

// Existing finish swatches and public consumers keep the same import path.
export { PIN_PAINT_BRIGHTNESS, PIN_PAINT_CONTRAST, PIN_FINISH_TINTS,
  pinPaintBrightness, paintTexturePixels } from './painted-pigment.js';

/** Original MeshStandardMaterials remain the source of truth for colors and controls. */
export function createPaintedMaterials({ THREE, mat, document, textureLoader, extraSurfaces = [],
  scheduleRepaintFrame = callback => typeof requestAnimationFrame === 'function' ?
    requestAnimationFrame(callback) : callback() }) {
  const surfaces = [
    ...Object.entries(PAINTED_SURFACES).map(([key, kind]) => ({ material: mat[key], kind })),
    ...extraSurfaces,
  ].map(({ material, kind, mesh }) => {
      return material?.isMeshStandardMaterial ? {
        material, kind, mesh, original: {
          map: material.map, metalness: material.metalness, roughness: material.roughness,
        },
      } : null;
    }).filter(Boolean);
  const neededKinds = new Set(surfaces.map(surface => surface.kind));
  const options = { enabled: false, textureStrength: .95, materialStrength: .90,
    detail: .02, steelVariant: 'steel', brassVariant: 'brass' };
  const cache = createPaintedAssetCache({ THREE, document, textureLoader,
    onReady: record => { repaint(record); apply(); } });
  const { records } = cache;
  let pinTint = PIN_FINISH_TINTS[3];
  let pinFinishIndex = 3;
  let disposed = false;
  const repaintQueue = new Set();
  let repaintScheduled = false;

  function updateRepeat(record) {
    const repeat = .65 + options.detail * 1.95;
    // Copper uses exactly two mirrored UV repeats, independent of the detail slider.
    const scale = record.variant === 'pin' ? repeat * .80 :
      record.variant === 'copper' ? 2 : repeat;
    if (record.texture.repeat.x !== scale || record.texture.repeat.y !== scale)
      record.texture.repeat.set(scale, scale);
  }

  function repaint(record) {
    const pixels = paintTexturePixels(record.originalPixels, options.textureStrength,
      record.variant === 'pin' ? pinTint : PALETTE_TINT[record.variant],
      record.variant === 'pin' ? pinPaintBrightness(options.textureStrength) : 1,
      record.contrast, record.pigmentBasis);
    const image = record.context.createImageData(record.canvas.width, record.canvas.height);
    image.data.set(pixels);
    record.context.putImageData(image, 0, 0);
    updateRepeat(record);
    record.texture.needsUpdate = true;
    record.paintedStrength = options.textureStrength;
    if (record.variant === 'pin') record.paintedPinFinish = pinFinishIndex;
  }

  function selectedVariants() {
    return [
      ...(neededKinds.has('steel') ? [options.steelVariant] : []),
      ...(neededKinds.has('brass') ? [options.brassVariant] : []),
      ...['gear', 'pin', 'manifold'].filter(kind => neededKinds.has(kind)),
    ];
  }

  function needsRepaint(record) {
    return record.paintedStrength !== options.textureStrength ||
      (record.variant === 'pin' && record.paintedPinFinish !== pinFinishIndex);
  }

  // Rapid slider inputs share a frame; each frame processes at most one 512px
  // texture so five synchronous canvas reads/uploads never block one frame.
  function scheduleNextRepaint() {
    if (repaintScheduled || !repaintQueue.size) return;
    repaintScheduled = true;
    scheduleRepaintFrame(() => {
      repaintScheduled = false;
      if (disposed || !options.enabled || options.textureStrength <= 0) {
        repaintQueue.clear();
        return;
      }
      const record = repaintQueue.values().next().value;
      repaintQueue.delete(record);
      if (selectedVariants().includes(record.variant) && needsRepaint(record)) repaint(record);
      scheduleNextRepaint();
    });
  }

  function queueStalePaint() {
    if (!options.enabled || options.textureStrength <= 0) return;
    for (const variant of selectedVariants()) {
      const record = records[variant];
      if (record && needsRepaint(record)) repaintQueue.add(record);
    }
    scheduleNextRepaint();
  }

  function apply() {
    for (const { material, kind, mesh, original } of surfaces) {
      const variant = kind === 'steel' ? options.steelVariant :
        kind === 'brass' ? options.brassVariant : kind;
      const record = records[variant];
      const rust = mesh?.userData.rustState;
      const baseMap = rust && rust.level < .025 ? null : original.map;
      const desiredMap = options.enabled && options.textureStrength > 0 && record ?
        record.texture : baseMap;
      if (material.map !== desiredMap) {
        material.map = desiredMap;
        material.needsUpdate = true;
      }
      const strength = options.enabled ? options.materialStrength : 0;
      const baseRoughness = rust ? Math.min(.97, rust.cleanRoughness + rust.level * .29) :
        original.roughness;
      material.metalness = original.metalness * (1 - strength * .68);
      material.roughness = baseRoughness +
        (Math.max(baseRoughness, .78) - baseRoughness) * strength;
    }
  }

  function setOptions(next) {
    if (disposed) return;
    const previousDetail = options.detail;
    for (const key of Object.keys(options)) {
      if (!Object.hasOwn(next, key)) continue;
      if (key === 'enabled') options[key] = Boolean(next[key]);
      else if (key === 'steelVariant' || key === 'brassVariant') {
        const group = key === 'steelVariant' ? 'steel' : 'brass';
        if (PAINTED_VARIANTS[group].includes(next[key])) options[key] = next[key];
      } else options[key] = Math.max(0, Math.min(1, Number(next[key]) || 0));
    }
    if (options.enabled) cache.loadSelected(selectedVariants());
    if (options.detail !== previousDetail)
      for (const record of Object.values(records)) if (record) updateRepeat(record);
    if (options.enabled) queueStalePaint();
    else repaintQueue.clear();
    apply();
  }

  /** A changed case finish updates the restoration baseline without losing the painting. */
  function setBaseCaseRoughness(value) {
    const caseSurface = surfaces.find(surface => surface.material === mat.case);
    if (!caseSurface) return;
    caseSurface.original.roughness = value;
    apply();
  }

  /** Changing a pin finish preserves the selected base map beneath its gouache layer. */
  function setPinBaseTexture(texture, finishIndex) {
    if (disposed) return;
    for (const surface of surfaces) {
      if (surface.kind === 'pin') surface.original.map = texture;
    }
    pinFinishIndex = PIN_FINISH_TINTS[finishIndex] ? finishIndex : 3;
    pinTint = PIN_FINISH_TINTS[pinFinishIndex];
    queueStalePaint();
    apply();
  }

  function dispose() {
    if (disposed) return;
    options.enabled = false;
    apply();
    disposed = true;
    repaintQueue.clear();
    cache.dispose();
  }

  return { setOptions, setBaseCaseRoughness, setPinBaseTexture, dispose };
}
