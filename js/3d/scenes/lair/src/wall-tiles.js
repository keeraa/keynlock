// The sage tiles use the same non-repeating, painted-wall algorithm as the
// original KEYNLOCK alchemy laboratory. One texture covers the whole alcove.
const PALETTE = {
  base: [62, 86, 79], highlight: [116, 136, 116],
  shadow: [38, 65, 61], grout: [34, 49, 47],
};
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smooth = v => v * v * (3 - 2 * v);
const hash = (x, y, s) => {
  const n = Math.sin(x * 127.17 + y * 311.41 + s * 17.73) * 43758.5453;
  return n - Math.floor(n);
};
function noise(x, y, seed) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const sx = smooth(x - ix), sy = smooth(y - iy);
  const upper = hash(ix, iy, seed) * (1 - sx) + hash(ix + 1, iy, seed) * sx;
  const lower = hash(ix, iy + 1, seed) * (1 - sx) + hash(ix + 1, iy + 1, seed) * sx;
  return upper * (1 - sy) + lower * sy;
}

export function makeAlchemyTileTexture(THREE, span = { width: 6, height: 12 }) {
  const width = 576, height = 960, seed = 21;
  const pixels = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const u = x / width, v = y / height;
    const tx = u * 13 * (span.width / 24), ty = v * 6 * (span.height / 12);
    const col = Math.floor(tx), row = Math.floor(ty);
    const dx = tx - col, dy = ty - row;
    const edge = Math.min(dx, 1 - dx, dy, 1 - dy);
    const border = smooth(clamp((edge - .013) / .045));
    const broad = noise(u * 29, v * 19, seed + 4) - .5;
    const soft = noise(u * 83, v * 37, seed + 8) - .5;
    const dryBrush = noise(u * 192, v * 110, seed + 16) - .5;
    const grain = hash(x, y, seed + 34) - .5;
    const wash = clamp(.48 + (hash(col, row, seed) - .5) * .31 + broad * .62 + soft * .25 + dryBrush * .16);
    const from = wash < .5 ? PALETTE.shadow : PALETTE.base;
    const to = wash < .5 ? PALETTE.base : PALETTE.highlight;
    const amount = wash < .5 ? wash * 2 : (wash - .5) * 2;
    const at = (y * width + x) * 4;
    for (let c = 0; c < 3; c++) {
      const painted = from[c] + (to[c] - from[c]) * amount + grain * 9;
      pixels[at + c] = Math.round(clamp(PALETTE.grout[c] * (1 - border) + painted * border, 0, 255));
    }
    pixels[at + 3] = 255;
  }
  const map = new THREE.DataTexture(pixels, width, height, THREE.RGBAFormat);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.ClampToEdgeWrapping;
  map.minFilter = THREE.LinearMipmapLinearFilter;
  map.magFilter = THREE.LinearFilter;
  map.generateMipmaps = true;
  map.needsUpdate = true;
  return map;
}
