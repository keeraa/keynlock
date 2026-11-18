import * as THREE from '../vendor/three.js';
import { createInkOutlines as createVillageInkOutlines } from './engine/ink-outlines.js';

// The exact Village Engine silhouette shader used by KEYNLOCK's lair.
// This adapter only manages the Archive's changing keys and visual controls.
export function createInkOutlines(scene, initialSettings) {
  const ink = createVillageInkOutlines(THREE, {
    enabled: true, color: 0x2b241d, screenWidth: .0042,
  });
  const staticShells = new Map();
  const instancedShells = new Map();
  let settings = initialSettings;

  function isOpaqueInstanced(mesh) {
    if (!mesh.isInstancedMesh || mesh.userData.inkSkipOutline) return false;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    return materials.some(material => material &&
      (material.isMeshStandardMaterial || material.isMeshToonMaterial ||
       material.isMeshLambertMaterial || material.isMeshPhongMaterial) &&
      !material.transparent && material.opacity >= .98);
  }

  function register(root, { strokeScale = .9 } = {}) {
    if (!root) return;
    if (!root.isInstancedMesh && !staticShells.has(root) &&
        ink.attach(root, { registrationOffset: [.00008, -.00011], strokeScale })) {
      const shell = root.children.find(child => child.userData.inkOutlineShell);
      if (shell) staticShells.set(root, { shell, strokeScale });
    }
    root.traverse?.(object => {
      if (!isOpaqueInstanced(object) || instancedShells.has(object)) return;
      const instanceScale = .85;
      const shell = ink.attachInstanced(object, { strokeScale: instanceScale, opacity: .99 });
      if (shell) instancedShells.set(object, { shell, strokeScale: instanceScale });
    });
    setSettings(settings);
  }

  function unregister(root) {
    if (!root) return;
    if (staticShells.has(root)) {
      ink.detach(root);
      staticShells.delete(root);
    }
    root.traverse?.(object => {
      if (!instancedShells.has(object)) return;
      ink.detachInstanced(object);
      instancedShells.delete(object);
    });
  }

  function setSettings(next) {
    settings = next;
    const opacity = Math.max(0, Math.min(1, Number(next.outlineStrength) / 100));
    const enabled = Boolean(next.outlineEnabled && opacity > 0);
    const width = Math.max(1, Math.min(4, Number(next.outlineWidth) || 1));
    const thickness = width * (.75 + .25 * opacity);
    for (const { shell, strokeScale } of staticShells.values()) {
      shell.visible = enabled;
      shell.material.uniforms.strokeScale.value = strokeScale * thickness;
      shell.material.uniforms.inkOpacity.value = opacity;
    }
    for (const { shell, strokeScale } of instancedShells.values()) {
      shell.material.uniforms.strokeScale.value = strokeScale * thickness;
      shell.material.uniforms.inkOpacity.value = opacity;
    }
    ink.setAnimatedEnabled(enabled);
  }

  function update() { ink.syncInstanced(); }

  function dispose() {
    ink.dispose();
    staticShells.clear();
    instancedShells.clear();
  }

  setSettings(initialSettings);
  return { register, unregister, setSettings, update, dispose };
}
