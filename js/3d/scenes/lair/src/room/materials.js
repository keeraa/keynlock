// @ts-check
import * as THREE from 'three';
import { ALCHEMY_LAIR_SCALE, makeGouacheWallTexture, WOOD_FINISH_ASSETS } from '@keynlock/alchemy/room-assets';
import { atelierWallpaperSource } from '@keynlock/atelier/room-assets';
import { t } from '../i18n.js';
import { ROOM_LENGTH } from '../room-layout.js';

const roomWalnutSource = new URL('./assets/surfaces/walnut-floor-gouache.jpg', import.meta.url).href;

export function createMaterials() {
  const textureLoader = new THREE.TextureLoader();
  const load = (url, rx = 1, ry = 1) => {
    const texture = textureLoader.load(url);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(rx, ry);
    texture.anisotropy = 4;
    return texture;
  };
  const mat = (color, roughness = .9, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
  // Furniture still uses the shared workshop finishes.
  const walnutMap = load(WOOD_FINISH_ASSETS.walnut);
  const ashMap = load(WOOD_FINISH_ASSETS.ash);
  const oakMap = load(WOOD_FINISH_ASSETS.oak);
  const plasterMap = load(new URL('./assets/surfaces/sand-plaster-gouache.jpg', import.meta.url).href, 1.7, 1.4);
  const ochreMap = load(atelierWallpaperSource);
  const floorMap = load(roomWalnutSource, 3.25, .17);
  const timberMap = load(roomWalnutSource);
  const ceilingMap = load(new URL('./assets/surfaces/taupe-ceiling-gouache.jpg', import.meta.url).href, 2.2, 4);
  const botanicalMap = makeWallpaperTexture('botanical');
  const damaskMap = makeWallpaperTexture('damask');
  for (const texture of [botanicalMap, damaskMap]) {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(12.4, 5.4);
    texture.anisotropy = 4;
  }
  const materials = {
    walnut: new THREE.MeshStandardMaterial({ map: walnutMap, color: '#ffffff', roughness: .96 }),
    agedWood: new THREE.MeshStandardMaterial({ map: walnutMap, color: '#d0b8a5', roughness: .96 }),
    darkWood: new THREE.MeshStandardMaterial({ map: walnutMap, color: '#917c6e', roughness: .98 }),
    roomTimber: new THREE.MeshStandardMaterial({
      map: timberMap, roughness: 1, emissiveMap: timberMap, emissive: '#eee8df', emissiveIntensity: .18,
    }),
    ash: new THREE.MeshStandardMaterial({ map: ashMap, color: '#ffffff', roughness: .95 }),
    oak: new THREE.MeshStandardMaterial({ map: oakMap, color: '#ffffff', roughness: .96 }),
    plaster: new THREE.MeshStandardMaterial({ map: plasterMap, roughness: 1 }),
    galleryPlaster: new THREE.MeshStandardMaterial({ map: plasterMap, roughness: 1, side: THREE.DoubleSide }),
    wallpaperOchre: new THREE.MeshStandardMaterial({ map: ochreMap, roughness: 1, side: THREE.DoubleSide }),
    // Match the laboratory's tile size along the entire right wall.
    alchemyTile: new THREE.MeshStandardMaterial({ map: makeGouacheWallTexture(THREE, 'sage', {
      width: ROOM_LENGTH / ALCHEMY_LAIR_SCALE, height: 48.4, textureWidth: 2560, textureHeight: 1024,
    }), roughness: 1, metalness: 0, side: THREE.DoubleSide }),
    wallpaperBotanical: new THREE.MeshStandardMaterial({ map: botanicalMap, color: '#e8e6d8', roughness: .99, side: THREE.DoubleSide }),
    wallpaperDamask: new THREE.MeshStandardMaterial({ map: damaskMap, color: '#f1e9d6', roughness: .99, side: THREE.DoubleSide }),
    floor: new THREE.MeshStandardMaterial({ map: floorMap, roughness: 1 }),
    floorAlternate: new THREE.MeshStandardMaterial({ map: floorMap, color: '#f2efeb', roughness: 1 }),
    // A little local fill on the downward-facing plaster keeps the gouache
    // legible above the beams without lifting the room's ambient light.
    ceiling: new THREE.MeshStandardMaterial({
      map: ceilingMap, roughness: 1, emissiveMap: ceilingMap, emissive: '#ffffff', emissiveIntensity: .3,
    }),
    brass: mat('#b49459', .36, .63),
    oldBrass: mat('#806e4d', .56, .52),
    copper: mat('#986547', .46, .64),
    iron: mat('#46514d', .54, .7),
    blackMetal: mat('#252f2b', .59, .48),
    paper: mat('#ddceb0', 1),
    paperDark: mat('#bca986', 1),
    canvas: mat('#cdbca0', .96),
    linen: mat('#d4c6b0', 1),
    leather: mat('#4b372d', 1),
    ruby: mat('#843f35', .81),
    green: mat('#435d4a', .93),
    slate: mat('#4e6468', .89),
    charcoal: mat('#242b28', .99),
    glass: new THREE.MeshPhysicalMaterial({ color: '#e9edcf', metalness: .05, roughness: .1, transmission: .48, transparent: true, opacity: .48, thickness: .13, depthWrite: false }),
    glassBlue: new THREE.MeshPhysicalMaterial({ color: '#c9dedc', roughness: .1, transmission: .28, transparent: true, opacity: .52, depthWrite: false }),
    liquidGreen: new THREE.MeshStandardMaterial({ color: '#758e71', emissive: '#526444', emissiveIntensity: .16, roughness: .3, transparent: true, opacity: .87 }),
    liquidAmber: new THREE.MeshStandardMaterial({ color: '#b87f41', emissive: '#6d3d1d', emissiveIntensity: .21, roughness: .27, transparent: true, opacity: .88 }),
    liquidBlue: new THREE.MeshStandardMaterial({ color: '#668b8c', emissive: '#3b696d', emissiveIntensity: .18, roughness: .25, transparent: true, opacity: .87 }),
  };
  // Share one pair of uniforms across every painted wood/plaster finish. These
  // modify the real Three.js fragment shader, with no texture regeneration.
  const pigment = { saturation: { value: 1 }, contrast: { value: 1 } };
  const painted = ['walnut', 'agedWood', 'darkWood', 'roomTimber', 'ash', 'oak', 'plaster', 'galleryPlaster',
    'floor', 'floorAlternate', 'ceiling', 'alchemyTile', 'wallpaperOchre', 'wallpaperBotanical', 'wallpaperDamask'];
  for (const name of painted) {
    const material = materials[name];
    const oldCompile = material.onBeforeCompile;
    material.onBeforeCompile = function (shader, ...args) {
      oldCompile.call(this, shader, ...args);
      shader.uniforms.uPigmentSaturation = pigment.saturation;
      shader.uniforms.uPigmentContrast = pigment.contrast;
      shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
        #include <map_fragment>
        float pigmentGray = dot(diffuseColor.rgb, vec3(.2126, .7152, .0722));
        diffuseColor.rgb = mix(vec3(pigmentGray), diffuseColor.rgb, uPigmentSaturation);
        diffuseColor.rgb = clamp((diffuseColor.rgb - vec3(.5)) * uPigmentContrast + vec3(.5), 0.0, 2.0);
      `).replace('void main() {', `
        uniform float uPigmentSaturation;
        uniform float uPigmentContrast;
        void main() {
      `);
    };
    material.customProgramCacheKey = () => 'keynlock-painted-v1';
  }
  const scaledTextures = [walnutMap, ashMap, oakMap, plasterMap, timberMap,
    floorMap, ceilingMap, ochreMap, botanicalMap, damaskMap];
  const originalRepeats = scaledTextures.map(map => map.repeat.clone());
  function setPaintSettings({ saturation = 100, contrast = 100, scale = 100 } = {}) {
    pigment.saturation.value = THREE.MathUtils.clamp(saturation / 100, .35, 1.75);
    pigment.contrast.value = THREE.MathUtils.clamp(contrast / 100, .55, 1.6);
    const factor = THREE.MathUtils.clamp(scale / 100, .5, 2.25);
    scaledTextures.forEach((texture, i) => texture.repeat.copy(originalRepeats[i]).multiplyScalar(1 / factor));
  }
  const metalNames = ['brass', 'oldBrass', 'copper', 'iron', 'blackMetal'];
  const metalBases = metalNames.map(name => ({
    material: materials[name], roughness: materials[name].roughness,
    metalness: materials[name].metalness, color: materials[name].color.clone(),
  }));
  const metalPalettes = {
    original: null,
    copper: ['#b77e57', '#95664f', '#c17b50', '#81675d', '#3d3837'],
    silver: ['#b1b5b3', '#848d8c', '#a6a8a5', '#737d81', '#384348'],
  };
  function setMetalSettings({ roughness = 50, metalness = 65, palette = 'original' } = {}) {
    const colors = metalPalettes[palette] || null;
    metalBases.forEach((base, i) => {
      base.material.roughness = THREE.MathUtils.clamp(base.roughness + (roughness - 50) * .009, .07, 1);
      base.material.metalness = THREE.MathUtils.clamp(base.metalness + (metalness - 65) * .012, 0, 1);
      if (colors) base.material.color.set(colors[i]);
      else base.material.color.copy(base.color);
    });
  }
  return { materials, load, textureLoader, visual: { setPaintSettings, setMetalSettings } };
}

export function canvasTexture(draw, width = 1024, height = 1024) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  draw(ctx, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Small seamless-feeling painterly papers for the optional right-wall finishes. */
export function makeWallpaperTexture(kind = 'botanical') {
  return canvasTexture((ctx, w, h) => {
    const botanical = kind === 'botanical';
    const ground = ctx.createLinearGradient(0, 0, w, h);
    if (botanical) {
      ground.addColorStop(0, '#526a5a'); ground.addColorStop(.5, '#425c4d'); ground.addColorStop(1, '#344e45');
    } else {
      ground.addColorStop(0, '#54483e'); ground.addColorStop(.5, '#423b36'); ground.addColorStop(1, '#352f2c');
    }
    ctx.fillStyle = ground; ctx.fillRect(0, 0, w, h);
    let seed = botanical ? 678 : 512;
    const random = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < 1600; i++) {
      ctx.fillStyle = random() < .5 ? 'rgba(243,223,183,.026)' : 'rgba(9,20,17,.052)';
      ctx.fillRect(random() * w, random() * h, 1 + random() * 22, 1 + random() * 14);
    }
    for (const cy of [84, 256, 428]) for (const cx of [84, 256, 428]) {
      ctx.strokeStyle = botanical ? 'rgba(183,180,129,.48)' : 'rgba(192,151,106,.42)';
      ctx.lineWidth = botanical ? 3 : 4;
      ctx.beginPath(); ctx.moveTo(cx, cy + 55);
      ctx.bezierCurveTo(cx - 40, cy + 12, cx + 42, cy - 8, cx, cy - 58);
      ctx.stroke();
      for (const side of [-1, 1]) for (let i = 0; i < 3; i++) {
        const x = cx + side * (18 + i * 9), y = cy + 30 - i * 27;
        ctx.save(); ctx.translate(x, y); ctx.rotate(side * (.64 + i * .12));
        ctx.beginPath(); ctx.ellipse(0, 0, botanical ? 8 : 11, botanical ? 22 : 27, 0, 0, Math.PI * 2);
        ctx.fillStyle = botanical ? 'rgba(157,177,119,.30)' : 'rgba(180,135,105,.23)';
        ctx.fill(); ctx.stroke(); ctx.restore();
      }
      ctx.fillStyle = botanical ? '#b0ac79' : '#b38c65';
      for (let k = 0; k < 5; k++) {
        const angle = k * Math.PI * 2 / 5;
        ctx.beginPath(); ctx.ellipse(cx + Math.cos(angle) * 9, cy - 59 + Math.sin(angle) * 9, 6, 10, angle, 0, Math.PI * 2);ctx.fill();
      }
      ctx.fillStyle = '#d1b887'; ctx.beginPath(); ctx.arc(cx, cy - 59, 4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = botanical ? 'rgba(26,48,38,.35)' : 'rgba(214,168,105,.13)';
    ctx.lineWidth = 2;
    for (let x = 0; x < w; x += 172) { ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke(); }
  }, 512, 512);
}

/** Woven, painterly linen. The texture stays fixed while the cloth mesh deforms. */
export function makeCurtainLinenTexture() {
  return canvasTexture((ctx, w, h) => {
    const ground = ctx.createLinearGradient(0, 0, w, 0);
    ground.addColorStop(0, '#3e5959');
    ground.addColorStop(.22, '#69817e');
    ground.addColorStop(.49, '#93a49b');
    ground.addColorStop(.73, '#647d79');
    ground.addColorStop(1, '#405958');
    ctx.fillStyle = ground;
    ctx.fillRect(0, 0, w, h);
    let seed = 322;
    const random = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296);
    for (let x = 0; x < w; x += 3) {
      ctx.fillStyle = `rgba(227,225,195,${.025 + random() * .085})`;
      ctx.fillRect(x, 0, 1, h);
    }
    for (let y = 0; y < h; y += 4) {
      ctx.fillStyle = `rgba(25,49,48,${.012 + random() * .05})`;
      ctx.fillRect(0, y, w, 1);
    }
    for (let i = 0; i < 550; i++) {
      ctx.fillStyle = random() < .45 ? 'rgba(215,216,182,.045)' : 'rgba(28,53,51,.046)';
      ctx.fillRect(random() * w, random() * h, 2 + random() * 18, 6 + random() * 72);
    }
    // A thicker sewn hem catches the light around the bottom edge.
    ctx.fillStyle = 'rgba(28,53,51,.17)'; ctx.fillRect(0, h - 28, w, 8);
    ctx.fillStyle = 'rgba(221,217,175,.22)'; ctx.fillRect(0, h - 19, w, 3);
  }, 512, 1024);
}

export function makeMapTexture() {
  return canvasTexture((ctx, w, h) => {
    ctx.fillStyle = '#d1c19e'; ctx.fillRect(0, 0, w, h);
    let s = 87; const rnd = () => ((s = (1664525 * s + 1013904223) >>> 0) / 4294967296);
    ctx.strokeStyle = '#8a795e'; ctx.lineCap = 'round';
    for (let i = 0; i < 24; i++) {
      const y = 60 + i * 36 + rnd() * 20;
      ctx.lineWidth = 3 + rnd() * 6; ctx.beginPath(); ctx.moveTo(12, y);
      for (let x = 25; x < w; x += 100) ctx.lineTo(x, y + Math.sin(x * .01 + i) * 25);
      ctx.stroke();
    }
    for (let i = 0; i < 26; i++) {
      const x = 40 + i * 39;
      ctx.lineWidth = 2 + rnd() * 4; ctx.beginPath(); ctx.moveTo(x, 0); ctx.bezierCurveTo(x + 30, 300, x - 40, 650, x + 20, h); ctx.stroke();
    }
    ctx.strokeStyle = '#6f8d91'; ctx.lineWidth = 57; ctx.beginPath(); ctx.moveTo(260, -25); ctx.bezierCurveTo(410, 330, 450, 690, 700, h + 50); ctx.stroke();
    ctx.strokeStyle = '#a7b7ad'; ctx.lineWidth = 3; ctx.stroke();
    for (let i = 0; i < 7; i++) {
      const x = 130 + rnd() * 720, y = 100 + rnd() * 760;
      ctx.strokeStyle = '#9c4338'; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(x, y, 13, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#9c4338'; ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#463d30'; ctx.font = 'bold 52px Georgia'; ctx.fillText('KIENLOCK', 305, 82);
    ctx.font = '20px Georgia'; ctx.fillText(t('ПЛАН ГОРОДА · КАНАЛЫ И КВАРТАЛЫ'), 230, 116);
  });
}
