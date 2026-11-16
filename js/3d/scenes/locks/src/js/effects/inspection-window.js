/** The viewing wall must participate in Z-buffering when fully opaque. */
export const SCHEMATIC_XRAY_TRANSPARENCY = .76;

export function setInspectionWindowOpacity(material, visibleOpacity) {
  const opacity = Math.max(0, Math.min(1, visibleOpacity));
  const solid = opacity >= .999;
  const transparent = !solid;
  if (material.transparent !== transparent) {
    material.transparent = transparent;
    material.needsUpdate = true;
  }
  material.depthWrite = solid;
  material.opacity = opacity;
  return opacity;
}
