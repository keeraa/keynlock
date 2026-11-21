// @ts-check
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Scenes are built from hundreds of small boxes and cylinders: floor planks,
// table legs, chandelier braces, rack posts. Each is a draw call in the colour
// pass, the shadow pass and the ink outline. Used by the Lair's room and the
// alchemy table; call it after building and before outlines are attached. Siblings that never move and share a
// material are merged into one mesh in their parent, so named groups (picking,
// walking bounds, outlines, visibility switches) keep working.
//
// Left alone: named meshes (code finds them by name; options.keep narrows this), meshes with children,
// transparent or multi-material ones, light patches (userData.atmosphere),
// anything marked userData.dynamic (moved by an animation) and the inside of a
// dynamic or named-for-animation subtree.

/** @param {THREE.Object3D} object */
const isDynamic = object => Boolean(object.userData.dynamic || object.userData.windAnimated);
/** @param {THREE.Object3D} object */
const isMesh = object => /** @type {any} */ (object).isMesh === true;

/** @param {THREE.Mesh} mesh @param {(mesh: THREE.Mesh) => boolean} keep */
function mergeable(mesh, keep) {
  if (!mesh.isMesh || /** @type {any} */ (mesh).isInstancedMesh || /** @type {any} */ (mesh).isSkinnedMesh) return false;
  if (keep(mesh) || mesh.children.length || isDynamic(mesh) || mesh.userData.atmosphere) return false;
  if (!mesh.visible || mesh.onBeforeRender !== THREE.Object3D.prototype.onBeforeRender) return false;
  const material = /** @type {THREE.Material} */ (mesh.material);
  if (!material || Array.isArray(mesh.material) || material.transparent) return false;
  return !mesh.geometry.morphAttributes || !Object.keys(mesh.geometry.morphAttributes).length;
}

/** Meshes that can share one draw call: same material, shadows, order and vertex layout. */
function bucketKey(mesh) {
  const geometry = mesh.geometry;
  const attributes = Object.keys(geometry.attributes).sort().join(',');
  return [/** @type {THREE.Material} */ (mesh.material).uuid, mesh.castShadow, mesh.receiveShadow,
    mesh.renderOrder, mesh.frustumCulled, geometry.index ? 'i' : 'n', attributes].join('|');
}

/**
 * Merges static sibling meshes under root, in place.
 * @param {THREE.Object3D} root
 * @param {{ keep?: (mesh: THREE.Mesh) => boolean }} [options] keep: meshes code or tests
 *   find by name; by default every named mesh is kept.
 * @returns {{ before: number, after: number }} mesh counts
 */
export function mergeStaticMeshes(root, { keep = mesh => Boolean(mesh.name) } = {}) {
  let before = 0, after = 0;
  /** @param {THREE.Object3D} parent */
  function visit(parent) {
    if (isDynamic(parent)) return;
    const buckets = new Map();
    for (const child of parent.children) {
      if (isMesh(child)) before++;
      if (!mergeable(/** @type {THREE.Mesh} */ (child), keep)) continue;
      const key = bucketKey(child);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(child);
    }
    for (const meshes of buckets.values()) {
      if (meshes.length < 2) continue;
      const geometries = meshes.map(mesh => {
        mesh.updateMatrix();
        const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrix);
        geometry.clearGroups();
        return geometry;
      });
      const merged = mergeGeometries(geometries, false);
      geometries.forEach(geometry => geometry.dispose());
      if (!merged) continue;
      const [first] = meshes;
      const mesh = new THREE.Mesh(merged, first.material);
      Object.assign(mesh, { castShadow: first.castShadow, receiveShadow: first.receiveShadow,
        renderOrder: first.renderOrder, frustumCulled: first.frustumCulled });
      mesh.userData.mergedStatic = meshes.length;
      // The old geometries were never drawn; one may be shared, so leave them to GC.
      for (const old of meshes) parent.remove(old);
      parent.add(mesh);
    }
    for (const child of [...parent.children]) {
      if (isMesh(child)) after++;
      if (!isMesh(child) || child.children.length) visit(child);
    }
  }
  visit(root);
  return { before, after };
}
