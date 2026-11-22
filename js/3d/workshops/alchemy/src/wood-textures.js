// @ts-check
import { t } from './i18n.js';
// Three hand-painted wood finishes. Their grain and pigment washes wrap on both
// axes, so a shelf and a tabletop can share a texture without visible seams.
const FINISHES = Object.freeze({
  walnut: { name: t('Тёмный орех'), shadow: [46, 27, 23], base: [91, 57, 40], highlight: [151, 101, 62], seed: 9 },
  oak: { name: t('Медовый дуб'), shadow: [103, 61, 35], base: [166, 114, 68], highlight: [215, 161, 102], seed: 22 },
  ash: { name: t('Светлый ясень'), shadow: [100, 99, 84], base: [163, 154, 127], highlight: [216, 202, 163], seed: 37 },
  dark: { name: t('Тёмная гуашь'), shadow: [28, 17, 14], base: [58, 35, 26], highlight: [104, 66, 44], seed: 51 },
});

export const WOOD_FINISHES = Object.freeze(Object.keys(FINISHES));
// Artist-painted masters, compressed for the game. These replace the old
// procedural stripe-heavy washes on all visible furniture surfaces.
export const WOOD_FINISH_ASSETS = Object.freeze({
  walnut: new URL('./assets/wood-gouache-walnut.webp', import.meta.url).href,
  oak: new URL('./assets/wood-gouache-oak.webp', import.meta.url).href,
  ash: new URL('./assets/wood-gouache-ash.webp', import.meta.url).href,
  // The Atelier's dark walnut gouache (its easels), for a darker table: one file for both.
  dark: new URL('../../atelier/src/assets/textures/wood-walnut-gouache-v2.webp', import.meta.url).href,
});

const fract = x => x - Math.floor(x);
const smooth = x => x * x * (3 - 2 * x);
function hash(x, y, seed) {
  return fract(Math.sin(x * 127.13 + y * 311.71 + seed * 97.13) * 43758.5453);
}
function periodicNoise(x, y, cellsX, cellsY, seed) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = smooth(x - ix), fy = smooth(y - iy);
  const px = i => ((i % cellsX) + cellsX) % cellsX;
  const py = i => ((i % cellsY) + cellsY) % cellsY;
  const top = hash(px(ix), py(iy), seed) * (1 - fx) + hash(px(ix + 1), py(iy), seed) * fx;
  const low = hash(px(ix), py(iy + 1), seed) * (1 - fx) + hash(px(ix + 1), py(iy + 1), seed) * fx;
  return top * (1 - fy) + low * fy;
}

export function makeGouacheWoodTexture(THREE, finish = 'walnut') {
  const palette = FINISHES[finish];
  if (!palette) throw new Error(`Unknown wood finish: ${finish}`);
  const width = 512, height = 384;
  const pixels = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const u = x / width, v = y / height;
    // Broad, irregular gouache pigment pools and ragged dry-brush flecks.
    // Wood grain is only a faint undertone; the previous high-frequency sine
    // bands read as machine-printed stripes, especially on narrow shelves.
    const warp = (periodicNoise(u * 4, v * 4, 4, 4, palette.seed) - .5) * .075 +
      (periodicNoise(u * 11, v * 8, 11, 8, palette.seed + 3) - .5) * .021;
    const grain = Math.sin((v + warp) * Math.PI * 2 * 12 + Math.sin(u * Math.PI * 3) * .35);
    const ribbons = Math.sin((v + warp * .83) * Math.PI * 2 * 4 + Math.sin(u * 18) * .45);
    const pigment = periodicNoise(u * 6, v * 5, 6, 5, palette.seed + 7) - .5;
    const broadWash = periodicNoise(u * 3, v * 3, 3, 3, palette.seed + 11) - .5;
    const brush = periodicNoise(u * 35, v * 23, 35, 23, palette.seed + 15) - .5;
    const paper = hash(x, y, palette.seed + 31) - .5;
    const wash = Math.max(.015, Math.min(.985, .5 + pigment * .78 + broadWash * .23
      + ribbons * .027 + grain * .022 + brush * .26));
    const a = wash < .5 ? palette.shadow : palette.base;
    const b = wash < .5 ? palette.base : palette.highlight;
    const blend = wash < .5 ? wash * 2 : (wash - .5) * 2;
    const offset = (y * width + x) * 4;
    for (let c = 0; c < 3; c++) {
      pixels[offset + c] = Math.max(0, Math.min(255, Math.round(a[c] + (b[c] - a[c]) * blend + paper * 8)));
    }
    pixels[offset + 3] = 255;
  }
  const texture = new THREE.DataTexture(pixels, width, height, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}
