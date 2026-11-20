import * as THREE from '../vendor/three.js';
import { KEY_TYPES } from './rules.js?v=key-ring';
import { getKeyPaint, METAL_BY_KEY_TYPE } from './painted-textures.js';

function seeded(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

export function makePaintTexture(kind = 'wood', seed = 1) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const random = seeded(seed);
  const styles = {
    wood: ['#927057', '#c6a17b', '#5d453d'],
    stone: ['#909a8e', '#c0c5b2', '#65746d'],
    plaster: ['#9da99b', '#cbd1b8', '#6a8275'],
    rug: ['#87646b', '#b89591', '#62414a'],
  };
  const [base, light, dark] = styles[kind];
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 512, 512);
  // Broad irregular, dry-brush gouache strokes. Draw wrapped copies for seamless tiling.
  for (let i = 0; i < 300; i++) {
    const x = random() * 512;
    const y = random() * 512;
    const length = 35 + random() * (kind === 'wood' ? 125 : 98);
    const thickness = (kind === 'wood' ? 7 : 13) + random() * (kind === 'wood' ? 15 : 23);
    const angle = kind === 'wood' ? -.18 + random() * .36 : -.8 + random() * 1.6;
    const pigment = random() > .48 ? light : dark;
    const opacity = .055 + random() * .22;
    const bend = (random() - .5) * thickness;
    for (const tx of [-512, 0, 512]) for (const ty of [-512, 0, 512]) {
      ctx.save();
      ctx.translate(x + tx, y + ty);
      ctx.rotate(angle);
      ctx.globalAlpha = opacity;
      ctx.fillStyle = pigment;
      ctx.beginPath();
      ctx.moveTo(-length * .52, -thickness * .38);
      ctx.quadraticCurveTo(-length * .13, -thickness * .85, length * .46, -thickness * .22);
      ctx.lineTo(length * .51, thickness * .34);
      ctx.quadraticCurveTo(length * .13, thickness * .7 + bend, -length * .53, thickness * .18);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
  for (let i = 0; i < 1350; i++) {
    ctx.globalAlpha = .015 + random() * .05;
    ctx.fillStyle = random() > .5 ? light : dark;
    ctx.fillRect(random() * 512, random() * 512, 1 + random() * 7, 1 + random() * 5);
  }
  ctx.globalAlpha = 1;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

function circularPoints(sides, radius = .28, offset = Math.PI / 2) {
  return Array.from({ length: sides }, (_, i) => {
    const angle = (i / sides) * Math.PI * 2 + offset;
    return [Math.cos(angle) * radius, Math.sin(angle) * radius];
  });
}

export function keyHeadPoints(type) {
  switch (KEY_TYPES[type].id) {
    case 'circle': return circularPoints(40, .275);
    case 'triangle': return circularPoints(3, .325);
    case 'square': return circularPoints(4, .295, Math.PI / 4);
    case 'diamond': return circularPoints(4, .34, Math.PI / 2);
    case 'pentagon': return circularPoints(5, .305);
    case 'hexagon': return circularPoints(6, .30);
    case 'star': return Array.from({ length: 10 }, (_, i) => {
      const angle = i * Math.PI / 5 + Math.PI / 2;
      const radius = i % 2 ? .17 : .34;
      return [Math.cos(angle) * radius, Math.sin(angle) * radius];
    });
    case 'clover': return Array.from({ length: 64 }, (_, i) => {
      const angle = i / 64 * Math.PI * 2;
      const radius = .238 + .067 * Math.cos(angle * 4);
      return [Math.cos(angle) * radius, Math.sin(angle) * radius];
    });
    case 'oval': return circularPoints(40).map(([x, y]) => [x * .74, y * 1.30]);
    case 'crown': return [
      [-.32, -.22], [.32, -.22], [.32, .08], [.19, -.01],
      [.12, .32], [0, .10], [-.12, .32], [-.19, -.01], [-.32, .08],
    ];
    default: return circularPoints(24);
  }
}

export function makeBowGeometry(type, depth = .065) {
  const points = keyHeadPoints(type);
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) shape.lineTo(points[i][0], points[i][1]);
  shape.closePath();
  const hole = new THREE.Path();
  if (KEY_TYPES[type].id === 'triangle') {
    const inner = circularPoints(3, .105);
    hole.moveTo(inner[0][0], inner[0][1]);
    for (let i = 1; i < inner.length; i++) hole.lineTo(inner[i][0], inner[i][1]);
    hole.closePath();
  } else {
    hole.absellipse(0, 0, type === 8 ? .09 : .115, type === 8 ? .20 : .115, 0, Math.PI * 2, true, 0);
  }
  shape.holes.push(hole);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: true, bevelThickness: .009,
    bevelSize: .009, bevelSegments: 1, curveSegments: 12, steps: 1,
  });
  geometry.computeVertexNormals();
  return geometry;
}

const geometryCache = new Map();
function cachedBow(type) {
  if (!geometryCache.has(type)) geometryCache.set(type, makeBowGeometry(type));
  return geometryCache.get(type);
}

const metalCache = new Map();
function metalMaterial(type, variation) {
  const key = `${type}-${variation}`;
  if (metalCache.has(key)) return metalCache.get(key);
  const color = new THREE.Color(METAL_BY_KEY_TYPE[type] === 'steel' ? 0xe4ebf0 : 0xf6e8cf);
  color.multiplyScalar([.94, 1, .83][variation % 3]);
  const mat = new THREE.MeshStandardMaterial({
    color, map: typeof document === 'undefined' ? null : getKeyPaint(type), metalness: .27, roughness: .79,
    emissive: 0x241708, emissiveIntensity: .025,
  });
  metalCache.set(key, mat);
  return mat;
}

const shaftGeo = new THREE.BoxGeometry(.105, .54, .067);
const collarGeo = new THREE.BoxGeometry(.19, .078, .087);
const toothGeo = [
  new THREE.BoxGeometry(.18, .075, .075),
  new THREE.BoxGeometry(.12, .071, .075),
  new THREE.BoxGeometry(.24, .071, .075),
];
const ridgeGeo = new THREE.BoxGeometry(.047, .39, .013);

export function createKeyModel(type, { scale = 1, variation = 0, broken = false } = {}) {
  const group = new THREE.Group();
  const material = metalMaterial(type, variation);
  const bow = new THREE.Mesh(cachedBow(type), material);
  bow.position.y = .34;
  bow.castShadow = false;
  group.add(bow);

  const shaft = new THREE.Mesh(broken ? new THREE.BoxGeometry(.105, .30, .067) : shaftGeo, material);
  shaft.position.set(0, broken ? -.065 : -.155, .033);
  group.add(shaft);
  const collar = new THREE.Mesh(collarGeo, material);
  collar.position.set(0, .086, .033);
  group.add(collar);

  const teeth = broken ? 1 : (type % 3) + 2;
  for (let i = 0; i < teeth; i++) {
    const tooth = new THREE.Mesh(toothGeo[(type + i) % toothGeo.length], material);
    tooth.position.set(.097 + (i % 2) * .02, broken ? -.16 : -.33 + i * .105, .033);
    group.add(tooth);
  }
  if (broken) {
    const fracture = new THREE.Mesh(new THREE.BoxGeometry(.119, .034, .079),
      new THREE.MeshStandardMaterial({ color: 0x4b3331, roughness: 1 }));
    fracture.position.set(0, -.217, .035);
    fracture.rotation.z = .22;
    group.add(fracture);
  }
  const ridge = new THREE.Mesh(ridgeGeo, new THREE.MeshStandardMaterial({
    color: 0x3e2a1e, metalness: .65, roughness: .48,
  }));
  ridge.position.set(0, -.16, .073);
  group.add(ridge);
  group.scale.setScalar(scale);
  return group;
}

// Each floor key is drawn as one instanced object instead of six-to-eight meshes.
// Assemble the existing key parts into a single geometry, keeping their shapes.
const combinedKeyGeometry = new Map();
export function createCombinedKeyGeometry(type, broken = false) {
  const cacheKey = `${type}:${broken}`;
  if (combinedKeyGeometry.has(cacheKey)) return combinedKeyGeometry.get(cacheKey);
  const model = createKeyModel(type, { broken });
  model.updateMatrixWorld(true);
  const positions = [];
  const normals = [];
  const uvs = [];
  model.traverse(child => {
    if (!child.isMesh) return;
    const transformed = child.geometry.index
      ? child.geometry.toNonIndexed()
      : child.geometry.clone();
    transformed.applyMatrix4(child.matrixWorld);
    const p = transformed.getAttribute('position');
    const n = transformed.getAttribute('normal');
    const uv = transformed.getAttribute('uv');
    for (let i = 0; i < p.count; i++) {
      positions.push(p.getX(i), p.getY(i), p.getZ(i));
      normals.push(n.getX(i), n.getY(i), n.getZ(i));
      uvs.push(uv ? uv.getX(i) : .5, uv ? uv.getY(i) : .5);
    }
    transformed.dispose();
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeBoundingSphere();
  combinedKeyGeometry.set(cacheKey, geometry);
  return geometry;
}

export function createBowGlyph(type, color = 0xd5b570) {
  const mesh = new THREE.Mesh(
    cachedBow(type),
    new THREE.MeshStandardMaterial({ color: 0xf3e9d4, map: getKeyPaint(type), roughness: .74,
      metalness: .27, emissive: color, emissiveIntensity: .07 }),
  );
  return mesh;
}

export function makeLabel(text, subtitle = '', opts = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = opts.width || 1024;
  canvas.height = opts.height || 256;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,.45)';
  ctx.shadowBlur = 10;
  ctx.fillStyle = opts.color || '#e7c891';
  ctx.font = `${opts.fontSize || 79}px Georgia, serif`;
  ctx.fillText(text, canvas.width / 2, subtitle ? 91 : 130, canvas.width - 52);
  if (subtitle) {
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#a5906e';
    ctx.font = '35px Georgia, serif';
    ctx.fillText(subtitle, canvas.width / 2, 184, canvas.width - 55);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(opts.worldWidth || 2.75, opts.worldHeight || .65),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }));
}
