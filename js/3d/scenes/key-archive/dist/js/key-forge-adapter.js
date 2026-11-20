// Key Forge -> Key Archive bridge. Archive type indices and save IDs stay stable.
// Editable designs enter through createForgeKeyProvider(profiles); geometry and
// all display variants are derived from those same ten designs on page load.
import * as THREE from '../vendor/three.js';
import { KEY_TEMPLATES, METALS, defaultDesign, normalizeKeyDesign } from './key-data.js?v=plain-gouache';
import { createKeyModel as createForgeModel, disposeKeyModel } from './key-geometry.js?v=wax-and-bundles';
import { bowPoints, createBowShape, joinedKeyShape, keyBounds } from './key-shapes.js?v=2';
import { getMetalMaterial } from './key-materials.js?v=wax-and-bundles';
import { dirtTriangles, getDirtMaterial, getWaxMaterial } from './key-dirt.js?v=wax-and-bundles';
import { createPaintedInstanceGeometry, setKeyInstanceFinish } from './key-instance-finish.js?v=wax-and-bundles';

// Old archive: circle, triangle, square, diamond, pentagon, hexagon, star,
// clover, oval, crown. Seven silhouettes match; three become new families.
export const ARCHIVE_TO_FORGE = Object.freeze([
  'cellar', 'tower', 'archive', 'clock', 'astral',
  'forge', 'alchemy', 'garden', 'palace', 'brotherhood',
]);

const PROFILE_LIMITS = Object.freeze({
  shaftLength: [1.65, 3.05], headSize: [75, 135], teeth: [2, 7],
  cutDepth: [10, 45], thickness: [6, 22], breakAngle: [60, 80],
  rustAmount: [0, 200],
});
const templateById = new Map(KEY_TEMPLATES.map((template, index) => [template.id, index]));

function bounded(value, fallback, [minimum, maximum]) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(minimum, Math.min(maximum, number)) : fallback;
}

export function archiveDesign(type, profiles = []) {
  const id = ARCHIVE_TO_FORGE[type];
  const index = templateById.get(id);
  if (index === undefined) throw new RangeError('Unknown archive key family');
  const baseline = defaultDesign(index);
  const saved = Array.isArray(profiles) ? profiles.find(entry => entry?.id === id) : null;
  const values = { ...baseline };
  if (saved) {
    for (const [name, range] of Object.entries(PROFILE_LIMITS))
      values[name] = bounded(saved[name], baseline[name], range);
    for (const name of ['doubleSided', 'broken'])
      if (typeof saved[name] === 'boolean') values[name] = saved[name];
    if (saved.dirtAmount === 100) values.dirtAmount = 100;
  }
  // Shape and metal come from the catalog; saved files cannot change the lore.
  return normalizeKeyDesign({ ...values, template: index, metal: baseline.metal });
}

function geometryDesign(type, broken, profiles) {
  // Individual archive items own their broken/dirty/rusty state. The editor
  // controls the family silhouette and the angle used by broken instances.
  return { ...archiveDesign(type, profiles), broken, dirtAmount: 0, rustAmount: 0 };
}

function makeArchiveGeometry(type, broken, profiles) {
  const design = geometryDesign(type, broken, profiles);
  const model = createForgeModel(design);
  const metalMesh = model.children.find(child => child.isMesh && child.userData.exportable);
  if (!metalMesh) throw new Error('Key Forge model has no solid metal geometry');
  const geometry = metalMesh.geometry.clone();
  // Forge points right, archive keys point down with the head above the teeth.
  geometry.rotateZ(-Math.PI / 2);
  const template = KEY_TEMPLATES[design.template];
  // Keep a fixed scale for each family. Increasing shaft length in the editor
  // must lengthen the in-game key instead of being normalized away.
  const baseline = keyBounds(template, defaultDesign(design.template));
  const scale = 1.18 / (baseline.maxX - baseline.minX);
  geometry.scale(scale, scale, scale);
  geometry.computeBoundingBox();
  const scaled = geometry.boundingBox;
  const offset = new THREE.Vector3(
    -(scaled.min.x + scaled.max.x) / 2,
    -(scaled.min.y + scaled.max.y) / 2,
    .014 - scaled.min.z);
  geometry.translate(offset.x, offset.y, offset.z);
  geometry.userData.headCenterY = 1.21 * scale + offset.y;
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  disposeKeyModel(model);
  return { geometry, scale, offset };
}

function fallbackStamp(type, broken, profiles) {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 160; canvas.height = 220;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const design = geometryDesign(type, broken, profiles);
  const template = KEY_TEMPLATES[design.template];
  const joined = joinedKeyShape(template, design).extractPoints(12);
  const outline = joined.shape.map(point => [point.x, point.y]);
  const holes = joined.holes.map(points => points.map(point => [point.x, point.y]));
  const allPoints = outline;
  const rotated = allPoints.map(([x,y]) => [y, -x]);
  const xs = rotated.map(p => p[0]), ys = rotated.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const scale = Math.min(126 / (maxX - minX), 192 / (maxY - minY));
  const centerX = (minX + maxX) / 2, centerY = (minY + maxY) / 2;
  const toScreen = ([x,y]) => [80 + (y - centerX) * scale, 110 + (x + centerY) * scale];
  const trace = path => {
    path.forEach((point, index) => {
      const [x,y] = toScreen(point);
      if (!index) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    });
    ctx.closePath();
  };
  const metal = METALS.find(entry => entry.id === template.metal);
  const gradient = ctx.createLinearGradient(25, 10, 143, 205);
  gradient.addColorStop(0, '#f3dfb9');
  gradient.addColorStop(.45, metal?.color ?? '#b7a18b');
  gradient.addColorStop(1, '#59483e');
  ctx.fillStyle = gradient;
  ctx.strokeStyle = '#332a23';
  ctx.lineWidth = 2.8;
  ctx.lineJoin = 'round';
  ctx.beginPath(); trace(outline);
  for (const hole of holes) trace(hole);
  ctx.fill('evenodd'); ctx.stroke();
  return canvas;
}

export function createForgeKeyProvider(profiles = []) {
  const geometryCache = new Map();
  const materialCache = new Map();
  const crustCache = new Map();
  const stampCache = new Map();

  const designFor = type => archiveDesign(type, profiles);
  const metalFor = type => {
    const design = designFor(type);
    return METALS.find(metal => metal.id === KEY_TEMPLATES[design.template].metal);
  };
  const materialFor = type => {
    if (!materialCache.has(type)) {
      const design = designFor(type);
      // The actual Forge material owns gouache rust, solid grime and a random
      // per-instance pigment seed. One material is shared by each key family.
      const material = getMetalMaterial(metalFor(type).id, 0, design.template, 0, new Map());
      material.userData.keyForgePainted = true;
      materialCache.set(type, material);
    }
    return materialCache.get(type);
  };
  // A rusty archive item always looks aged; the editor's rust slider makes it
  // progressively heavier without changing the item's saved clean/rusty flag.
  const rustStrengthFor = type => Math.min(2, 1.35 + designFor(type).rustAmount / 300);
  const geometryFor = (type, broken = false) => {
    const key = `${type}:${!!broken}`;
    if (!geometryCache.has(key)) geometryCache.set(key,
      makeArchiveGeometry(type, !!broken, profiles));
    return geometryCache.get(key).geometry;
  };
  const crustFor = (type, broken = false) => {
    const key = `${type}:${!!broken}`;
    if (!crustCache.has(key)) {
      geometryFor(type, broken);
      const transform = geometryCache.get(key);
      const design = { ...geometryDesign(type, broken, profiles), dirtAmount: 100 };
      const crust = dirtTriangles(KEY_TEMPLATES[design.template], design);
      crust.rotateZ(-Math.PI / 2);
      crust.scale(transform.scale, transform.scale, transform.scale);
      crust.translate(transform.offset.x, transform.offset.y, transform.offset.z);
      crust.computeBoundingBox();
      crust.computeBoundingSphere();
      crustCache.set(key, crust);
    }
    return crustCache.get(key);
  };
  return Object.freeze({
    createModel(type, { id, scale = 1, variation = 0, broken = false,
      mud = false, rust = false, wax = false } = {}) {
      const group = new THREE.Group();
      const mesh = new THREE.InstancedMesh(
        createPaintedInstanceGeometry(geometryFor(type, broken), 1), materialFor(type), 1);
      mesh.setMatrixAt(0, new THREE.Matrix4());
      mesh.setColorAt(0, new THREE.Color().setScalar([.94, 1, .83][variation % 3]));
      setKeyInstanceFinish(mesh, 0, { id, type, variation, rust, mud, wax }, rustStrengthFor(type));
      mesh.castShadow = false;
      group.add(mesh);
      if (mud || wax) {
        const crust = new THREE.Mesh(crustFor(type, broken), wax ? getWaxMaterial() : getDirtMaterial());
        crust.castShadow = false;
        group.add(crust);
      }
      group.scale.setScalar(scale);
      return group;
    },
    disposeModel(group) {
      group.traverse(object => {
        if (object.isMesh && object.geometry.userData.keyPaintInstanceWrapper)
          object.geometry.dispose();
      });
    },
    getGeometry: (type, { broken = false } = {}) => geometryFor(type, broken),
    getCrustGeometry: (type, { broken = false } = {}) => crustFor(type, broken),
    getCrustMaterial: getDirtMaterial,
    getMaterial: materialFor,
    getRustStrength: rustStrengthFor,
    createGlyph(type) {
      const design = designFor(type);
      const template = KEY_TEMPLATES[design.template];
      const geometry = new THREE.ExtrudeGeometry(createBowShape(template.bow), {
        depth: .07, steps: 1, bevelEnabled: false, curveSegments: 12,
      });
      geometry.rotateZ(-Math.PI / 2);
      geometry.scale(.55, .55, .55);
      return new THREE.Mesh(geometry, materialFor(type));
    },
    getPaint: type => materialFor(type).map,
    getMetal: type => metalFor(type).id,
    getColor: type => metalFor(type).tint,
    getColliderSize: () => [.43, .21, .65],
    getDisplayScale: mode => ({ floor: .455, hand: .52, cabinet: .185, bath: .22 })[mode] ?? 1,
    getFallbackHeadPoints(type) {
      const design = designFor(type);
      return bowPoints(KEY_TEMPLATES[design.template].bow)
        .map(([x,y]) => [x * .53, y * .53]);
    },
    createFallbackStamp(type, broken = false) {
      const key = `${type}:${!!broken}`;
      if (!stampCache.has(key)) stampCache.set(key, fallbackStamp(type, !!broken, profiles));
      return stampCache.get(key);
    },
  });
}
