import * as THREE from 'three';
import { ALCHEMY_LOOK } from './look/alchemy-look.js';

// Same original painted-metal WebP assets and image processing as KEYNLOCK's lock lab.
export const VISUAL_DEFAULTS = ALCHEMY_LOOK.filters;

const FINISH_URLS = Object.freeze({
  steel: new URL('./assets/painted-steel.webp', import.meta.url).href,
  graphite: new URL('./assets/painted-graphite.webp', import.meta.url).href,
  enamel: new URL('./assets/painted-enamel.webp', import.meta.url).href,
  brass: new URL('./assets/painted-brass.webp', import.meta.url).href,
  copper: new URL('./assets/painted-copper.webp', import.meta.url).href,
});
// Distinct painted pigment ranges. The old conversion drove every swatch
// towards white and nearly erased the difference between frame finishes.
const FINISH_PALETTES = {
  steel: { dark: [65, 86, 98], mid: [128, 153, 162], light: [204, 216, 211] },
  graphite: { dark: [24, 32, 37], mid: [55, 68, 76], light: [111, 127, 131] },
  enamel: { dark: [8, 77, 86], mid: [22, 133, 139], light: [91, 197, 178] },
  brass: { dark: [116, 77, 35], mid: [181, 138, 69], light: [240, 202, 113] },
  copper: { dark: [113, 48, 40], mid: [193, 96, 65], light: [243, 162, 112] }
};

// Pixel-space brush expressiveness and mirrored repeats are matched to the lock prototype.
function paintPixels(input, intensity, palette, saturation = 1) {
  const output = new Uint8ClampedArray(input.length);
  const count = input.length / 4;
  const average = [0, 0, 0];
  for (let i = 0; i < input.length; i += 4) {
    average[0] += input[i]; average[1] += input[i + 1]; average[2] += input[i + 2];
  }
  for (let c = 0; c < 3; c++) average[c] /= count;
  const luminance = average[0] * .2126 + average[1] * .7152 + average[2] * .0722;
  for (let i = 0; i < input.length; i += 4) {
    const shift = (input[i] * .2126 + input[i + 1] * .7152 + input[i + 2] * .0722 - luminance) / 255;
    const wash = Math.max(.03, Math.min(.97, .52 + shift * (2.25 * intensity + .3) * saturation));
    const low = wash < .5 ? palette.dark : palette.mid;
    const high = wash < .5 ? palette.mid : palette.light;
    const t = wash < .5 ? wash * 2 : (wash - .5) * 2;
    for (let c = 0; c < 3; c++) {
      const local = (input[i + c] - average[c]) / 255;
      output[i + c] = Math.round(Math.max(0, Math.min(255,
        low[c] + (high[c] - low[c]) * t + local * intensity * 22)));
    }
    output[i + 3] = 255;
  }
  return output;
}

// The artwork is painted on a square sheet. Match its opposite borders with
// a soft, symmetric wash so that wrapped metal cylinders have no visible
// contrast line even when the camera travels behind them.
export function blendPaintTileSeams(pixels, width, height) {
  const xFeather = Math.max(1, Math.floor(width * .14));
  const yFeather = Math.max(1, Math.floor(height * .14));
  const blendAt = (index, feather) => {
    const t = index / feather;
    return .5 * (1 - t * t * (3 - 2 * t));
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < xFeather; x++) {
      const mix = blendAt(x, xFeather);
      const left = (y * width + x) * 4;
      const right = (y * width + width - 1 - x) * 4;
      for (let channel = 0; channel < 3; channel++) {
        const a = pixels[left + channel], b = pixels[right + channel];
        pixels[left + channel] = Math.round(a * (1 - mix) + b * mix);
        pixels[right + channel] = Math.round(b * (1 - mix) + a * mix);
      }
    }
  }
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < yFeather; y++) {
      const mix = blendAt(y, yFeather);
      const top = (y * width + x) * 4;
      const bottom = ((height - 1 - y) * width + x) * 4;
      for (let channel = 0; channel < 3; channel++) {
        const a = pixels[top + channel], b = pixels[bottom + channel];
        pixels[top + channel] = Math.round(a * (1 - mix) + b * mix);
        pixels[bottom + channel] = Math.round(b * (1 - mix) + a * mix);
      }
    }
  }
  return pixels;
}

function makeGradientMap() {
  const pixels = new Uint8Array(256 * 4);
  const texture = new THREE.DataTexture(pixels, 256, 1, THREE.RGBAFormat);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  return texture;
}

function fillGradient(texture, strength, steps) {
  const pixels = texture.image.data;
  const influence = strength / 100;
  for (let i = 0; i < 256; i++) {
    const light = i / 255;
    const stepped = Math.floor(light * steps) / Math.max(1, steps - 1);
    const value = Math.round(255 * THREE.MathUtils.clamp(light * (1 - influence) + stepped * influence, 0, 1));
    pixels.set([value, value, value, 255], i * 4);
  }
  texture.needsUpdate = true;
}

// BoxGeometry splits every corner into three face vertices. A true inverted
// hull needs one shared outward corner direction, otherwise the expanded
// back faces separate and leave broken outlines at box corners.
function outlineGeometry(geometry) {
  if (geometry.type !== 'BoxGeometry') return geometry;
  const positions = geometry.getAttribute('position');
  const normals = geometry.getAttribute('normal');
  if (!positions || !normals) return geometry;
  const corners = new Map();
  for (let i = 0; i < positions.count; i++) {
    const key = `${Math.round(positions.getX(i) * 1e5)}:${Math.round(positions.getY(i) * 1e5)}:${Math.round(positions.getZ(i) * 1e5)}`;
    const entry = corners.get(key) || new THREE.Vector3();
    entry.add(new THREE.Vector3(normals.getX(i), normals.getY(i), normals.getZ(i)));
    corners.set(key, entry);
  }
  for (const normal of corners.values()) normal.normalize();
  const roundedNormals = new Float32Array(positions.count * 3);
  for (let i = 0; i < positions.count; i++) {
    const key = `${Math.round(positions.getX(i) * 1e5)}:${Math.round(positions.getY(i) * 1e5)}:${Math.round(positions.getZ(i) * 1e5)}`;
    corners.get(key).toArray(roundedNormals, i * 3);
  }
  const rounded = geometry.clone();
  rounded.setAttribute('normal', new THREE.BufferAttribute(roundedNormals, 3));
  return rounded;
}

export function createVisualSystem(scene, renderer, metals, documentRef, textureLoader = new THREE.TextureLoader(), extraContours = []) {
  const state = { ...VISUAL_DEFAULTS };
  const groups = {
    frame: [metals.iron, metals.oldBrass],
    accents: [metals.brass, metals.polishedBrass]
  };
  const original = new Map();
  for (const material of [...groups.frame, ...groups.accents]) {
    original.set(material, {
      color: material.color.clone(), map: material.map,
      metalness: material.metalness, roughness: material.roughness
    });
  }

  const solids = [];
  const outlinedMaterials = new Set([...groups.frame, ...groups.accents, metals.darkWood, metals.blackWood, metals.wood, metals.corkMat]);
  const outlineTargets = [];
  scene.traverse(object => {
    if (!object.isMesh || !object.material?.isMeshStandardMaterial || object.material.transparent) return;
    solids.push({ mesh: object, base: object.material });
    if (outlinedMaterials.has(object.material)) outlineTargets.push(object);
  });

  const ink = new THREE.ShaderMaterial({
    uniforms: {
      uWidth: { value: 1 },
      uResolution: { value: new THREE.Vector2(1280, 800) },
      uColor: { value: new THREE.Color(0x15262a) }
    },
    side: THREE.BackSide,
    depthTest: true,
    depthWrite: false,
    // True inverted hull: expand the closed mesh in view space. Since the
    // back faces stay behind their own solid, the depth buffer clips only
    // genuine occlusion; there is no z-fighting on coplanar screen outlines.
    vertexShader: `
      uniform float uWidth;
      uniform vec2 uResolution;
      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vec3 viewNormal = normalize(normalMatrix * normal);
        // Convert CSS pixels to world units at the vertex's depth. This
        // keeps roughly the same contour weight at every camera zoom.
        float pixelsToWorld = 2.0 * max(.01, -viewPosition.z) /
          max(.001, projectionMatrix[1][1] * uResolution.y);
        viewPosition.xyz += viewNormal * (uWidth * 1.35 * pixelsToWorld);
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      void main() { gl_FragColor = vec4(uColor, 1.0); }
    `
  });
  const outlines = outlineTargets.map(source => {
    const shell = new THREE.Mesh(outlineGeometry(source.geometry), ink);
    shell.castShadow = shell.receiveShadow = false;
    shell.frustumCulled = source.frustumCulled;
    // Draw after all opaque solids have filled the depth buffer. Relying on
    // material-id sort caused occasional full-face ink and intermittent gaps.
    shell.renderOrder = 20;
    source.add(shell);
    return shell;
  });

  const gradient = makeGradientMap();
  const toonCopies = new Map();
  const paintTextures = new Map();

  function refreshPaintTexture(name) {
    const entry = paintTextures.get(name);
    if (!entry?.pixels) return;
    const palette = FINISH_PALETTES[name];
    const changed = blendPaintTileSeams(
      paintPixels(entry.pixels, state.brushExpression / 100, palette, name === 'copper' ? .84 : 1),
      entry.canvas.width, entry.canvas.height
    );
    const image = entry.context.createImageData(entry.canvas.width, entry.canvas.height);
    image.data.set(changed);
    entry.context.putImageData(image, 0, 0);
    // Fixed zero-detail mode uses one uninterrupted painted tile per UV span.
    entry.texture.repeat.set(1, 1);
    entry.texture.needsUpdate = true;
  }

  function ensureTexture(name) {
    if (paintTextures.has(name)) {
      const saved = paintTextures.get(name);
      return saved.ready ? saved.texture : null;
    }
    const entry = { texture: null, pixels: null, ready: false };
    paintTextures.set(name, entry);
    textureLoader.load(FINISH_URLS[name], image => {
      const surface = documentRef.createElement('canvas');
      surface.width = surface.height = 512;
      const context = surface.getContext('2d', { willReadFrequently: true });
      if (!context) return;
      context.drawImage(image.image, 0, 0, 512, 512);
      entry.canvas = surface;
      entry.context = context;
      entry.pixels = context.getImageData(0, 0, 512, 512).data.slice();
      const texture = new THREE.CanvasTexture(surface);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = texture.wrapT = THREE.MirroredRepeatWrapping;
      texture.anisotropy = 4;
      entry.texture = texture;
      refreshPaintTexture(name);
      entry.ready = true;
      syncPaint();
      image.dispose();
    });
    // A TextureLoader placeholder has no pixels until the image arrives.
    // Applying it immediately makes the metallic parts flash dark.
    return entry.ready ? entry.texture : null;
  }

  function syncToon() {
    fillGradient(gradient, state.toonStrength, state.toonSteps);
    for (const { mesh, base } of solids) {
      // Liquid metals retain their physical roughness, clearcoat and actual
      // environment reflections even when the rest of the scene is toon-lit.
      if (!state.drawing || !state.toon || base.userData?.preserveLiquidFinish) {
        mesh.material = base;
        continue;
      }
      let illustrated = toonCopies.get(base);
      if (!illustrated) {
        illustrated = new THREE.MeshToonMaterial({ side: base.side, gradientMap: gradient, fog: base.fog });
        toonCopies.set(base, illustrated);
      }
      illustrated.color.copy(base.color);
      if (illustrated.map !== base.map) { illustrated.map = base.map; illustrated.needsUpdate = true; }
      if (base.emissive) illustrated.emissive.copy(base.emissive);
      mesh.material = illustrated;
    }
  }

  function syncOutlines() {
    ink.uniforms.uWidth.value = state.outlineWidth;
    const power = state.outlineSaturation / 100;
    ink.uniforms.uColor.value.setRGB(.53 - .51 * power, .56 - .52 * power, .54 - .49 * power);
    const active = state.drawing && state.outline && state.outlineWidth > 0;
    outlines.forEach(shell => { shell.visible = active; });
    for (const contour of extraContours) contour.setStyle(active, state.outlineWidth, ink.uniforms.uColor.value);
  }

  function syncPaint() {
    for (const [groupName, materials] of Object.entries(groups)) {
      const next = state.painted ? ensureTexture(state[groupName]) : null;
      if (state.painted && !next) continue; // retain the last loaded material while the next finish arrives
      for (const material of materials) {
        const initial = original.get(material);
        const mapChanged = material.map !== (next || initial.map);
        material.map = next || initial.map;
        material.color.copy(next ? new THREE.Color(0xffffff) : initial.color);
        const influence = state.painted ? state.cartoonMaterial / 100 : 0;
        material.metalness = initial.metalness * (1 - influence * .68);
        material.roughness = initial.roughness + (Math.max(initial.roughness, .78) - initial.roughness) * influence;
        if (mapChanged) material.needsUpdate = true;
      }
    }
    syncToon();
  }

  function set(property, value) {
    if (!(property in state)) return false;
    if (property === 'brushDetail') return value === 0;
    if ((property === 'frame' || property === 'accents') && !FINISH_URLS[value]) return false;
    state[property] = value;
    if (property === 'brushExpression') for (const name of paintTextures.keys()) refreshPaintTexture(name);
    if (['painted', 'frame', 'accents', 'brushExpression', 'cartoonMaterial'].includes(property)) syncPaint();
    else if (['drawing', 'toon', 'toonStrength', 'toonSteps'].includes(property)) { syncToon(); syncOutlines(); }
    else syncOutlines();
    return true;
  }

  function resize(width, height) { ink.uniforms.uResolution.value.set(width, height); }
  // Preload every swatch without ever rendering its unfinished texture.
  for (const name of Object.keys(FINISH_URLS)) ensureTexture(name);
  syncPaint();
  syncOutlines();
  resize(renderer.domElement?.clientWidth || 1280, renderer.domElement?.clientHeight || 800);
  return { state, set, resize, getState: () => ({ ...state }), outlineCount: outlines.length };
}
