import * as THREE from '../vendor/three.js';

// Gouache blotches are generated once per family, then reused by instanced keys.
// Irregular dry-brush edges avoid conspicuous repeated rust stamps.
const cache = new Map();

function randomizer(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

export function getPatinaTexture(type, kind) {
  const cacheKey = `${type}:${kind}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const context = canvas.getContext('2d');
  const random = randomizer(9131 + type * 991 + (kind === 'rust' ? 511 : 0));
  const palette = kind === 'rust'
    ? ['#984a24', '#c26831', '#e18c4d', '#703d2a', '#b95429']
    : ['#3d352e', '#63533a', '#88714b', '#342f29', '#715c3d'];
  for (let i = 0; i < (kind === 'rust' ? 95 : 130); i++) {
    const cx = random() * 256;
    const cy = random() * 256;
    const rx = 2 + random() * (kind === 'rust' ? 34 : 46);
    const ry = 1.6 + random() * 18;
    const angle = (random() - .5) * Math.PI;
    context.save();
    context.translate(cx, cy);
    context.rotate(angle);
    context.globalAlpha = .18 + random() * .53;
    context.fillStyle = palette[Math.floor(random() * palette.length)];
    context.beginPath();
    for (let point = 0; point < 13; point++) {
      const a = point / 12 * Math.PI * 2;
      const jitter = .68 + random() * .52;
      const x = Math.cos(a) * rx * jitter;
      const y = Math.sin(a) * ry * jitter;
      if (point === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.fill();
    context.restore();
  }
  for (let i = 0; i < 700; i++) {
    context.globalAlpha = .15 + random() * .55;
    context.fillStyle = palette[Math.floor(random() * palette.length)];
    context.fillRect(random() * 256, random() * 256, .8 + random() * 4, .6 + random() * 3);
  }
  context.globalAlpha = 1;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  cache.set(cacheKey, texture);
  return texture;
}

export function conditionTint(key) {
  if (key.broken) return 0x8d7772;
  if (key.mud && key.rust) return 0x9c7357;
  if (key.mud) return 0xa79c7a;
  if (key.rust) return 0xdb9c69;
  return 0xffffff;
}

export function conditionMaterial(type, kind) {
  return new THREE.MeshBasicMaterial({
    map: getPatinaTexture(type, kind), transparent: true, opacity: .92,
    depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2,
    polygonOffsetUnits: -2, side: THREE.DoubleSide,
  });
}
