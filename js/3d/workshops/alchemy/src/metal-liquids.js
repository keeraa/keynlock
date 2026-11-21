// Seven visibly different metal fluids. Each has its own painted surface and
// physical finish; mercury and silver also reflect the workshop environment.
// Procedural DataTextures are ready immediately, without async dark frames.
const clamp = (v, low = 0, high = 1) => Math.max(low, Math.min(high, v));
const smooth = t => t * t * (3 - 2 * t);
const TAU = Math.PI * 2;

export const METAL_LIQUID_FINISHES = Object.freeze({
  stannum: Object.freeze({ name: 'сатиновое олово', roughness: .88, metalness: .18, clearcoat: .06, clearcoatRoughness: .8, envMapIntensity: .2 }),
  plumbum: Object.freeze({ name: 'зернистый свинец', roughness: .97, metalness: .08, clearcoat: 0, clearcoatRoughness: 1, envMapIntensity: .1 }),
  aurum: Object.freeze({ name: 'тёплое полированное золото', roughness: .31, metalness: .72, clearcoat: .4, clearcoatRoughness: .20, envMapIntensity: .72, reflective: true }),
  cuprum: Object.freeze({ name: 'медная патина', roughness: .48, metalness: .53, clearcoat: .2, clearcoatRoughness: .38, envMapIntensity: .52, reflective: true }),
  hydrargyrum: Object.freeze({ name: 'зеркальная ртуть', roughness: .025, metalness: 1, clearcoat: 1, clearcoatRoughness: .018, envMapIntensity: 2.45, reflective: true, mirror: true }),
  argentum: Object.freeze({ name: 'глянцевое серебро', roughness: .16, metalness: .85, clearcoat: .82, clearcoatRoughness: .08, envMapIntensity: 1.12, reflective: true }),
  ferrum: Object.freeze({ name: 'тёмное окисленное железо', roughness: .84, metalness: .22, clearcoat: .015, clearcoatRoughness: .85, envMapIntensity: .16 })
});

// A tiny, shared equirectangular reflection of the workshop: tall diffuse
// window panes, dark timber and warm lamp glints. Physical metal shading
// reflects these from the correct viewing direction. There are no per-frame
// cube-camera captures and no additional render passes while orbiting.
export function makeWorkshopReflectionMap(THREE) {
  const width = 512, height = 256;
  const pixels = new Uint8Array(width * height * 4);
  const feather = (distance, radius, soft = .018) => 1 - smooth(clamp((distance - radius + soft) / (2 * soft)));
  const panel = (u, v, cx, cy, rx, ry) => {
    const dx = Math.min(Math.abs(u - cx), 1 - Math.abs(u - cx));
    return feather(dx, rx) * feather(Math.abs(v - cy), ry);
  };
  for (let y = 0; y < height; y++) {
    const v = (y + .5) / height;
    for (let x = 0; x < width; x++) {
      const u = (x + .5) / width;
      const ceiling = 1 - smooth(clamp((v - .25) / .18));
      const timber = smooth(clamp((v - .68) / .10));
      const shelves = Math.exp(-Math.pow((v - .64) / .015, 2));
      const window = Math.min(1, panel(u, v, .13, .43, .035, .21) * .96 +
        panel(u, v, .21, .43, .028, .21) * .9 +
        panel(u, v, .62, .42, .055, .26) * .82 +
        panel(u, v, .82, .43, .018, .16) * .80);
      const warmLamp = Math.exp(-Math.pow((u - .42) / .033, 2) - Math.pow((v - .42) / .08, 2));
      const coolRim = Math.exp(-Math.pow((u - .92) / .055, 2) - Math.pow((v - .31) / .18, 2));
      const softWash = Math.sin(u * TAU * 3) * Math.sin(v * TAU * 2) * 7;
      const base = [54 + ceiling * 39 - timber * 23, 75 + ceiling * 30 - timber * 42, 76 + ceiling * 18 - timber * 48];
      const index = (y * width + x) * 4;
      for (let channel = 0; channel < 3; channel++) {
        const warm = [254, 194, 111][channel] * warmLamp * .72;
        const cool = [117, 179, 203][channel] * coolRim * .52;
        pixels[index + channel] = Math.round(clamp(base[channel] + window * [198, 192, 170][channel] +
          warm + cool + shelves * [75, 47, 26][channel] + softWash, 0, 255));
      }
      pixels[index + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(pixels, width, height, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

function sampleGrid(x, y, seed, periodX = 0, periodY = 0) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = smooth(x - ix), fy = smooth(y - iy);
  const hash = (a, b) => {
    if (periodX) a = ((a % periodX) + periodX) % periodX;
    if (periodY) b = ((b % periodY) + periodY) % periodY;
    const n = Math.sin(a * 127.17 + b * 311.41 + seed * 17.73) * 43758.5453;
    return n - Math.floor(n);
  };
  const a = hash(ix, iy) * (1 - fx) + hash(ix + 1, iy) * fx;
  const b = hash(ix, iy + 1) * (1 - fx) + hash(ix + 1, iy + 1) * fx;
  return a * (1 - fy) + b * fy;
}

const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));

export function makeMetalLiquidTexture(THREE, metal, index = 0) {
  const width = 128, height = 256;
  const pixels = new Uint8Array(width * height * 4);
  const main = rgb(metal.hex), dark = rgb(metal.darkHex), light = rgb(metal.lightHex);
  const reflective = metal.symbol === 'Hg' || metal.symbol === 'Ag';
  const oxidized = metal.symbol === 'Fe' || metal.symbol === 'Cu';
  for (let y = 0; y < height; y++) {
    const v = y / height;
    for (let x = 0; x < width; x++) {
      const u = x / width;
      const broad = sampleGrid(u * 6, v * 8, index + 1, 6, 8) * 2 - 1;
      const brush = sampleGrid(u * 16, v * 20, index + 14, 16, 20) * 2 - 1;
      const grain = sampleGrid(u * 64, v * 80, index + 33, 64, 80) * 2 - 1;
      const wave = Math.sin(v * Math.PI * 12 + Math.sin(u * Math.PI * 4 + index) * 2.4 + broad * 4);
      const shineBand = Math.sin(u * Math.PI * (reflective ? 8 : 6) + v * Math.PI * 2 + broad * 1.8);
      let level = .5 + broad * .23 + brush * .14 + wave * .115 + grain * .038 + shineBand * (reflective ? .13 : .04);
      let oxide = 0, chalk = 0;
      if (metal.id === 'stannum') {
        // Long, warm brush fibres sit in a cloudy satin wash.
        const fibres = Math.sin(TAU * (v * 7 + u * 2) + broad * 2.4);
        level = .64 + broad * .12 + fibres * .14 + brush * .095 + grain * .045;
      } else if (metal.id === 'plumbum') {
        // Pitted, dusty lead: coarse dark islands and powdery oxide flecks.
        const pits = sampleGrid(u * 33, v * 49, index + 83, 33, 49);
        const clusters = sampleGrid(u * 11, v * 15, index + 87, 11, 15);
        chalk = smooth(clamp((clusters - .62) * 3));
        level = .37 + broad * .16 + brush * .11 - smooth(clamp((pits - .48) * 3.1)) * .23 + chalk * .19 + grain * .05;
      } else if (metal.id === 'hydrargyrum') {
        // A mostly smooth, silver liquid with narrow hard mirror ribbons.
        const bend = Math.sin(v * TAU * 4 + broad * 1.5) * .045;
        const ribbon = Math.cos((u * 3 + bend) * TAU);
        const glare = Math.pow(Math.max(0, ribbon), 10);
        const darkReflection = Math.pow(Math.max(0, -ribbon), 3);
        level = .73 + glare * .24 - darkReflection * .37 + broad * .045 + grain * .018;
      } else if (metal.id === 'argentum') {
        // Silver is polished, cool and rippled, without mercury's black mirror bars.
        const silk = Math.sin(TAU * (u * 3 + v * 5) + Math.sin(u * TAU * 2) * 1.1 + broad * .8);
        const highlights = Math.pow(Math.max(0, silk), 5);
        level = .74 + broad * .11 + silk * .12 + highlights * .12 + grain * .028;
      } else if (metal.id === 'ferrum') {
        // Blackened iron has broken oxide patches with red-brown corrosion.
        const patch = sampleGrid(u * 9, v * 14, index + 59, 9, 14);
        const pitting = sampleGrid(u * 35, v * 51, index + 63, 35, 51);
        oxide = smooth(clamp((patch - .48 + grain * .08) * 3.8));
        level = .35 + broad * .13 + brush * .11 - pitting * .13 + grain * .07;
      }
      level = clamp(level);
      const accent = oxidized && metal.id !== 'ferrum' ? .13 * Math.max(0, Math.sin(u * Math.PI * 6 + v * Math.PI * 8 + broad * 3)) : 0;
      const t = level < .5 ? level * 2 : (level - .5) * 2;
      for (let c = 0; c < 3; c++) {
        const value = level < .5 ? dark[c] + (main[c] - dark[c]) * t : main[c] + (light[c] - main[c]) * t;
        const rust = oxide * .82 * [174, 91, 54][c];
        const oxidizedValue = value * (1 - oxide * .82) + rust;
        const patina = chalk * .2 * [188, 194, 204][c];
        const finished = (metal.id === 'ferrum' ? oxidizedValue : value) * (1 - chalk * .2) + patina;
        pixels[(y * width + x) * 4 + c] = clamp(finished * (1 - accent) + grain * 7, 0, 255);
      }
      pixels[(y * width + x) * 4 + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(pixels, width, height, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

const PIGMENT_PALETTES = Object.freeze({
  red: ['#76243b', '#d62f41', '#f7a195'],
  blue: ['#203e86', '#3c6fcc', '#b2cedf'],
  yellow: ['#97621d', '#eac042', '#fff0b0'],
  white: ['#a2aeb0', '#e9e8df', '#ffffff']
});

export function makePigmentLiquidTexture(THREE, reagent, index = 0) {
  const palette = PIGMENT_PALETTES[reagent.id];
  if (!palette) throw new Error(`Unknown pigment: ${reagent.id}`);
  const [dark, main, light] = palette.map(rgb);
  const width = 128, height = 256;
  const pixels = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const v = y / height;
    for (let x = 0; x < width; x++) {
      const u = x / width;
      // Periodic washes join seamlessly around a tube and while scrolling.
      const wash = sampleGrid(u * 5, v * 8, 51 + index, 5, 8) - .5;
      const bloom = sampleGrid(u * 11, v * 15, 75 + index, 11, 15) - .5;
      const edge = Math.sin((wash * 7 + bloom * 3 + Math.sin(u * Math.PI * 4)) * Math.PI);
      const brush = Math.sin(v * Math.PI * 12 + Math.sin(u * Math.PI * 4 + index) * 2.5 + wash * 8);
      const dryPigment = sampleGrid(u * 43, v * 59, 99 + index, 43, 59) - .5;
      const paperGrain = sampleGrid(u * 91, v * 103, 151 + index, 91, 103) - .5;
      const value = clamp(.52 + wash * .70 + bloom * .34 + edge * .07 + brush * .12 + dryPigment * .17 + paperGrain * .07);
      const local = value < .5 ? value * 2 : (value - .5) * 2;
      for (let channel = 0; channel < 3; channel++) {
        const base = value < .5
          ? dark[channel] + (main[channel] - dark[channel]) * local
          : main[channel] + (light[channel] - main[channel]) * local;
        pixels[(y * width + x) * 4 + channel] = clamp(base + paperGrain * 18, 0, 255);
      }
      pixels[(y * width + x) * 4 + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(pixels, width, height, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

// A color-neutral gouache texture preserves brush marks when two or more
// reagents are mixed. The finished RYB mixture is applied as the material tint.
export function makeMixedLiquidTexture(THREE) {
  const width = 128, height = 256;
  const pixels = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const u = x / width, v = y / height;
    const broad = sampleGrid(u * 5, v * 8, 71, 5, 8) - .5;
    const strokes = sampleGrid(u * 17, v * 18, 85, 17, 18) - .5;
    const grain = sampleGrid(u * 59, v * 79, 101, 59, 79) - .5;
    const wave = Math.sin(v * Math.PI * 12 + broad * 7 + Math.sin(u * Math.PI * 4));
    const shade = clamp(.85 + broad * .37 + strokes * .15 + wave * .07 + grain * .055, .56, 1);
    const offset = (y * width + x) * 4;
    const value = Math.round(shade * 255);
    pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = value;
    pixels[offset + 3] = 255;
  }
  const texture = new THREE.DataTexture(pixels, width, height, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}
