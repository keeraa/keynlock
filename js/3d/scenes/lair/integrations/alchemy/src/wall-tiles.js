// A single, non-repeating gouache painting covers the whole back wall.
// Individual tiles have variation, while the canvas has no UV tile seams.
const PALETTES = Object.freeze({
  sage: { base: [62, 86, 79], highlight: [116, 136, 116], shadow: [38, 65, 61], grout: [34, 49, 47] },
  ochre: { base: [126, 102, 75], highlight: [172, 146, 103], shadow: [92, 73, 57], grout: [72, 60, 51] },
  slate: { base: [65, 86, 101], highlight: [115, 133, 141], shadow: [41, 63, 77], grout: [35, 52, 62] }
});

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const smooth = value => value * value * (3 - 2 * value);
const hash = (x, y, seed) => {
  const n = Math.sin(x * 127.17 + y * 311.41 + seed * 17.73) * 43758.5453;
  return n - Math.floor(n);
};
function noise(x, y, seed) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const sx = smooth(x - ix), sy = smooth(y - iy);
  const top = hash(ix, iy, seed) * (1 - sx) + hash(ix + 1, iy, seed) * sx;
  const bottom = hash(ix, iy + 1, seed) * (1 - sx) + hash(ix + 1, iy + 1, seed) * sx;
  return top * (1 - sy) + bottom * sy;
}

export const WALL_TILE_PALETTES = Object.freeze(Object.keys(PALETTES));

export function makeGouacheWallTexture(THREE, style = 'sage', span = { width: 24, height: 12 }) {
  if (!PALETTES[style]) throw new Error(`Unknown wall tile style: ${style}`);
  const palette = PALETTES[style];
  const width = span.width > 24 ? 1152 : 768;
  const height = span.height > 12 ? 768 : 512;
  const pixels = new Uint8Array(width * height * 4);
  const seed = WALL_TILE_PALETTES.indexOf(style) + 21;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const u = x / width, v = y / height;
    // Hold the same physical tile size as the wall expands into the room.
    const tx = u * 13 * (span.width / 24), ty = v * 6 * (span.height / 12);
    const column = Math.floor(tx), row = Math.floor(ty);
    const dx = tx - column, dy = ty - row;
    const margin = Math.min(dx, 1 - dx, dy, 1 - dy);
    const border = smooth(clamp((margin - .013) / .045));
    const tileWash = hash(column, row, seed) - .5;
    const broad = noise(u * 29, v * 19, seed + 4) - .5;
    const soft = noise(u * 83, v * 37, seed + 8) - .5;
    const dryBrush = noise(u * 192, v * 110, seed + 16) - .5;
    const grain = hash(x, y, seed + 34) - .5;
    const wash = clamp(.48 + tileWash * .31 + broad * .62 + soft * .25 + dryBrush * .16);
    const lerp = wash < .5 ? wash * 2 : (wash - .5) * 2;
    const from = wash < .5 ? palette.shadow : palette.base;
    const to = wash < .5 ? palette.base : palette.highlight;
    const offset = (y * width + x) * 4;
    for (let c = 0; c < 3; c++) {
      const painted = from[c] + (to[c] - from[c]) * lerp + grain * 9;
      pixels[offset + c] = Math.round(clamp(palette.grout[c] * (1 - border) + painted * border, 0, 255));
    }
    pixels[offset + 3] = 255;
  }
  const texture = new THREE.DataTexture(pixels, width, height, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}
